import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MatchThresholdParams, isMatchThresholdParams, isPoolingParams } from '@shared/system';
import { VenueBookingService } from '@modules/venues/services/venue-booking.service';
import { MatchingResult } from '../interfaces/matching-result.interface';
import { MatchPoolService } from './match-pool.service';
import {
  IntentionAvatar,
  AvatarSource,
} from '../interfaces/intention-avatar.interface';
import {
  PoolingParams,
  MatchPool,
  MatchSegment,
} from '../interfaces/match-pool.interface';

/** 段内能力值最大跨度默认值 */
const DEFAULT_MAX_ABILITY_SPREAD = 12;

/** 池化参数默认值 */
const DEFAULT_POOLING_PARAMS: PoolingParams = {
  maxAbilitySpread: 12,
  minPoolSize: 6,
  timeAlignmentMinutes: 30,
};

/**
 * 匹配引擎核心服务 — v2.2 意向分身宇宙 + 比赛池匹配
 *
 * 核心变化（v2.2）：
 * - 每个意向按多选场地和赛制组合，形成"意向分身宇宙"
 * - 相同场地+赛制+时间窗口重叠的意向分身放入同一个比赛池
 * - 池内按能力值动态分段：segmentCount = ceil(spread / maxSpread)
 * - 每段内人数不设上限，全部邀请，先确认先得
 * - 比赛开始时间 = 段内所有意向时间窗口的最早截止时间点（对齐到整点/30分钟）
 * - 持续时间 = 段内所有意向持续时间均值取整（最低2小时）
 * - 确认截止 = 开始时间前1小时，不足下限人数则整段退回宇宙
 *
 * 保留（v2.0）：
 * - 意向保持 pending，可同时参与多个候选比赛
 * - 创建比赛时不分队（延后到 confirmed）
 * - 创建比赛时不预订场地（延后到场地方确认）
 * - 满员后由 MatchConfirmationService 触发场地确认
 */
@Injectable()
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);

  constructor(
    @InjectRepository(Intention)
    private readonly intentionRepo: Repository<Intention>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(Format)
    private readonly formatRepo: Repository<Format>,
    @InjectRepository(SystemParam)
    private readonly systemParamRepo: Repository<SystemParam>,
    private readonly dataSource: DataSource,
    private readonly venueBookingService: VenueBookingService,
    private readonly matchPoolService: MatchPoolService,
  ) {}

  // ==================== Public API ====================

  /**
   * 执行匹配流程
   *
   * @param regionCode 可选的地区编码，若指定则只匹配该地区的意向
   * @returns 匹配结果摘要
   */
  async runMatching(regionCode?: string): Promise<MatchingResult> {
    const startTime = Date.now();
    this.logger.log(
      `开始匹配任务${regionCode ? ` (regionCode=${regionCode})` : ''}`,
    );

    // 1. 【参数快照】一次性读取系统参数
    const thresholdParams = await this.loadThresholdParams();
    const poolingParams = await this.loadPoolingParams();

    // 2. 查询 pending 意向
    const intentions = await this.fetchPendingIntentions(regionCode);

    if (intentions.length === 0) {
      this.logger.log('无 pending 意向需要匹配');
      return {
        intentionsScanned: 0,
        groupsProcessed: 0,
        matchesCreated: 0,
        reusedCount: 0,
        matchesFailed: 0,
        expiredCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // 3. 【已有比赛复用】查询 status='pending_players' 的候选比赛
    const reusedCount = await this.reuseExistingMatches(intentions, regionCode);

    // 4. 构建剩余意向的分身列表
    const avatarSources = this.buildAvatarSources(intentions);
    const avatars = this.matchPoolService.buildAvatars(avatarSources);

    // 5. 【池化】按 (venueId, formatId) 分组，组内滑动窗口合并时间重叠分身
    const poolingResult = this.matchPoolService.buildPools(avatars, poolingParams.minPoolSize);

    let matchesCreated = 0;
    let matchesFailed = 0;
    let groupsProcessed = 0;

    // 6. FOR EACH 比赛池: 分段并创建比赛
    let failedDueToVenueUnavailable = 0;
    let failedDueToFormatMissing = 0;
    let failedDueToException = 0;
    let failedDueToSegmentInsufficient = 0;

    for (const pool of poolingResult.pools) {
      try {
        const format = await this.formatRepo.findOneBy({ id: pool.formatId });
        if (!format) {
          this.logger.warn(`赛制不存在: formatId=${pool.formatId}`);
          matchesFailed++;
          failedDueToFormatMissing++;
          continue;
        }

        const segmentResult = this.matchPoolService.segmentPool(
          pool,
          format,
          poolingParams,
        );

        if (segmentResult.segments.length === 0) {
          this.logger.warn(
            `池内分段后无有效比赛段: venueId=${pool.venueId}, formatId=${pool.formatId}, ` +
              `avatars=${pool.avatars.length}, discarded=${segmentResult.discardedAvatars}`,
          );
          failedDueToSegmentInsufficient += segmentResult.discardedAvatars;
        }

        for (const segment of segmentResult.segments) {
          groupsProcessed++;

          // 7. 乐观场地可用性检查
          const slotDate = segment.matchStartTime.toLocaleDateString('en-CA', {
            timeZone: 'Asia/Shanghai',
          });
          const startTimeStr = segment.matchStartTime.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const endTimeStr = segment.matchEndTime.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Shanghai',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const available = await this.venueBookingService.checkAvailability(
            pool.venueId,
            slotDate,
            startTimeStr,
            endTimeStr,
          );

          if (!available) {
            this.logger.warn(
              `场地不可用: venueId=${pool.venueId}, time=${slotDate} ${startTimeStr}-${endTimeStr}`,
            );
            matchesFailed++;
            failedDueToVenueUnavailable++;
            continue;
          }

          // 8. 创建候选比赛 + MatchPlayer
          const matchId = await this.createMatchFromSegment(segment, format);
          if (matchId) {
            matchesCreated++;
          }
        }
      } catch (error) {
        this.logger.error(
          `比赛池处理失败: venueId=${pool.venueId}, formatId=${pool.formatId}, error=${(error as Error).message}`,
        );
        matchesFailed++;
        failedDueToException++;
      }
    }

    // 9. 处理过期意向
    const expiredCount = await this.processExpiredIntentions(intentions);

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `匹配完成: intentions=${intentions.length}, pools=${poolingResult.pools.length}, ` +
        `segments=${groupsProcessed}, matchesCreated=${matchesCreated}, matchesFailed=${matchesFailed}, ` +
        `reused=${reusedCount}, expired=${expiredCount}, duration=${durationMs}ms, ` +
        `failedReasons={venueUnavailable:${failedDueToVenueUnavailable}, formatMissing:${failedDueToFormatMissing}, ` +
        `exception:${failedDueToException}, segmentInsufficient:${failedDueToSegmentInsufficient}}`,
    );

    return {
      intentionsScanned: intentions.length,
      groupsProcessed,
      matchesCreated,
      reusedCount,
      matchesFailed,
      expiredCount,
      durationMs,
    };
  }

  // ==================== Parameter Loading ====================

  /**
   * 加载匹配阈值参数
   */
  private async loadThresholdParams(): Promise<MatchThresholdParams> {
    const param = await this.systemParamRepo.findOneBy({
      paramKey: 'match_threshold_params',
    });

    if (!param || !isMatchThresholdParams(param.paramValue)) {
      this.logger.warn(
        '系统参数 match_threshold_params 不存在或格式错误，使用默认值',
      );
      return {
        base_threshold: 20.0,
        min_threshold: 5.0,
        intention_count_factor: 0.5,
        max_ability_spread: 12,
      };
    }

    return param.paramValue;
  }

  /**
   * 加载池化参数
   */
  private async loadPoolingParams(): Promise<PoolingParams> {
    const param = await this.systemParamRepo.findOneBy({
      paramKey: 'pooling_params',
    });

    if (!param || !isPoolingParams(param.paramValue)) {
      this.logger.warn(
        '系统参数 pooling_params 不存在或格式错误，使用默认值',
      );
      return DEFAULT_POOLING_PARAMS;
    }

    return param.paramValue;
  }

  // ==================== Intention Fetching ====================

  /**
   * 查询 pending 意向（排除已被屏蔽的）
   */
  private async fetchPendingIntentions(regionCode?: string): Promise<Intention[]> {
    const now = new Date();
    const qb = this.intentionRepo.createQueryBuilder('intention')
      .leftJoinAndSelect('intention.intentionVenues', 'iv')
      .leftJoinAndSelect('intention.intentionFormats', 'if')
      .leftJoinAndSelect('intention.player', 'player')
      .where('intention.status = :status', { status: 'pending' })
      .andWhere('intention.start_time > :minStartTime', {
        minStartTime: new Date(now.getTime() + 60 * 60 * 1000),
      })
      .andWhere(
        '(intention.excluded_until IS NULL OR intention.excluded_until <= :now)',
        { now },
      )
      .orderBy('intention.submitted_at', 'ASC');

    if (regionCode) {
      qb.andWhere('intention.region_code = :regionCode', { regionCode });
    }

    return qb.getMany();
  }

  // ==================== Existing Match Reuse ====================

  /**
   * 已有比赛复用：将新兼容意向加入 pending_players 的候选比赛
   */
  private async reuseExistingMatches(
    intentions: Intention[],
    regionCode?: string,
  ): Promise<number> {
    const existingMatches = await this.matchRepo.find({
      where: {
        status: 'pending_players',
        ...(regionCode ? { regionCode } : {}),
      },
    });

    let reusedCount = 0;

    for (const match of existingMatches) {
      for (const intention of intentions) {
        // 检查意向是否有分身与比赛参数兼容
        const hasVenue = intention.intentionVenues?.some(
          (iv) => iv.venueId === match.venueId,
        );
        const hasFormat = intention.intentionFormats?.some(
          (ifmt) => ifmt.formatId === match.formatId,
        );

        if (!hasVenue || !hasFormat) continue;

        // 检查 matchStartTime 是否在分身时间窗口内
        const windowEnd = new Date(
          intention.startTime.getTime() + intention.acceptableWaitMinutes * 60 * 1000,
        );
        const isTimeCompatible =
          intention.startTime <= match.startTime && match.startTime <= windowEnd;

        if (!isTimeCompatible) continue;

        // 兼容 → 创建 MatchPlayer status='invited'
        try {
          await this.dataSource
            .getRepository(MatchPlayer)
            .createQueryBuilder()
            .insert()
            .into(MatchPlayer)
            .values({
              matchId: match.id,
              playerId: intention.playerId,
              intentionId: intention.id,
              status: 'invited',
            })
            .orIgnore()
            .execute();

          reusedCount++;
        } catch (error) {
          this.logger.warn(
            `复用意向失败: intentionId=${intention.id}, matchId=${match.id}, error=${(error as Error).message}`,
          );
        }
      }
    }

    if (reusedCount > 0) {
      this.logger.log(`已有比赛复用: ${reusedCount} 个意向被加入候选比赛`);
    }

    return reusedCount;
  }

  // ==================== Avatar Building ====================

  /**
   * 从意向构建 AvatarSource 列表
   */
  private buildAvatarSources(intentions: Intention[]): AvatarSource[] {
    return intentions.map((intention) => ({
      intentionId: intention.id,
      playerId: intention.playerId,
      totalAbilityScore: intention.player?.totalAbilityScore ?? 0,
      venueIds: intention.intentionVenues?.map((iv) => iv.venueId) ?? [],
      formatIds: intention.intentionFormats?.map((ifmt) => ifmt.formatId) ?? [],
      startTime: intention.startTime,
      acceptableWaitMinutes: intention.acceptableWaitMinutes,
      durationMinutes: intention.durationMinutes,
      submittedAt: intention.submittedAt,
    }));
  }

  // ==================== Match Creation ====================

  /**
   * 从比赛段创建候选比赛
   */
  private async createMatchFromSegment(
    segment: MatchSegment,
    format: Format,
  ): Promise<number | null> {
    return this.dataSource.transaction(async (manager) => {
      const match = manager.create(Match, {
        venueId: segment.pool.venueId,
        formatId: segment.pool.formatId,
        startTime: segment.matchStartTime,
        endTime: segment.matchEndTime,
        status: 'pending_players',
        teamCount: format.teamCountMax,  // 满员时队伍数
        playersPerTeam: format.teamSize,
        requiredPlayers: format.teamCountMax * format.teamSize,  // 满员人数
        minPlayers: format.teamCountMin * format.teamSize,  // 最低人数（兜底）
        confirmedPlayers: 0,
        confirmDeadline: segment.confirmDeadline,
        depositAmount: '50.00',
        regionCode: null, // 可从 venue 获取
      });

      const savedMatch = await manager.save(Match, match);

      // 创建 MatchPlayer（去重后的意向）
      const dedupedAvatars = this.matchPoolService.deduplicateAvatars(segment.avatars);

      for (const avatar of dedupedAvatars) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(MatchPlayer)
          .values({
            matchId: savedMatch.id,
            playerId: avatar.playerId,
            intentionId: avatar.intentionId,
            status: 'invited',
          })
          .orIgnore()
          .execute();
      }

      this.logger.log(
        `候选比赛创建: matchId=${savedMatch.id}, venueId=${segment.pool.venueId}, ` +
          `formatId=${segment.pool.formatId}, players=${dedupedAvatars.length}, ` +
          `startTime=${segment.matchStartTime.toISOString()}`,
      );

      return savedMatch.id;
    });
  }

  // ==================== Expired Intentions ====================

  /**
   * 处理过期意向（start_time <= now + 1h）
   */
  private async processExpiredIntentions(intentions: Intention[]): Promise<number> {
    const now = new Date();
    const expiredIntentions = intentions.filter(
      (i) => i.startTime <= new Date(now.getTime() + 60 * 60 * 1000),
    );

    if (expiredIntentions.length === 0) return 0;

    let expiredCount = 0;

    try {
      await this.dataSource.transaction(async (manager) => {
        for (const intention of expiredIntentions) {
          const updateResult = await manager.update(
            Intention,
            { id: intention.id, status: 'pending' },
            { status: 'expired' },
          );

          if (updateResult.affected && updateResult.affected > 0) {
            expiredCount++;
            this.logger.log(`意向已过期: intentionId=${intention.id}`);
          }
        }
      });
    } catch (error) {
      this.logger.error(
        `过期意向批量处理失败: error=${(error as Error).message}`,
      );
    }

    return expiredCount;
  }
}
