import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MatchThresholdParams, isMatchThresholdParams } from '@shared/system';
import { TeamBalancerService } from './team-balancer.service';
import { MatchingResult } from '../interfaces/matching-result.interface';

/**
 * 球员意向信息（用于匹配计算）
 */
interface PlayerIntentionInfo {
  intention: Intention; // 原始意向引用，避免索引错位
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
 * 兼容簇（替代原 MatchGroup）
 */
interface CompatibleCluster {
  intentions: Intention[];
  playerInfos: PlayerIntentionInfo[];
  venueId: number;
  formatId: number;
  timeOverlapStart: Date;
  timeOverlapEnd: Date;
}

/**
 * 候选集
 */
interface CandidateSet {
  players: PlayerIntentionInfo[];
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

/**
 * 匹配引擎核心服务
 *
 * 负责将 pending 状态的比赛意向按五维兼容性评分（时间窗口交集、
 * 场地/赛制偏好交集、时长容差、能力值接近度）自动聚类匹配，
 * 生成比赛记录并分配队伍。
 *
 * 关键设计：
 * - 参数快照：任务开始时一次性读取系统参数，确保任务内一致性
 * - 预计算兼容性矩阵：O(n²) 一次性计算所有对的评分，避免重复计算
 * - 贪心团聚类：团约束确保簇内每对成员都互相兼容
 * - 双指针滑动窗口：O(n) 时间复杂度的能力值候选集聚类
 * - 幂等更新：UPDATE ... WHERE status='pending' 防止重试时重复创建
 * - 悲观锁预订：SELECT ... FOR UPDATE 防止并发场地冲突
 * - 异常隔离：单个簇异常不影响其他簇
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
    private readonly teamBalancer: TeamBalancerService,
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

    // 4. 预计算兼容性矩阵 + 贪心团聚类
    const matrix = this.buildCompatibilityMatrix(playerInfos);
    const clusters = this.buildCompatibleClusters(playerInfos, matrix);
    this.logger.log(
      `扫描到 ${intentions.length} 个意向，形成 ${clusters.length} 个兼容簇`,
    );

    let matchesCreated = 0;
    let matchesFailed = 0;
    let expiredCount = 0;

    // 5. 处理每个簇
    for (const cluster of clusters) {
      try {
        const result = await this.processCluster(cluster, thresholdParams);
        if (result.created) matchesCreated++;
        if (result.failed) matchesFailed++;
      } catch (error) {
        this.logger.error(
          `簇处理异常 (venueId=${cluster.venueId}, formatId=${cluster.formatId}): ${(error as Error).message}`,
        );
        matchesFailed++;
      }
    }

    // 6. 处理未匹配意向的过期检查 — 排除已被簇处理匹配的意向
    const matchedIntentionIds = new Set(
      clusters.flatMap((c) => c.playerInfos.map((p) => p.intentionId)),
    );
    const unmatchedIntentions = intentions.filter(
      (i) => !matchedIntentionIds.has(i.id),
    );
    expiredCount = await this.processExpiredIntentionsInTransaction(unmatchedIntentions);

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `匹配任务完成: 扫描=${intentions.length}, 簇=${clusters.length}, ` +
        `成功=${matchesCreated}, 失败=${matchesFailed}, 过期=${expiredCount}, 耗时=${durationMs}ms`,
    );

    return {
      intentionsScanned: intentions.length,
      groupsProcessed: clusters.length,
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

  // ==================== Private: Cluster Selection ====================

  /**
   * 加权投票选场地：按 1/priority 加权求和，平局选 venueId 较小者
   */
  private selectBestVenue(infos: PlayerIntentionInfo[]): number {
    // 优先从全局交集（所有成员都有的场地）中投票；若为空退化为全量
    let common = new Set(infos[0].venueIds);
    for (let i = 1; i < infos.length; i++) {
      common = new Set(infos[i].venueIds.filter((v) => common.has(v)));
    }
    const votePool = common.size > 0 ? [...common] : infos.flatMap((i) => i.venueIds);

    const scores = new Map<number, number>();
    for (const info of infos) {
      for (const v of info.venueIds) {
        if (!votePool.includes(v)) continue;
        const priority = info.venuePriorities.get(v) ?? 1;
        scores.set(v, (scores.get(v) ?? 0) + 1.0 / priority);
      }
    }
    let bestVenue = -1;
    let bestScore = -1;
    for (const [venueId, score] of scores) {
      if (score > bestScore || (score === bestScore && venueId < bestVenue)) {
        bestScore = score;
        bestVenue = venueId;
      }
    }
    return bestVenue;
  }

  /**
   * 加权投票选赛制：按 1/priority 加权求和，平局选 formatId 较小者
   */
  private selectBestFormat(infos: PlayerIntentionInfo[]): number {
    // 优先从全局交集（所有成员都有的赛制）中投票；若为空退化为全量
    let common = new Set(infos[0].formatIds);
    for (let i = 1; i < infos.length; i++) {
      common = new Set(infos[i].formatIds.filter((f) => common.has(f)));
    }
    const votePool = common.size > 0 ? [...common] : infos.flatMap((i) => i.formatIds);

    const scores = new Map<number, number>();
    for (const info of infos) {
      for (const f of info.formatIds) {
        if (!votePool.includes(f)) continue;
        const priority = info.formatPriorities.get(f) ?? 1;
        scores.set(f, (scores.get(f) ?? 0) + 1.0 / priority);
      }
    }
    let bestFormat = -1;
    let bestScore = -1;
    for (const [formatId, score] of scores) {
      if (score > bestScore || (score === bestScore && formatId < bestFormat)) {
        bestScore = score;
        bestFormat = formatId;
      }
    }
    return bestFormat;
  }

  /**
   * 计算簇的全局时间窗口交集
   * 时间窗口定义：[startTime, startTime + acceptableWaitMinutes]
   */
  private computeOverlapWindow(infos: PlayerIntentionInfo[]): {
    start: Date; end: Date; isEmpty: boolean;
  } {
    const latestStart = Math.max(
      ...infos.map((p) => p.startTime.getTime()),
    );
    const earliestEnd = Math.min(
      ...infos.map((p) => p.startTime.getTime() + p.acceptableWaitMinutes * 60000),
    );
    const isEmpty = latestStart > earliestEnd;
    return {
      start: new Date(latestStart),
      end: new Date(earliestEnd),
      isEmpty,
    };
  }

  // ==================== Private: Greedy Clique Clustering ====================

  /**
   * 贪心团聚类算法
   *
   * 团约束：簇内每对成员都必须互相兼容，确保所有参与者对时间/场地/赛制
   * 达成共识。不会出现"A 想去场地 X、C 只想去场地 Y 却被分到同一场"的情况。
   * MVP 阶段保持严格团约束，后续版本可探索"近似团"松弛策略。
   */
  private buildCompatibleClusters(
    infos: PlayerIntentionInfo[],
    matrix: CompatibilityResult[][],
  ): CompatibleCluster[] {
    const n = infos.length;
    // 构建 intentionId -> index 映射
    const idToIndex = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      idToIndex.set(infos[i].intentionId, i);
    }

    // 按 submittedAt 升序排序（等待最久的优先处理）
    const sortedIndices = Array.from({ length: n }, (_, i) => i);
    sortedIndices.sort(
      (a, b) => infos[a].submittedAt.getTime() - infos[b].submittedAt.getTime(),
    );

    const matched = new Set<number>(); // 已匹配的意向索引
    const clusters: CompatibleCluster[] = [];

    for (const seedIdx of sortedIndices) {
      if (matched.has(seedIdx)) continue;

      // 开始新簇
      const groupIndices: number[] = [seedIdx];
      matched.add(seedIdx);

      // 找所有与 seed 兼容的未匹配候选，按 totalScore 降序
      const candidates: Array<{ idx: number; score: number }> = [];
      for (const j of sortedIndices) {
        if (matched.has(j) || j === seedIdx) continue;
        const score = matrix[seedIdx][j].totalScore;
        if (score > 0) candidates.push({ idx: j, score });
      }
      candidates.sort((a, b) => b.score - a.score);

      // 贪心扩展：团约束 - candidate 必须与 group 中每个现有成员兼容
      for (const { idx: candidateIdx } of candidates) {
        if (matched.has(candidateIdx)) continue;
        const compatibleWithAll = groupIndices.every(
          (memberIdx) => matrix[candidateIdx][memberIdx].totalScore > 0,
        );
        if (compatibleWithAll) {
          groupIndices.push(candidateIdx);
          matched.add(candidateIdx);
        }
      }

      // 构建簇的 PlayerIntentionInfo 和 Intention
      const clusterInfos = groupIndices.map((i) => infos[i]);
      const clusterIntentions = groupIndices.map((i) => infos[i].intention);

      // 校验全局时间交集
      const overlap = this.computeOverlapWindow(clusterInfos);
      if (overlap.isEmpty) {
        this.logger.log(
          `簇内全局时间交集为空（${clusterInfos.length} 个意向），跳过`,
        );
        continue;
      }

      // 投票选场地和赛制
      const venueId = this.selectBestVenue(clusterInfos);
      const formatId = this.selectBestFormat(clusterInfos);

      clusters.push({
        intentions: clusterIntentions,
        playerInfos: clusterInfos,
        venueId,
        formatId,
        timeOverlapStart: overlap.start,
        timeOverlapEnd: overlap.end,
      });
    }

    // 按簇内平均 totalScore 降序排序（优先处理质量最高的簇）
    clusters.sort((a, b) => {
      const avgA = this.avgClusterScore(a.playerInfos, matrix, idToIndex);
      const avgB = this.avgClusterScore(b.playerInfos, matrix, idToIndex);
      return avgB - avgA;
    });

    return clusters;
  }

  /**
   * 计算簇内平均兼容性评分
   */
  private avgClusterScore(
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

  // ==================== Private: Process Cluster ====================

  /**
   * 处理单个兼容簇
   */
  private async processCluster(
    cluster: CompatibleCluster,
    thresholdParams: MatchThresholdParams,
  ): Promise<{ created: boolean; failed: boolean }> {
    // 获取赛制信息
    const format = await this.formatRepo.findOneBy({ id: cluster.formatId });
    if (!format) {
      this.logger.warn(`赛制不存在: formatId=${cluster.formatId}`);
      return { created: false, failed: true };
    }

    // 计算动态阈值
    const threshold = this.calculateDynamicThreshold(
      cluster.playerInfos.length,
      thresholdParams,
    );

    // 双指针滑动窗口聚类（按能力值筛选最优子集）
    const candidateSet = this.findBestCandidateSet(
      cluster.playerInfos,
      threshold,
    );

    const minPlayers = format.teamCountMin * format.teamSize;
    if (candidateSet.players.length < minPlayers) {
      this.logger.log(
        `簇候选集人数不足: ${candidateSet.players.length} < ${minPlayers} ` +
          `(venueId=${cluster.venueId}, formatId=${cluster.formatId})`,
      );
      return { created: false, failed: false };
    }

    // 创建比赛（事务内）
    await this.createMatchInTransaction(cluster, candidateSet, format);

    return { created: true, failed: false };
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

  // ==================== Private: Candidate Set (Two-Pointer) ====================

  /**
   * 双指针滑动窗口寻找最佳候选集
   *
   * 算法：
   * 1. 按能力值降序 + submittedAt升序排序
   * 2. 用 left/right 指针维护窗口
   * 3. 当窗口内 maxScore - minScore <= threshold 时右移 right
   * 4. 否则右移 left
   * 5. 记录所有满足条件的窗口，选择人数最多的
   *
   * 时间复杂度：O(n log n) 排序 + O(n) 滑动窗口
   *
   * 关键优化：由于数组已按能力值降序排序，窗口 [left, right] 内的
   * 最大值就是 sorted[left]，最小值就是 sorted[right]。
   * 因此 max - min = sorted[left].totalAbilityScore - sorted[right].totalAbilityScore
   * 无需遍历窗口计算 min/max。
   */
  private findBestCandidateSet(
    players: PlayerIntentionInfo[],
    threshold: number,
  ): CandidateSet {
    // 按能力值降序排序（同分按 submittedAt 升序，等待久的优先）
    const sorted = [...players].sort((a, b) => {
      const scoreDiff = b.totalAbilityScore - a.totalAbilityScore;
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    let bestStart = 0;
    let bestEnd = 0;
    let left = 0;

    for (let right = 0; right < sorted.length; right++) {
      // 利用已排序特性：窗口内 max = sorted[left], min = sorted[right]
      while (
        left < right &&
        sorted[left].totalAbilityScore - sorted[right].totalAbilityScore >
          threshold
      ) {
        left++;
      }

      // 窗口有效，检查是否是最大的
      if (right - left > bestEnd - bestStart) {
        bestStart = left;
        bestEnd = right;
      }
    }

    return {
      players: sorted.slice(bestStart, bestEnd + 1),
    };
  }

  // ==================== Private: Create Match (Transaction) ====================

  /**
   * 在事务内创建比赛及相关记录
   */
  private async createMatchInTransaction(
    cluster: CompatibleCluster,
    candidateSet: CandidateSet,
    format: Format,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 确定比赛时间（取实际参赛球员的最晚 startTime，与 endTime 基准一致）
      const matchStartTime = new Date(
        Math.max(...candidateSet.players.map((p) => p.startTime.getTime())),
      );
      const matchEndTime = this.calculateMatchEndTime(
        candidateSet.players,
        format,
      );

      // 1. 创建 Match
      const matchData = {
        venueId: cluster.venueId,
        formatId: cluster.formatId,
        startTime: matchStartTime,
        endTime: matchEndTime,
        status: 'pending_confirmation' as const,
        teamCount: format.teamCountMin,
        playersPerTeam: format.teamSize,
        totalPlayers: candidateSet.players.length,
        confirmedPlayers: 0,
        depositAmount: '0.00',
        regionCode: cluster.intentions[0]?.regionCode,
      };

      const match = manager.create(Match, matchData);
      const savedMatch = await manager.save(Match, match);

      // 2. 蛇形分队
      const playerPicks = candidateSet.players.map((p) => ({
        id: p.playerId,
        totalAbilityScore: p.totalAbilityScore,
      }));

      const teams = this.teamBalancer.snakeDraft({
        players: playerPicks,
        format,
      });

      // 3. 创建 MatchTeam
      for (const team of teams) {
        const teamData = {
          matchId: savedMatch.id,
          teamNumber: team.teamNumber,
          teamName: team.teamName ?? `队伍${team.teamNumber}`,
          avgAbility: team.avgAbility,
        };
        await manager.save(MatchTeam, manager.create(MatchTeam, teamData));
      }

      // 4. 创建 MatchPlayer
      for (const team of teams) {
        for (const player of team.players) {
          const matchPlayerData = {
            matchId: savedMatch.id,
            playerId: player.id,
            teamNumber: team.teamNumber,
            status: 'invited' as const,
            isReserve: false,
            depositPaid: false,
          };
          await manager.save(
            MatchPlayer,
            manager.create(MatchPlayer, matchPlayerData),
          );
        }
      }

      // 5. 【幂等更新】更新意向状态
      for (const playerInfo of candidateSet.players) {
        const updateResult = await manager.update(
          Intention,
          { id: playerInfo.intentionId, status: 'pending' },
          { status: 'matched', matchId: savedMatch.id },
        );

        if (updateResult.affected === 0) {
          this.logger.warn(
            `意向状态更新失败（可能已被处理）: intentionId=${playerInfo.intentionId}`,
          );
        }
      }

      // 6. 【悲观锁预订】场地时段
      await this.bookVenueTimeSlot(
        manager,
        cluster.venueId,
        matchStartTime,
        matchEndTime,
        savedMatch.id,
      );

      this.logger.log(
        `比赛创建成功: matchId=${savedMatch.id}, ` +
          `venueId=${cluster.venueId}, formatId=${cluster.formatId}, ` +
          `players=${candidateSet.players.length}`,
      );
    });
  }

  /**
   * 计算比赛结束时间
   */
  private calculateMatchEndTime(
    players: PlayerIntentionInfo[],
    format: Format,
  ): Date {
    const startTimeMs = Math.max(...players.map((p) => p.startTime.getTime()));
    const durationHours = format.durationHours ?? 2;
    return new Date(startTimeMs + durationHours * 60 * 60 * 1000);
  }

  /**
   * 预订场地时段（悲观锁 + 时段拆分）
   *
   * 找到包含比赛时间的空闲时段，删除原时段，拆分为：
   * - 比赛前空闲段（如果有）
   * - 比赛占用段（is_booked=true, matchId）
   * - 比赛后空闲段（如果有）
   */
  private async bookVenueTimeSlot(
    manager: EntityManager,
    venueId: number,
    startTime: Date,
    endTime: Date,
    matchId: number,
  ): Promise<void> {
    // 时区修复：用 Asia/Shanghai 提取日期和时间
    const slotDate = startTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const startTimeStr = startTime.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Shanghai', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const endTimeStr = endTime.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Shanghai', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    // Step 1: 悲观锁锁定包含比赛时间的空闲时段
    const lockedSlot = await manager
      .createQueryBuilder(VenueTimeSlot, 'slot')
      .where('slot.venue_id = :venueId', { venueId })
      .andWhere('slot.slot_date = :slotDate', { slotDate })
      .andWhere('slot.start_time <= :startTime', { startTime: startTimeStr })
      .andWhere('slot.end_time >= :endTime', { endTime: endTimeStr })
      .andWhere('slot.is_booked = false')
      .setLock('pessimistic_write')
      .getOne();

    if (!lockedSlot) {
      this.logger.warn(
        `未找到可用的场地时段: venueId=${venueId}, date=${slotDate}, ` +
          `time=${startTimeStr}-${endTimeStr}`,
      );
      return;
    }

    // Step 2: 删除原大时段
    await manager.delete(VenueTimeSlot, { id: lockedSlot.id });

    // Step 3: 插入拆分后的时段
    const segments: Array<{
      venueId: number; slotDate: string;
      startTime: string; endTime: string;
      isBooked: boolean; matchId: number | null;
    }> = [];

    // 比赛前空闲段
    if (lockedSlot.startTime < startTimeStr) {
      segments.push({
        venueId, slotDate,
        startTime: lockedSlot.startTime, endTime: startTimeStr,
        isBooked: false, matchId: null,
      });
    }

    // 比赛占用段
    segments.push({
      venueId, slotDate,
      startTime: startTimeStr, endTime: endTimeStr,
      isBooked: true, matchId,
    });

    // 比赛后空闲段
    if (endTimeStr < lockedSlot.endTime) {
      segments.push({
        venueId, slotDate,
        startTime: endTimeStr, endTime: lockedSlot.endTime,
        isBooked: false, matchId: null,
      });
    }

    for (const seg of segments) {
      await manager.insert(VenueTimeSlot, seg);
    }
  }

  // ==================== Private: Expired Intentions ====================

  /**
   * 处理过期意向（在事务内执行以保证数据一致性）
   *
   * - 距离 expiresAt <= 30分钟 → 状态改为 'expired'
   */
  private async processExpiredIntentionsInTransaction(
    intentions: Intention[],
  ): Promise<number> {
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

    // 筛选出需要过期的意向
    const expiredIntentions = intentions.filter(
      (intention) =>
        intention.status === 'pending' &&
        intention.expiresAt <= thirtyMinutesLater,
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
