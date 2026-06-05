import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { MatchingJobData } from './matching.processor';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * 调度器状态跟踪（内存级别，用于精细化降级）
 */
interface RegionSchedulerState {
  /** 连续失败计数 */
  consecutiveFailures: number;
  /** 上次跳过原因 */
  lastSkipReason: 'none' | 'no_pending' | 'queue_congested' | 'job_failed';
  /** 是否已暂停 */
  isPaused: boolean;
  /** 上次调度时间 */
  lastScheduledAt: Date | null;
}

/**
 * 匹配调度器
 *
 * 每5分钟触发一次，使用 Redis SETNX 分布式锁防止多实例惊群效应。
 * 支持精细化降级策略：
 * - 无 pending 意向 → 正常跳过
 * - 队列拥堵 → 记录 WARN，增加并发或报警
 * - 连续 Job 失败 → 暂停调度并报警
 */
@Injectable()
export class MatchingScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(MatchingScheduler.name);
  private readonly redis: Redis;
  private readonly lockPrefix: string;
  private readonly lockTtlSeconds: number;
  private readonly regionStates = new Map<string, RegionSchedulerState>();

  constructor(
    @InjectQueue('matching')
    private readonly matchingQueue: Queue<MatchingJobData>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const redisConfig = this.configService.get<{
      host: string;
      port: number;
      password?: string;
      db: number;
      keyPrefix: string;
    }>('redis');

    this.lockPrefix = `${redisConfig?.keyPrefix || 'basketball:'}matching:scheduler:`;
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
   * 每5分钟触发匹配调度
   *
   * 逻辑：
   * 1. 获取活跃地区列表
   * 2. 对每个地区尝试获取分布式锁
   * 3. 检查队列是否已有活跃 job
   * 4. 无活跃 job → 添加新 job
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleMatchingSchedule(): Promise<void> {
    this.logger.log('===== 匹配调度器触发 =====');

    try {
      const regionCodes = await this.getActiveRegionCodes();

      if (regionCodes.length === 0) {
        this.logger.log('无活跃地区，跳过本次调度');
        return;
      }

      for (const regionCode of regionCodes) {
        await this.processRegion(regionCode);
      }
    } catch (error) {
      this.logger.error(
        `调度器异常: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * 处理单个地区的调度
   */
  private async processRegion(regionCode: string): Promise<void> {
    const state = this.getOrCreateRegionState(regionCode);

    // 如果已暂停，检查是否需要恢复
    if (state.isPaused) {
      if (state.consecutiveFailures < 3) {
        state.isPaused = false;
        this.logger.log(`地区 ${regionCode} 调度已恢复`);
      } else {
        this.logger.warn(`地区 ${regionCode} 调度已暂停，跳过`);
        return;
      }
    }

    // 1. 获取分布式锁
    const lockKey = `${this.lockPrefix}${regionCode}`;
    const lockValue = randomUUID();
    const acquired = await this.acquireLock(lockKey, lockValue);

    if (!acquired) {
      this.logger.log(`地区 ${regionCode} 锁已被占用，跳过`);
      return;
    }

    try {
      // 2. 检查该地区是否有 pending 意向
      const hasPending = await this.hasPendingIntentions(regionCode);
      if (!hasPending) {
        state.lastSkipReason = 'no_pending';
        this.logger.log(`地区 ${regionCode} 无 pending 意向，跳过`);
        return;
      }

      // 3. 检查队列是否已有活跃 job
      const hasActiveJob = await this.hasActiveJobForRegion(regionCode);
      if (hasActiveJob) {
        state.lastSkipReason = 'queue_congested';
        this.logger.warn(`地区 ${regionCode} 队列已有活跃 job，可能存在拥堵`);
        return;
      }

      // 4. 添加新 job
      const job = await this.matchingQueue.add(
        'match-region',
        { regionCode },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          removeOnComplete: {
            age: 3600, // 1小时后移除完成的 job
            count: 100,
          },
          removeOnFail: {
            age: 86400, // 24小时后移除失败的 job
            count: 50,
          },
        },
      );

      state.consecutiveFailures = 0;
      state.lastSkipReason = 'none';
      state.lastScheduledAt = new Date();
      this.logger.log(`地区 ${regionCode} 已添加匹配任务: jobId=${job.id}`);
    } catch (error) {
      state.consecutiveFailures++;
      state.lastSkipReason = 'job_failed';
      this.logger.error(
        `地区 ${regionCode} 调度失败 (连续${state.consecutiveFailures}次): ${(error as Error).message}`,
      );

      // 精细化降级：连续3次因"Job失败"导致跳过，暂停调度
      if (state.consecutiveFailures >= 3) {
        state.isPaused = true;
        this.logger.error(
          `地区 ${regionCode} 连续${state.consecutiveFailures}次调度失败，已暂停调度，需人工介入`,
        );
      }
    } finally {
      // 释放锁
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * 获取活跃地区列表（有 pending 意向的地区）
   */
  private async getActiveRegionCodes(): Promise<string[]> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('DISTINCT intention.region_code', 'regionCode')
      .from(Intention, 'intention')
      .where('intention.status = :status', { status: 'pending' })
      .andWhere('intention.start_time > :oneHourLater', {
        oneHourLater: new Date(Date.now() + 60 * 60 * 1000),
      })
      .getRawMany();

    return result
      .map((r: { regionCode: string }) => r.regionCode)
      .filter(Boolean);
  }

  /**
   * 检查地区是否有 pending 意向
   */
  private async hasPendingIntentions(regionCode: string): Promise<boolean> {
    const count = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from(Intention, 'intention')
      .where('intention.status = :status', { status: 'pending' })
      .andWhere('intention.region_code = :regionCode', { regionCode })
      .andWhere('intention.start_time > :oneHourLater', {
        oneHourLater: new Date(Date.now() + 60 * 60 * 1000),
      })
      .getRawOne();

    return parseInt(count?.count || '0', 10) > 0;
  }

  /**
   * 检查队列是否已有该地区的活跃 job
   *
   * 使用 getJobCounts 替代 getJobs 避免全量获取，性能更优。
   */
  private async hasActiveJobForRegion(regionCode: string): Promise<boolean> {
    try {
      const counts = await this.matchingQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
      );
      const totalActive =
        (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);

      if (totalActive === 0) {
        return false;
      }

      // 只有在有活跃 job 时才获取具体 job 列表检查 regionCode
      const jobs = await this.matchingQueue.getJobs([
        'waiting',
        'active',
        'delayed',
      ]);
      return jobs.some((job) => job.data?.regionCode === regionCode);
    } catch (error) {
      this.logger.warn(`检查活跃 job 失败: ${(error as Error).message}`);
      return false; // 保守策略：假设没有活跃 job
    }
  }

  /**
   * 获取或创建地区调度状态
   */
  private getOrCreateRegionState(regionCode: string): RegionSchedulerState {
    if (!this.regionStates.has(regionCode)) {
      this.regionStates.set(regionCode, {
        consecutiveFailures: 0,
        lastSkipReason: 'none',
        isPaused: false,
        lastScheduledAt: null,
      });
    }
    return this.regionStates.get(regionCode)!;
  }

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
    this.logger.log('Redis 连接已断开');
  }
}
