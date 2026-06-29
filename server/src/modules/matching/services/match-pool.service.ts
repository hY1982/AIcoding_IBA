import { Injectable, Logger } from '@nestjs/common';
import {
  IntentionAvatar,
  AvatarSource,
} from '../interfaces/intention-avatar.interface';
import {
  MatchPool,
  MatchSegment,
  PoolingParams,
  PoolingResult,
  SegmentationResult,
} from '../interfaces/match-pool.interface';

/**
 * 比赛池化服务
 *
 * 负责将意向分身按场地+赛制+时间窗口重叠合并成比赛池，
 * 再按能力值动态分段生成比赛段。
 *
 * 核心算法：
 * 1. 意向分身构建（venue×format 笛卡尔积）
 * 2. 比赛池化（滑动窗口合并时间重叠分身）
 * 3. 能力值动态分段（ceil((max-min)/maxSpread)）
 * 4. 比赛时间参数计算（开始时间=最早截止时间点，对齐到整点/30分钟）
 */
@Injectable()
export class MatchPoolService {
  private readonly logger = new Logger(MatchPoolService.name);

  // ==================== Public API ====================

  /**
   * 从原始意向信息构建意向分身列表
   *
   * 每个意向若有 N 个场地偏好和 M 个赛制偏好，则产生 N × M 个分身。
   */
  buildAvatars(sources: AvatarSource[]): IntentionAvatar[] {
    const avatars: IntentionAvatar[] = [];

    for (const source of sources) {
      for (const venueId of source.venueIds) {
        for (const formatId of source.formatIds) {
          const timeWindowEnd = new Date(
            source.startTime.getTime() + source.acceptableWaitMinutes * 60000,
          );

          avatars.push({
            id: `${source.intentionId}_${venueId}_${formatId}`,
            intentionId: source.intentionId,
            playerId: source.playerId,
            totalAbilityScore: source.totalAbilityScore,
            venueId,
            formatId,
            startTime: source.startTime,
            acceptableWaitMinutes: source.acceptableWaitMinutes,
            durationMinutes: source.durationMinutes,
            submittedAt: source.submittedAt,
            timeWindowEnd,
          });
        }
      }
    }

    this.logger.debug(`构建 ${avatars.length} 个意向分身（来自 ${sources.length} 个意向）`);
    return avatars;
  }

  /**
   * 比赛池化：按 venue+format 分组，组内滑动窗口合并时间重叠分身
   *
   * 算法：
   * 1. 按 (venueId, formatId) 对分身分组
   * 2. 组内按 startTime 排序
   * 3. 滑动窗口：维护当前池的 poolEnd = min(all timeWindowEnd)
   *    - 新分身 startTime <= poolEnd → 加入当前池，更新 poolEnd
   *    - 新分身 startTime > poolEnd → 当前池关闭，开启新池
   */
  buildPools(avatars: IntentionAvatar[]): PoolingResult {
    // 1. 按 (venueId, formatId) 分组
    const groupMap = new Map<string, IntentionAvatar[]>();
    for (const avatar of avatars) {
      const key = `${avatar.venueId}_${avatar.formatId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(avatar);
    }

    const pools: MatchPool[] = [];
    let discardedAvatars = 0;

    // 2. 对每个 venue+format 组，滑动窗口合并时间重叠分身
    for (const [key, groupAvatars] of groupMap) {
      const [venueIdStr, formatIdStr] = key.split('_');
      const venueId = parseInt(venueIdStr, 10);
      const formatId = parseInt(formatIdStr, 10);

      // 按 startTime 排序
      const sorted = [...groupAvatars].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      );

      // 滑动窗口合并
      let currentPool: IntentionAvatar[] = [];
      let poolEnd = Infinity;

      for (const avatar of sorted) {
        const avatarStart = avatar.startTime.getTime();
        const avatarEnd = avatar.timeWindowEnd.getTime();

        if (currentPool.length === 0) {
          // 开启新池
          currentPool = [avatar];
          poolEnd = avatarEnd;
        } else if (avatarStart <= poolEnd) {
          // 时间重叠，加入当前池
          currentPool.push(avatar);
          poolEnd = Math.min(poolEnd, avatarEnd);
        } else {
          // 时间不重叠，关闭当前池，开启新池
          pools.push(this.createPool(venueId, formatId, currentPool));
          currentPool = [avatar];
          poolEnd = avatarEnd;
        }
      }

      // 关闭最后一个池
      if (currentPool.length > 0) {
        pools.push(this.createPool(venueId, formatId, currentPool));
      }
    }

    this.logger.log(
      `池化完成: ${avatars.length} 个分身 → ${pools.length} 个比赛池`,
    );

    return { pools, discardedAvatars };
  }

  /**
   * 能力值动态分段
   *
   * 规则：
   * 1. 池内所有分身按 totalAbilityScore 升序排序
   * 2. 计算组内能力值跨度：spread = maxScore - minScore
   * 3. 计算段数：segmentCount = ceil(spread / maxSpread)
   *    - 例：最高80，最低50，差30，maxSpread=12，则 ceil(30/12) = 3 段
   * 4. 将池内分身按段数均匀切分（按能力值区间切分）
   * 5. 每段形成一个独立比赛，段内人数不设上限，全部邀请
   * 6. 段内人数 < minPlayers → 该段废弃，等待下轮
   */
  segmentPool(
    pool: MatchPool,
    format: {
      id: number;
      teamCountMin: number;
      teamCountMax: number;
      teamSize: number;
      durationHours: number | null;
    },
    params: PoolingParams,
  ): SegmentationResult {
    const minPlayers = format.teamCountMin * format.teamSize;
    const maxPlayers = format.teamCountMax * format.teamSize;

    // 按能力值升序排序
    const sorted = [...pool.avatars].sort(
      (a, b) =>
        a.totalAbilityScore - b.totalAbilityScore ||
        a.intentionId - b.intentionId,
    );

    if (sorted.length < minPlayers) {
      this.logger.debug(
        `池内人数不足: venueId=${pool.venueId}, formatId=${pool.formatId}, ` +
          `avatars=${sorted.length}, minPlayers=${minPlayers}`,
      );
      return { segments: [], discardedAvatars: sorted.length };
    }

    const minScore = sorted[0].totalAbilityScore;
    const maxScore = sorted[sorted.length - 1].totalAbilityScore;
    const spread = maxScore - minScore;

    // 计算段数
    let segmentCount = 1;
    if (spread > params.maxAbilitySpread) {
      segmentCount = Math.ceil(spread / params.maxAbilitySpread);
    }

    // 确保段数不会导致每段人数不足：最大段数 = floor(sorted.length / minPlayers)
    const maxPossibleSegments = Math.floor(sorted.length / minPlayers);
    if (segmentCount > maxPossibleSegments && maxPossibleSegments >= 1) {
      segmentCount = maxPossibleSegments;
    }

    // 按段数均匀切分
    const segments: MatchSegment[] = [];

    if (segmentCount === 1) {
      // 单段：直接使用整个池
      const timeParams = this.calculateMatchTimeParams(sorted, params);
      segments.push({
        pool,
        avatars: sorted,
        matchStartTime: timeParams.matchStartTime,
        matchEndTime: timeParams.matchEndTime,
        confirmDeadline: timeParams.confirmDeadline,
        requiredPlayers: minPlayers,
        maxPlayers,
        format,
      });
    } else {
      // 多段：按能力值区间切分
      const segmentSize = Math.ceil(sorted.length / segmentCount);

      for (let i = 0; i < segmentCount; i++) {
        const startIdx = i * segmentSize;
        const endIdx = Math.min((i + 1) * segmentSize, sorted.length);
        const segmentAvatars = sorted.slice(startIdx, endIdx);

        if (segmentAvatars.length < minPlayers) {
          // 段内人数不足，废弃
          this.logger.debug(
            `段内人数不足: segment ${i + 1}/${segmentCount}, ` +
              `avatars=${segmentAvatars.length}, minPlayers=${minPlayers}`,
          );
          continue;
        }

        // 计算比赛时间参数
        const timeParams = this.calculateMatchTimeParams(segmentAvatars, params);

        segments.push({
          pool,
          avatars: segmentAvatars,
          matchStartTime: timeParams.matchStartTime,
          matchEndTime: timeParams.matchEndTime,
          confirmDeadline: timeParams.confirmDeadline,
          requiredPlayers: minPlayers,
          maxPlayers,
          format,
        });
      }
    }

    const discardedAvatars =
      sorted.length - segments.reduce((sum, s) => sum + s.avatars.length, 0);

    this.logger.debug(
      `分段完成: venueId=${pool.venueId}, formatId=${pool.formatId}, ` +
        `avatars=${sorted.length}, spread=${spread}, segments=${segmentCount}, ` +
        `created=${segments.length}, discarded=${discardedAvatars}`,
    );

    return { segments, discardedAvatars };
  }

  /**
   * 对段内分身按 intentionId 去重
   *
   * 同一意向的多个分身可能落入同一个比赛段（例如 venue1+format1 和
   * venue1+format2 的分身时间窗口重叠）。去重时保留能力值最高的分身。
   */
  deduplicateAvatars(avatars: IntentionAvatar[]): IntentionAvatar[] {
    const map = new Map<number, IntentionAvatar>();

    for (const avatar of avatars) {
      const existing = map.get(avatar.intentionId);
      if (!existing || avatar.totalAbilityScore > existing.totalAbilityScore) {
        map.set(avatar.intentionId, avatar);
      }
    }

    return Array.from(map.values());
  }

  /**
   * 对齐时间到指定粒度（整点或30分钟）
   */
  alignTimeToGranularity(date: Date, granularityMinutes: number): Date {
    const ms = date.getTime();
    const granularityMs = granularityMinutes * 60000;
    const alignedMs = Math.floor(ms / granularityMs) * granularityMs;
    return new Date(alignedMs);
  }

  // ==================== Private Helpers ====================

  private createPool(
    venueId: number,
    formatId: number,
    avatars: IntentionAvatar[],
  ): MatchPool {
    const poolStartTime = new Date(
      Math.min(...avatars.map((a) => a.startTime.getTime())),
    );
    const poolEndTime = new Date(
      Math.min(...avatars.map((a) => a.timeWindowEnd.getTime())),
    );

    return {
      venueId,
      formatId,
      avatars,
      poolStartTime,
      poolEndTime,
    };
  }

  /**
   * 计算比赛时间参数
   *
   * - 开始时间 = 段内所有分身时间窗口的最早截止时间点，对齐到整点/30分钟
   * - 持续时间 = 段内所有意向持续时间均值取整，最低2小时
   * - 确认截止时间 = 开始时间 - 1小时
   */
  private calculateMatchTimeParams(
    avatars: IntentionAvatar[],
    params: PoolingParams,
  ): {
    matchStartTime: Date;
    matchEndTime: Date;
    confirmDeadline: Date;
  } {
    // 最早截止时间点
    const earliestDeadline = new Date(
      Math.min(
        ...avatars.map((a) => a.startTime.getTime() + a.acceptableWaitMinutes * 60000),
      ),
    );

    // 对齐到指定粒度（默认30分钟）
    const matchStartTime = this.alignTimeToGranularity(
      earliestDeadline,
      params.timeAlignmentMinutes,
    );

    // 持续时间 = 均值取整，最低2小时
    const avgDuration = Math.round(
      avatars.reduce((sum, a) => sum + a.durationMinutes, 0) / avatars.length,
    );
    const durationMinutes = Math.max(avgDuration, 120);

    const matchEndTime = new Date(
      matchStartTime.getTime() + durationMinutes * 60000,
    );

    // 确认截止时间 = 开始时间 - 1小时
    const confirmDeadline = new Date(
      matchStartTime.getTime() - 60 * 60 * 1000,
    );

    return { matchStartTime, matchEndTime, confirmDeadline };
  }
}
