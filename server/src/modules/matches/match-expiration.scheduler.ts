import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MatchConfirmationService } from './services/match-confirmation.service';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * MatchExpirationScheduler — v2.0 超时调度器。
 *
 * 每5分钟执行一次（BullMQ cron job），处理三类超时场景：
 *
 * 1. **候选比赛球员确认超时**：
 *    pending_players + confirmDeadline 已过 → expired → 释放 invited 球员
 *
 * 2. **场地方确认超时**：
 *    pending_venue + venueConfirmDeadline 已过 → 自动尝试预订场地
 *    → 成功: auto_confirmed + 分队 + 通知
 *    → 失败: cancelled + 释放球员 + 退款
 *
 * 3. **意向过期**：
 *    pending + expiresAt 已过 → expired
 *    → 同步释放 pending_players 状态比赛的 MatchPlayer
 *
 * 并发安全：
 * - Redis SETNX 分布式锁防止多实例同时执行
 * - SQL SKIP LOCKED 避免与其他调度器实例竞争同一行
 * - 调用 MatchConfirmationService 的已有方法处理比赛状态变更
 *
 * 设计参考：MatchingScheduler（matching.scheduler.ts）
 */
@Injectable()
export class MatchExpirationScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(MatchExpirationScheduler.name);
  private readonly redis: Redis;
  private readonly lockPrefix: string;
  private readonly lockTtlSeconds: number;

  /** 每次最多处理的比赛/意向数量，防止单次调度耗时过长 */
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly dataSource: DataSource,
    private readonly confirmationService: MatchConfirmationService,
    private readonly configService: ConfigService,
  ) {
    const redisConfig = this.configService.get<{
      host: string;
      port: number;
      password?: string;
      db: number;
      keyPrefix: string;
    }>('redis');

    this.lockPrefix = `${redisConfig?.keyPrefix || 'basketball:'}expiration:scheduler:`;
    this.lockTtlSeconds = 240; // 4分钟（小于5分钟调度间隔）

    this.redis = new Redis({
      host: redisConfig?.host || 'localhost',
      port: redisConfig?.port || 6379,
      password: redisConfig?.password,
      db: redisConfig?.db || 0,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  /**
   * 每5分钟触发超时调度。
   *
   * 执行顺序：
   * 1. 候选比赛确认超时
   * 2. 场地方确认超时
   * 3. 意向过期
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpirationSchedule(): Promise<void> {
    const lockKey = `${this.lockPrefix}global`;
    const lockValue = randomUUID();
    const acquired = await this.acquireLock(lockKey, lockValue);

    if (!acquired) {
      this.logger.log('锁已被其他实例占用，跳过本次调度');
      return;
    }

    this.logger.log('===== 超时调度器触发 =====');

    try {
      // Phase 1: 候选比赛球员确认超时
      const expiredMatches = await this.expirePlayerConfirmationMatches();
      if (expiredMatches > 0) {
        this.logger.log(`Phase 1: ${expiredMatches} 个候选比赛已过期`);
      }

      // Phase 2: 场地方确认超时
      const venueTimeoutMatches = await this.autoConfirmVenueMatches();
      if (venueTimeoutMatches > 0) {
        this.logger.log(`Phase 2: ${venueTimeoutMatches} 个比赛触发场地自动确认`);
      }

      // Phase 3: 意向过期
      const expiredIntentions = await this.expireIntentions();
      if (expiredIntentions > 0) {
        this.logger.log(`Phase 3: ${expiredIntentions} 个意向已过期`);
      }
    } catch (error) {
      this.logger.error(
        `调度器异常: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  // ==================== Phase 1: Player Confirmation Timeout ====================

  /**
   * 候选比赛球员确认超时。
   *
   * 查找满足以下条件的比赛：
   * 1. status='pending_players' AND confirmDeadline < now()（正常超时）
   * 2. status='pending_players' AND startTime - 1.5h < now()（最低人数兜底窗口）
   *
   * 使用 SKIP LOCKED 避免与其他实例竞争。
   * 对每个比赛调用 finalizeMatch() 处理：
   * - 满员 → pending_venue
   * - 达到最低人数（在兜底窗口内）→ pending_venue
   * - 未达到最低人数 → expired
   */
  private async expirePlayerConfirmationMatches(): Promise<number> {
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM matches
       WHERE status = 'pending_players'
         AND (
           (confirm_deadline IS NOT NULL AND confirm_deadline < NOW())
           OR (start_time IS NOT NULL AND start_time - INTERVAL '1.5 hours' < NOW())
         )
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [this.BATCH_SIZE],
    );

    let processed = 0;
    for (const row of rows) {
      try {
        await this.confirmationService.finalizeMatch(Number(row.id));
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to expire match ${row.id}: ${(error as Error).message}`,
        );
      }
    }

    return processed;
  }

  // ==================== Phase 2: Venue Confirmation Timeout ====================

  /**
   * 场地方确认超时。
   *
   * 查找 status='pending_venue' AND venueConfirmDeadline < now() 的比赛，
   * 使用 SKIP LOCKED 避免并发。
   * 对每个比赛调用 autoConfirmVenueBooking()：
   * - 成功 → confirmed (auto_confirmed) + 分队 + 通知
   * - 失败 → cancelled + 释放球员 + 退款
   */
  private async autoConfirmVenueMatches(): Promise<number> {
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM matches
       WHERE status = 'pending_venue'
         AND venue_confirm_deadline IS NOT NULL
         AND venue_confirm_deadline < NOW()
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [this.BATCH_SIZE],
    );

    let processed = 0;
    for (const row of rows) {
      try {
        const result = await this.confirmationService.autoConfirmVenueBooking(
          Number(row.id),
        );
        this.logger.log(
          `Venue auto-confirm match ${row.id}: ${result.message}`,
        );
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to auto-confirm venue for match ${row.id}: ${(error as Error).message}`,
        );
      }
    }

    return processed;
  }

  // ==================== Phase 3: Intention Expiration ====================

  /**
   * 意向过期。
   *
   * 查找 status='pending' AND expiresAt < now() 的意向，
   * 使用 SKIP LOCKED 避免并发。
   *
   * 对每个过期意向：
   * 1. Intention.status → expired
   * 2. 释放在 pending_players 状态比赛中的 MatchPlayer（invited → withdrawn）
   *    注意：pending_venue 状态比赛的已确认球员不释放
   */
  private async expireIntentions(): Promise<number> {
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM intentions
       WHERE status = 'pending'
         AND expires_at < NOW()
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [this.BATCH_SIZE],
    );

    if (rows.length === 0) return 0;

    const intentionIds = rows.map((r) => Number(r.id));

    // Batch update intention status → expired
    await this.dataSource.query(
      `UPDATE intentions SET status = 'expired', updated_at = NOW()
       WHERE id = ANY($1) AND status = 'pending'`,
      [intentionIds],
    );

    // Release MatchPlayers for these intentions in pending_players matches
    // Only release 'invited' players, not 'confirmed' ones
    const releaseResult = await this.dataSource.query(
      `UPDATE match_players mp
       SET status = 'withdrawn'
       FROM matches m
       WHERE mp.match_id = m.id
         AND m.status = 'pending_players'
         AND mp.intention_id = ANY($1)
         AND mp.status = 'invited'`,
      [intentionIds],
    );

    this.logger.log(
      `Expired ${intentionIds.length} intentions, released ${releaseResult[1] || 0} match players`,
    );

    return intentionIds.length;
  }

  // ==================== Redis Lock Helpers ====================

  /**
   * 获取 Redis 分布式锁（SETNX）
   */
  private async acquireLock(key: string, value: string): Promise<boolean> {
    try {
      const result = await this.redis.set(
        key,
        value,
        'EX',
        this.lockTtlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.error(`获取锁失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 释放 Redis 分布式锁（安全释放，仅释放自己持有的锁）
   */
  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.eval(script, 1, key, value);
    } catch (error) {
      this.logger.error(`释放锁失败: ${(error as Error).message}`);
    }
  }

  /**
   * 应用关闭时断开 Redis 连接
   */
  async onModuleDestroy(): Promise<void> {
    await this.redis.disconnect();
    this.logger.log('Redis 连接已断开 (MatchExpirationScheduler)');
  }
}
