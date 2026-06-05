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
  intentionId: number;
  playerId: number;
  totalAbilityScore: number;
  submittedAt: Date;
  startTime: Date;
  endTime: Date;
  acceptableWaitMinutes: number;
}

/**
 * 匹配分组
 */
interface MatchGroup {
  venueId: number;
  formatId: number;
  timeWindow: string;
  intentions: Intention[];
}

/**
 * 候选集
 */
interface CandidateSet {
  players: PlayerIntentionInfo[];
  format: Format;
}

/**
 * 匹配引擎核心服务
 *
 * 负责将 pending 状态的比赛意向按时间重叠、场地/赛制重叠、
 * 能力值动态阈值等条件自动分组匹配，生成比赛记录并分配队伍。
 *
 * 关键设计：
 * - 参数快照：任务开始时一次性读取系统参数，确保任务内一致性
 * - 双指针滑动窗口：O(n)时间复杂度的候选集聚类
 * - 幂等更新：UPDATE ... WHERE status='pending' 防止重试时重复创建
 * - 悲观锁预订：SELECT ... FOR UPDATE 防止并发场地冲突
 * - 异常隔离：单个分组异常不影响其他分组
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

    // 3. 按 (首选venueId, 首选formatId, 时间窗口) 分组
    const groups = this.groupIntentions(intentions);
    this.logger.log(
      `扫描到 ${intentions.length} 个意向，形成 ${groups.length} 个分组`,
    );

    let matchesCreated = 0;
    let matchesFailed = 0;
    let expiredCount = 0;

    // 4. 处理每个分组
    for (const group of groups) {
      try {
        const result = await this.processGroup(group, thresholdParams);
        if (result.created) matchesCreated++;
        if (result.failed) matchesFailed++;
      } catch (error) {
        this.logger.error(
          `分组处理异常 (venueId=${group.venueId}, formatId=${group.formatId}): ${(error as Error).message}`,
        );
        matchesFailed++;
      }
    }

    // 5. 处理匹配失败的意向（过期检查）— 在事务内执行以保证数据一致性
    expiredCount = await this.processExpiredIntentionsInTransaction(intentions);

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `匹配任务完成: 扫描=${intentions.length}, 分组=${groups.length}, ` +
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

  // ==================== Private: Grouping ====================

  /**
   * 按 (首选venueId, 首选formatId, 时间窗口) 分组
   */
  private groupIntentions(intentions: Intention[]): MatchGroup[] {
    const groups = new Map<string, MatchGroup>();

    for (const intention of intentions) {
      const preferredVenue = this.getPreferredVenue(intention);
      const preferredFormat = this.getPreferredFormat(intention);

      if (!preferredVenue || !preferredFormat) continue;

      const timeWindow = this.alignTimeWindow(intention.startTime);
      const groupKey = `${preferredVenue.venueId}:${preferredFormat.formatId}:${timeWindow}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          venueId: preferredVenue.venueId,
          formatId: preferredFormat.formatId,
          timeWindow,
          intentions: [],
        });
      }

      groups.get(groupKey)!.intentions.push(intention);
    }

    return Array.from(groups.values());
  }

  /**
   * 获取首选场地（priority=1）
   */
  private getPreferredVenue(intention: Intention): IntentionVenue | undefined {
    const venues = intention.intentionVenues || [];
    return venues.sort((a, b) => a.priority - b.priority)[0];
  }

  /**
   * 获取首选赛制（priority=1）
   */
  private getPreferredFormat(
    intention: Intention,
  ): IntentionFormat | undefined {
    const formats = intention.intentionFormats || [];
    return formats.sort((a, b) => a.priority - b.priority)[0];
  }

  /**
   * 将时间对齐到30分钟粒度
   *
   * 使用本地时间格式 YYYY-MM-DDTHH:mm 避免 UTC 转换带来的时区歧义
   */
  private alignTimeWindow(date: Date): string {
    const d = new Date(date);
    d.setMinutes(Math.floor(d.getMinutes() / 30) * 30, 0, 0);
    d.setSeconds(0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ==================== Private: Process Group ====================

  /**
   * 处理单个分组
   */
  private async processGroup(
    group: MatchGroup,
    thresholdParams: MatchThresholdParams,
  ): Promise<{ created: boolean; failed: boolean }> {
    // 获取赛制信息
    const format = await this.formatRepo.findOneBy({ id: group.formatId });
    if (!format) {
      this.logger.warn(`赛制不存在: formatId=${group.formatId}`);
      return { created: false, failed: true };
    }

    // 提取球员信息
    const playerInfos = group.intentions.map((intention) => ({
      intentionId: intention.id,
      playerId: intention.playerId,
      totalAbilityScore: intention.player?.totalAbilityScore ?? 50,
      submittedAt: intention.submittedAt,
      startTime: intention.startTime,
      endTime: intention.endTime,
      acceptableWaitMinutes: intention.acceptableWaitMinutes,
    }));

    // 【HIGH-004】过滤时间窗口不兼容的球员
    const timeCompatiblePlayers = this.filterTimeCompatiblePlayers(playerInfos);

    // 计算动态阈值
    const threshold = this.calculateDynamicThreshold(
      timeCompatiblePlayers.length,
      thresholdParams,
    );

    // 双指针滑动窗口聚类
    const candidateSet = this.findBestCandidateSet(
      timeCompatiblePlayers,
      threshold,
    );

    const minPlayers = format.teamCountMin * format.teamSize;
    if (candidateSet.players.length < minPlayers) {
      this.logger.log(
        `分组候选集人数不足: ${candidateSet.players.length} < ${minPlayers} ` +
          `(venueId=${group.venueId}, formatId=${group.formatId})`,
      );
      return { created: false, failed: false };
    }

    // 创建比赛（事务内）
    await this.createMatchInTransaction(group, candidateSet, format);

    return { created: true, failed: false };
  }

  /**
   * 过滤时间窗口不兼容的球员
   *
   * 只保留时间窗口存在重叠的球员，确保比赛时间对所有参与者都可行。
   */
  private filterTimeCompatiblePlayers(
    players: PlayerIntentionInfo[],
  ): PlayerIntentionInfo[] {
    if (players.length === 0) return [];

    // 找出所有球员的时间交集
    const latestStart = new Date(
      Math.max(...players.map((p) => p.startTime.getTime())),
    );
    const earliestEnd = new Date(
      Math.min(...players.map((p) => p.endTime.getTime())),
    );

    // 只保留时间窗口与交集重叠的球员
    return players.filter(
      (p) => p.startTime <= earliestEnd && p.endTime >= latestStart,
    );
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
      format: {} as Format, // 将在上层填充
    };
  }

  // ==================== Private: Create Match (Transaction) ====================

  /**
   * 在事务内创建比赛及相关记录
   */
  private async createMatchInTransaction(
    group: MatchGroup,
    candidateSet: CandidateSet,
    format: Format,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 确定比赛时间（取所有意向时间的交集）
      const matchStartTime = this.calculateMatchStartTime(candidateSet.players);
      const matchEndTime = this.calculateMatchEndTime(
        candidateSet.players,
        format,
      );

      // 1. 创建 Match
      const matchData = {
        venueId: group.venueId,
        formatId: group.formatId,
        startTime: matchStartTime,
        endTime: matchEndTime,
        status: 'pending_confirmation' as const,
        teamCount: format.teamCountMin,
        playersPerTeam: format.teamSize,
        totalPlayers: candidateSet.players.length,
        confirmedPlayers: 0,
        depositAmount: '0.00',
        regionCode: group.intentions[0]?.regionCode,
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
        group.venueId,
        matchStartTime,
        matchEndTime,
        savedMatch.id,
      );

      this.logger.log(
        `比赛创建成功: matchId=${savedMatch.id}, ` +
          `venueId=${group.venueId}, formatId=${group.formatId}, ` +
          `players=${candidateSet.players.length}`,
      );
    });
  }

  /**
   * 计算比赛开始时间（取所有意向 startTime 的最大值）
   */
  private calculateMatchStartTime(players: PlayerIntentionInfo[]): Date {
    const times = players.map((p) => p.startTime.getTime());
    return new Date(Math.max(...times));
  }

  /**
   * 计算比赛结束时间
   */
  private calculateMatchEndTime(
    players: PlayerIntentionInfo[],
    format: Format,
  ): Date {
    const startTime = this.calculateMatchStartTime(players);
    const durationHours = format.durationHours ?? 2;
    return new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
  }

  /**
   * 预订场地时段（悲观锁）
   */
  private async bookVenueTimeSlot(
    manager: EntityManager,
    venueId: number,
    startTime: Date,
    endTime: Date,
    matchId: number,
  ): Promise<void> {
    const slotDate = startTime.toLocaleDateString('en-CA');
    const startTimeStr = startTime.toTimeString().slice(0, 8);
    const endTimeStr = endTime.toTimeString().slice(0, 8);

    // Step 1: 悲观锁锁定时段
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

    // Step 2: 更新（乐观锁二次校验）
    const updateResult = await manager.update(
      VenueTimeSlot,
      {
        id: lockedSlot.id,
        isBooked: false,
      },
      {
        isBooked: true,
        matchId,
      },
    );

    if (updateResult.affected === 0) {
      this.logger.warn(
        `场地时段预订失败（可能已被其他任务预订）: slotId=${lockedSlot.id}`,
      );
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
