import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MatchThresholdParams, isMatchThresholdParams } from '@shared/system';
import { VenueBookingService } from '@modules/venues/services/venue-booking.service';
import { MatchingResult } from '../interfaces/matching-result.interface';

/**
 * 球员意向信息（用于匹配计算）
 */
interface PlayerIntentionInfo {
  intention: Intention;
  intentionId: number;
  playerId: number;
  totalAbilityScore: number;
  submittedAt: Date;
  startTime: Date;
  endTime: Date;
  acceptableWaitMinutes: number;
  durationMinutes: number;
  venueIds: number[];
  formatIds: number[];
  venuePriorities: Map<number, number>;  // venueId → priority (1~3)
  formatPriorities: Map<number, number>; // formatId → priority (1~3)
}

/**
 * 两两兼容性评分结果
 */
interface CompatibilityResult {
  compatible: boolean;
  timeScore: number;
  venueScore: number;
  formatScore: number;
  durationScore: number;
  abilityScore: number;
  totalScore: number;
}

/**
 * v2.0 候选比赛组（venue+format 分组，意向可跨组）
 */
interface CandidateGroup {
  venueId: number;
  formatId: number;
  format: Format;
  players: PlayerIntentionInfo[];
  matchStartTime: Date;
  matchEndTime: Date;
  confirmDeadline: Date;
}

/**
 * 评分权重（架构预留：后续可迁移到 system_params 表支持运行时动态调整）
 */
const MATCH_SCORE_WEIGHTS = {
  time: 0.30,
  venue: 0.20,
  format: 0.20,
  duration: 0.10,
  ability: 0.20,
};

/** 时间粗分区剪枝阈值：startTime 差距超过此值直接标记不兼容 */
const TIME_COARSE_PARTITION_MS = 6 * 60 * 60 * 1000; // 6 小时

/** 段内能力值最大跨度默认值（超过则不分段，等待更多兼容意向），可通过 system_params 覆盖 */
const DEFAULT_MAX_ABILITY_SPREAD = 12;

/**
 * 匹配引擎核心服务 — v2.0 异步预匹配模式
 *
 * 负责将 pending 状态的意向按五维兼容性评分（时间窗口交集、
 * 场地/赛制偏好交集、时长容差、能力值接近度）自动分组，
 * 创建候选比赛（pending_players），意向保持 pending 不锁定。
 *
 * v2.0 核心变化：
 * - 同一意向可参与多个候选比赛（无上限）
 * - 创建比赛时不分队（延后到 confirmed）
 * - 创建比赛时不预订场地（延后到场地方确认）
 * - 意向保持 pending（不改为 matched）
 * - 邀请人数无上限（所有符合条件的意向全部邀请）
 * - 满员后由 MatchConfirmationService 触发场地确认
 *
 * 关键设计：
 * - 参数快照：任务开始时一次性读取系统参数，保证任务内一致性
 * - 预计算兼容性矩阵：O(n²) 一次性计算所有对的评分
 * - venue+format 分组：允许意向跨组参与多个候选比赛
 * - 幂等性：MatchPlayer 使用 ON CONFLICT DO NOTHING 防重复
 * - 异常隔离：单个组异常不影响其他组
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

    // 2. 查询 pending 意向
    const intentions = await this.fetchPendingIntentions(regionCode);

    if (intentions.length === 0) {
      this.logger.log('无 pending 意向需要匹配');
      return {
        intentionsScanned: 0,
        groupsProcessed: 0,
        matchesCreated: 0,
        matchesFailed: 0,
        expiredCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // 3. 构建 PlayerIntentionInfo 索引
    const playerInfos = this.buildPlayerInfos(intentions);

    // 4. 预计算兼容性矩阵
    const matrix = this.buildCompatibilityMatrix(playerInfos);

    // 5. v2.0: 按 venue+format 分组创建候选比赛
    const groups = await this.buildCandidateGroups(playerInfos, matrix, thresholdParams);
    this.logger.log(
      `扫描到 ${intentions.length} 个意向，形成 ${groups.length} 个候选组（含能力值分段），maxSpread=${thresholdParams.max_ability_spread ?? DEFAULT_MAX_ABILITY_SPREAD}`,
    );

    let matchesCreated = 0;
    let matchesFailed = 0;

    // 6. 处理每个候选组
    for (const group of groups) {
      try {
        const created = await this.processCandidateGroup(group);
        if (created) matchesCreated++;
      } catch (error) {
        this.logger.error(
          `候选组处理异常 (venueId=${group.venueId}, formatId=${group.formatId}): ${(error as Error).message}`,
        );
        matchesFailed++;
      }
    }

    // 7. 处理过期意向
    const expiredCount = await this.processExpiredIntentions(intentions);

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `匹配任务完成: 扫描=${intentions.length}, 组=${groups.length}, ` +
        `成功=${matchesCreated}, 失败=${matchesFailed}, 过期=${expiredCount}, 耗时=${durationMs}ms`,
    );

    return {
      intentionsScanned: intentions.length,
      groupsProcessed: groups.length,
      matchesCreated,
      matchesFailed,
      expiredCount,
      durationMs,
    };
  }

  // ==================== Private: Parameter Loading ====================

  /**
   * 加载匹配阈值参数（参数快照）
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

  // ==================== Private: Fetch Intentions ====================

  /**
   * 查询 pending 意向（含关联数据）
   */
  private async fetchPendingIntentions(
    regionCode?: string,
  ): Promise<Intention[]> {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);

    const qb = this.intentionRepo
      .createQueryBuilder('intention')
      .leftJoinAndSelect('intention.intentionVenues', 'intentionVenue')
      .leftJoinAndSelect('intention.intentionFormats', 'intentionFormat')
      .leftJoinAndSelect('intention.player', 'player')
      .where('intention.status = :status', { status: 'pending' })
      .andWhere('intention.start_time > :oneHourLater', { oneHourLater })
      .orderBy('intention.start_time', 'ASC')
      .addOrderBy('intentionVenue.priority', 'ASC')
      .addOrderBy('intentionFormat.priority', 'ASC');

    if (regionCode) {
      qb.andWhere('intention.region_code = :regionCode', { regionCode });
    }

    return qb.getMany();
  }

  // ==================== Private: Build Player Infos ====================

  /**
   * 从 Intention 提取偏好数据，构建 PlayerIntentionInfo 数组
   * 空值防御：intentionVenues/intentionFormats 为 null 时视为空数组
   */
  private buildPlayerInfos(intentions: Intention[]): PlayerIntentionInfo[] {
    const infos: PlayerIntentionInfo[] = [];
    for (const intention of intentions) {
      const venues = intention.intentionVenues ?? [];
      const formats = intention.intentionFormats ?? [];
      if (venues.length === 0 || formats.length === 0) {
        this.logger.warn(
          `意向 ${intention.id} 缺少场地或赛制偏好，跳过`,
        );
        continue;
      }
      const venuePriorities = new Map<number, number>();
      const venueIds: number[] = [];
      for (const iv of venues) {
        venueIds.push(iv.venueId);
        venuePriorities.set(iv.venueId, iv.priority);
      }
      const formatPriorities = new Map<number, number>();
      const formatIds: number[] = [];
      for (const ifmt of formats) {
        formatIds.push(ifmt.formatId);
        formatPriorities.set(ifmt.formatId, ifmt.priority);
      }
      infos.push({
        intention,
        intentionId: intention.id,
        playerId: intention.playerId,
        totalAbilityScore: intention.player?.totalAbilityScore ?? 50,
        submittedAt: intention.submittedAt,
        startTime: intention.startTime,
        endTime: intention.endTime,
        acceptableWaitMinutes: intention.acceptableWaitMinutes,
        durationMinutes: intention.durationMinutes,
        venueIds,
        formatIds,
        venuePriorities,
        formatPriorities,
      });
    }
    return infos;
  }

  // ==================== Private: Compatibility Scoring ====================

  /**
   * 五维兼容性评分 + 硬约束门控
   *
   * 硬约束（任一则不兼容）：时间窗口交集、场地交集、赛制交集
   * 软评分：时长容差、能力值接近度（仅影响总分）
   */
  private computeMatchScore(
    a: PlayerIntentionInfo,
    b: PlayerIntentionInfo,
  ): CompatibilityResult {
    const zero: CompatibilityResult = {
      compatible: false,
      timeScore: 0, venueScore: 0, formatScore: 0,
      durationScore: 0, abilityScore: 0, totalScore: 0,
    };

    // 1. 时间窗口交集：[startTime, startTime + acceptableWaitMinutes]
    const aWaitEnd = a.startTime.getTime() + a.acceptableWaitMinutes * 60000;
    const bWaitEnd = b.startTime.getTime() + b.acceptableWaitMinutes * 60000;
    const overlapStart = Math.max(a.startTime.getTime(), b.startTime.getTime());
    const overlapEnd = Math.min(aWaitEnd, bWaitEnd);
    if (overlapStart > overlapEnd) return zero;
    const overlapMinutes = (overlapEnd - overlapStart) / 60000;
    const maxPossibleOverlap = Math.min(
      a.acceptableWaitMinutes, b.acceptableWaitMinutes,
    );
    const timeScore = maxPossibleOverlap > 0
      ? overlapMinutes / maxPossibleOverlap : 0;

    // 2. 场地偏好交集
    const commonVenues = a.venueIds.filter((v) => b.venueIds.includes(v));
    if (commonVenues.length === 0) return zero;
    let bestVenuePriority = Infinity;
    for (const v of commonVenues) {
      const pMax = Math.max(
        a.venuePriorities.get(v) ?? 1,
        b.venuePriorities.get(v) ?? 1,
      );
      if (pMax < bestVenuePriority) bestVenuePriority = pMax;
    }
    const venueScore = 1.0 / bestVenuePriority;

    // 3. 赛制偏好交集
    const commonFormats = a.formatIds.filter((f) => b.formatIds.includes(f));
    if (commonFormats.length === 0) return zero;
    let bestFormatPriority = Infinity;
    for (const f of commonFormats) {
      const pMax = Math.max(
        a.formatPriorities.get(f) ?? 1,
        b.formatPriorities.get(f) ?? 1,
      );
      if (pMax < bestFormatPriority) bestFormatPriority = pMax;
    }
    const formatScore = 1.0 / bestFormatPriority;

    // 4. 时长容差（纯软评分，无硬约束）
    const maxDur = Math.max(a.durationMinutes, b.durationMinutes);
    const durDiff = Math.abs(a.durationMinutes - b.durationMinutes);
    const durationScore = maxDur > 0 ? 1.0 - durDiff / maxDur : 1.0;

    // 5. 能力值接近度（纯软评分，无硬约束）
    const abilityDiff = Math.abs(a.totalAbilityScore - b.totalAbilityScore);
    const abilityScore = Math.max(0, 1.0 - abilityDiff / 50);

    // 加权总分
    const totalScore =
      MATCH_SCORE_WEIGHTS.time * timeScore +
      MATCH_SCORE_WEIGHTS.venue * venueScore +
      MATCH_SCORE_WEIGHTS.format * formatScore +
      MATCH_SCORE_WEIGHTS.duration * durationScore +
      MATCH_SCORE_WEIGHTS.ability * abilityScore;

    return {
      compatible: true,
      timeScore, venueScore, formatScore,
      durationScore, abilityScore, totalScore,
    };
  }

  // ==================== Private: Compatibility Matrix ====================

  /**
   * 预计算所有意向对的兼容性评分（O(n²)）
   * 时间粗分区剪枝：startTime 差距 > 6 小时的对直接标记不兼容
   */
  private buildCompatibilityMatrix(
    infos: PlayerIntentionInfo[],
  ): CompatibilityResult[][] {
    const n = infos.length;
    const incompatible: CompatibilityResult = {
      compatible: false,
      timeScore: 0, venueScore: 0, formatScore: 0,
      durationScore: 0, abilityScore: 0, totalScore: 0,
    };
    const matrix: CompatibilityResult[][] = Array.from(
      { length: n }, () => Array.from({ length: n }, () => ({ ...incompatible })),
    );

    for (let i = 0; i < n; i++) {
      matrix[i][i] = {
        compatible: true,
        timeScore: 1, venueScore: 1, formatScore: 1,
        durationScore: 1, abilityScore: 1, totalScore: 1,
      };
      for (let j = i + 1; j < n; j++) {
        // 时间粗分区剪枝
        const timeDiff = Math.abs(
          infos[i].startTime.getTime() - infos[j].startTime.getTime(),
        );
        if (timeDiff > TIME_COARSE_PARTITION_MS) continue;

        const score = this.computeMatchScore(infos[i], infos[j]);
        matrix[i][j] = score;
        matrix[j][i] = score;
      }
    }
    return matrix;
  }

  // ==================== Private: Candidate Groups (v2.0) ====================

  /**
   * v2.0: 按 venue+format 分组，构建候选比赛组。
   *
   * 核心变化：
   * - 同一意向可出现在多个 venue+format 组中（无排他约束）
   * - 所有符合兼容性的意向全部邀请（无上限）
   * - 组内人数 >= minPlayers 才创建候选比赛
   *
   * 分组策略：
   * 1. 按 (venueId, formatId) 对意向进行分组
   * 2. 每个意向可属于多个组（遍历其所有 venue+format 组合）
   * 3. 过滤掉人数不足 minPlayers 的组
   * 4. 计算每组的比赛时间和 confirmDeadline
   */
  private async buildCandidateGroups(
    infos: PlayerIntentionInfo[],
    matrix: CompatibilityResult[][],
    thresholdParams: MatchThresholdParams,
  ): Promise<CandidateGroup[]> {
    // 构建 intentionId → index 映射
    const idToIndex = new Map<number, number>();
    for (let i = 0; i < infos.length; i++) {
      idToIndex.set(infos[i].intentionId, i);
    }

    // 1. 按 (venueId, formatId) 分组，意向可跨组
    const groupMap = new Map<string, PlayerIntentionInfo[]>();
    for (const info of infos) {
      for (const venueId of info.venueIds) {
        for (const formatId of info.formatIds) {
          const key = `${venueId}_${formatId}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, []);
          }
          groupMap.get(key)!.push(info);
        }
      }
    }

    // 2. 过滤 + 能力值分段 + 构建候选组
    const groups: CandidateGroup[] = [];

    for (const [key, players] of groupMap) {
      const [venueIdStr, formatIdStr] = key.split('_');
      const venueId = parseInt(venueIdStr, 10);
      const formatId = parseInt(formatIdStr, 10);

      try {
        // 获取赛制信息
        const format = await this.formatRepo.findOneBy({ id: formatId });
        if (!format) continue;

        const minPlayers = format.teamCountMin * format.teamSize;
        const maxPlayers = format.teamCountMax * format.teamSize;

        // 使用兼容性矩阵过滤组内不兼容的成员（仅硬约束过滤）
        const compatiblePlayers = this.filterCompatiblePlayers(
          players,
          matrix,
          idToIndex,
        );

        if (compatiblePlayers.length < minPlayers) {
          continue;
        }

        // v2.1: 按能力值排序后分段，每段形成一个独立的候选比赛
        const maxSpread = thresholdParams.max_ability_spread ?? DEFAULT_MAX_ABILITY_SPREAD;
        const segments = this.segmentByAbility(
          compatiblePlayers,
          maxPlayers,
          minPlayers,
          maxSpread,
        );

        for (const segment of segments) {
          const matchStartTime = new Date(
            Math.max(...segment.map((p) => p.startTime.getTime())),
          );
          const matchDuration = this.calculateMatchDuration(segment, format);
          const matchEndTime = new Date(matchStartTime.getTime() + matchDuration);
          const confirmDeadline = new Date(matchStartTime.getTime() - 60 * 60 * 1000);

          groups.push({
            venueId,
            formatId,
            format,
            players: segment,
            matchStartTime,
            matchEndTime,
            confirmDeadline,
          });
        }
      } catch (error) {
        this.logger.error(
          `候选组构建异常 (venueId=${venueId}, formatId=${formatId}): ${(error as Error).message}`,
        );
        // 单个组异常不影响其他组的构建
      }
    }

    // 5. 按组内平均兼容性评分降序排序（优先处理质量最高的组）
    groups.sort((a, b) => {
      const scoreA = this.avgGroupScore(a.players, matrix, idToIndex);
      const scoreB = this.avgGroupScore(b.players, matrix, idToIndex);
      return scoreB - scoreA;
    });

    return groups;
  }

  /**
   * 使用兼容性矩阵过滤组内成员。
   *
   * v2.1: 仅保留兼容性矩阵的「半数兼容」硬约束过滤。
   * 能力值过滤已下沉到 segmentByAbility 分段算法中。
   */
  private filterCompatiblePlayers(
    players: PlayerIntentionInfo[],
    matrix: CompatibilityResult[][],
    idToIndex: Map<number, number>,
  ): PlayerIntentionInfo[] {
    if (players.length <= 2) return players;

    // 保留与组内至少半数其他成员兼容的球员（仅硬约束过滤）
    return players.filter((player, i) => {
      const playerIdx = idToIndex.get(player.intentionId)!;
      let compatibleCount = 0;
      let totalChecked = 0;

      for (let j = 0; j < players.length; j++) {
        if (i === j) continue;
        const otherIdx = idToIndex.get(players[j].intentionId)!;
        totalChecked++;
        if (matrix[playerIdx][otherIdx].compatible) {
          compatibleCount++;
        }
      }

      return compatibleCount >= Math.floor(totalChecked / 2);
    });
  }

  /**
   * v2.1: 按能力值排序后分段，每段 spread ≤ maxSpread。
   * 返回多个子数组，每个子数组可形成一个候选比赛。
   *
   * 能力值差距过大的意向不会进入同一分段，而是等待后续轮次
   * 与更兼容的新意向匹配（或过期退出）。
   */
  private segmentByAbility(
    players: PlayerIntentionInfo[],
    maxPlayers: number,
    minPlayers: number,
    maxSpread: number,
  ): PlayerIntentionInfo[][] {
    if (players.length < minPlayers) return [];

    // 按能力值升序，相同能力值按 intentionId 保证稳定性
    const sorted = [...players].sort(
      (a, b) => a.totalAbilityScore - b.totalAbilityScore || a.intentionId - b.intentionId,
    );

    const segments: PlayerIntentionInfo[][] = [];
    let i = 0;

    while (i < sorted.length) {
      const end = Math.min(i + maxPlayers, sorted.length);
      const segment = sorted.slice(i, end);

      if (segment.length < minPlayers) break; // 尾部不足，等待下轮

      const spread =
        segment[segment.length - 1].totalAbilityScore - segment[0].totalAbilityScore;

      if (spread <= maxSpread) {
        segments.push(segment);
      }
      // spread 超标：丢弃该段（等待更多兼容意向加入后下轮重新匹配）

      i += maxPlayers;
    }

    return segments;
  }

  /**
   * 计算组内平均兼容性评分
   */
  private avgGroupScore(
    infos: PlayerIntentionInfo[],
    matrix: CompatibilityResult[][],
    idToIndex: Map<number, number>,
  ): number {
    if (infos.length <= 1) return 0;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < infos.length; i++) {
      for (let j = i + 1; j < infos.length; j++) {
        const idxI = idToIndex.get(infos[i].intentionId)!;
        const idxJ = idToIndex.get(infos[j].intentionId)!;
        sum += matrix[idxI][idxJ].totalScore;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  // ==================== Private: Dynamic Threshold ====================

  /**
   * 计算动态阈值
   *
   * threshold = max(min_threshold, base_threshold - intention_count * factor)
   */
  calculateDynamicThreshold(
    intentionCount: number,
    params: MatchThresholdParams,
  ): number {
    const dynamicValue =
      params.base_threshold - intentionCount * params.intention_count_factor;
    return Math.max(params.min_threshold, dynamicValue);
  }

  // ==================== Private: Match Duration ====================

  /**
   * 计算比赛时长
   *
   * v2.0: matchDuration = max(median(all participants' durationMinutes), 120)
   * 兼顾各方偏好，最低120分钟保证比赛可行性。
   */
  private calculateMatchDuration(
    players: PlayerIntentionInfo[],
    format: Format,
  ): number {
    const durations = players.map((p) => p.durationMinutes).sort((a, b) => a - b);
    const median = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 120;
    const durationMinutes = Math.max(median, 120);
    return durationMinutes * 60 * 1000; // 返回毫秒
  }

  // ==================== Private: Process Candidate Group ====================

  /**
   * v2.0: 处理单个候选组 — 创建候选比赛。
   *
   * 关键变化：
   * - 不分队（延后到 confirmed）
   * - 不预订场地（延后到场地方确认）
   * - 不更新意向状态（保持 pending）
   * - 乐观场地可用性检查（允许少量误判）
   * - MatchPlayer 包含 intentionId
   * - 使用 ON CONFLICT DO NOTHING 防重复
   */
  private async processCandidateGroup(
    group: CandidateGroup,
  ): Promise<boolean> {
    // 乐观场地可用性检查（不加锁，允许少量误判）
    const slotDate = group.matchStartTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const startTimeStr = group.matchStartTime.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Shanghai', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const endTimeStr = group.matchEndTime.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Shanghai', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    const isAvailable = await this.venueBookingService.checkAvailability(
      group.venueId,
      slotDate,
      startTimeStr,
      endTimeStr,
    );

    if (!isAvailable) {
      this.logger.log(
        `场地不可用（乐观检查）: venueId=${group.venueId}, date=${slotDate}, ` +
          `time=${startTimeStr}-${endTimeStr}，跳过`,
      );
      return false;
    }

    // 事务内创建比赛 + MatchPlayer
    await this.createMatchInTransaction(group);

    return true;
  }

  // ==================== Private: Create Match (Transaction) ====================

  /**
   * v2.0: 在事务内创建候选比赛及 MatchPlayer。
   *
   * - 不分队（teamNumber=null）
   * - 不创建 MatchTeam（延后到 confirmed）
   * - MatchPlayer 包含 intentionId
   * - 使用 ON CONFLICT DO NOTHING 防并发重复
   */
  private async createMatchInTransaction(
    group: CandidateGroup,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 1. 创建 Match（候选比赛）
      const matchData = {
        venueId: group.venueId,
        formatId: group.formatId,
        startTime: group.matchStartTime,
        endTime: group.matchEndTime,
        status: 'pending_players' as const,
        teamCount: group.format.teamCountMin,
        playersPerTeam: group.format.teamSize,
        requiredPlayers: group.format.teamCountMin * group.format.teamSize,
        confirmedPlayers: 0,
        confirmDeadline: group.confirmDeadline,
        venueConfirmDeadline: null,
        depositAmount: '0.00',
        regionCode: group.players[0]?.intention.regionCode,
      };

      const match = manager.create(Match, matchData);
      const savedMatch = await manager.save(Match, match);

      // 2. 创建 MatchPlayer（所有邀请球员，intentionId 关联）
      for (const player of group.players) {
        const matchPlayerData = {
          matchId: savedMatch.id,
          playerId: player.playerId,
          intentionId: player.intentionId,
          teamNumber: null,       // v2.0: 不分队，延后到 confirmed
          status: 'invited' as const,
          depositPaid: false,
          depositOrderNo: null,
          confirmedAt: null,
        };

        // 使用 create + save（ON CONFLICT 由 unique constraint 兜底）
        try {
          const mp = manager.create(MatchPlayer, matchPlayerData);
          await manager.save(MatchPlayer, mp);
        } catch (error) {
          // ON CONFLICT DO NOTHING: 并发场景下可能重复，静默忽略
          if ((error as any)?.code === '23505') {
            this.logger.debug(
              `MatchPlayer 已存在，跳过: matchId=${savedMatch.id}, playerId=${player.playerId}`,
            );
          } else {
            throw error;
          }
        }
      }

      // v2.0: 不更新意向状态（意向保持 pending，可参与多个候选比赛）
      // v2.0: 不预订场地（延后到场地方确认阶段由 VenueBookingService.bookSlot 执行）
      // v2.0: 不分队（延后到比赛 confirmed 后由蛇形选秀执行）

      this.logger.log(
        `候选比赛创建成功: matchId=${savedMatch.id}, ` +
          `venueId=${group.venueId}, formatId=${group.formatId}, ` +
          `invited=${group.players.length}, required=${matchData.requiredPlayers}, ` +
          `confirmDeadline=${group.confirmDeadline.toISOString()}`,
      );
    });
  }

  // ==================== Private: Expired Intentions ====================

  /**
   * 处理过期意向
   *
   * - expiresAt <= now() → 状态改为 'expired'
   * - 在事务内执行以保证数据一致性
   * - 与调度器 (MatchExpirationScheduler) 行为保持一致：到期即过期，无提前量
   */
  private async processExpiredIntentions(
    intentions: Intention[],
  ): Promise<number> {
    const now = new Date();

    // 筛选出已过期的意向（expiresAt <= now）
    const expiredIntentions = intentions.filter(
      (intention) =>
        intention.status === 'pending' &&
        intention.expiresAt <= now,
    );

    if (expiredIntentions.length === 0) {
      return 0;
    }

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
