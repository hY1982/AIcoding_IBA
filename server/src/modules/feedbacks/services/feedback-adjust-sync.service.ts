import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { Player } from '@modules/players/entities/player.entity';
import { AbilityAdjustService } from './ability-adjust.service';

/**
 * 反馈调节值异步补偿服务
 *
 * 用于扫描并补偿因临时故障导致未更新的调节值。
 * 提供 `syncPendingAdjustUpdates()` 方法，供后续 Module 7 定时任务调用。
 *
 * 补偿策略：
 * - 遍历所有有 feedback 记录的球员
 * - 重新计算其所有历史 feedback 的累计调节值
 * - 若与当前 match_adjust_value 不一致，则原子更新
 */
@Injectable()
export class FeedbackAdjustSyncService {
  private readonly logger = new Logger(FeedbackAdjustSyncService.name);

  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(FeedbackPlayerRating)
    private readonly ratingRepo: Repository<FeedbackPlayerRating>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    private readonly abilityAdjustService: AbilityAdjustService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 扫描并补偿未更新的调节值
   *
   * @returns { processed: number; failed: number }
   */
  async syncPendingAdjustUpdates(): Promise<{
    processed: number;
    failed: number;
  }> {
    const weights = await this.abilityAdjustService.getWeights();

    // 获取所有有被评价 feedback 的球员ID
    const ratedPlayerIds = await this.ratingRepo
      .createQueryBuilder('rating')
      .select('DISTINCT rating.rated_player_id', 'playerId')
      .getRawMany<{ playerId: number }>();

    let processed = 0;
    let failed = 0;

    for (const { playerId } of ratedPlayerIds) {
      try {
        const updated = await this.syncPlayerAdjustValue(playerId, weights);
        if (updated) {
          processed++;
        }
      } catch (error) {
        failed++;
        this.logger.error(
          `Sync failed for playerId=${playerId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Sync complete: processed=${processed}, failed=${failed}, total=${ratedPlayerIds.length}`,
    );

    return { processed, failed };
  }

  /**
   * 同步单个球员的调节值
   *
   * @param playerId 球员ID
   * @param weights 权重配置（可选，避免重复读取）
   * @returns boolean 是否执行了更新
   */
  async syncPlayerAdjustValue(
    playerId: number,
    weights?: Awaited<ReturnType<AbilityAdjustService['getWeights']>>,
  ): Promise<boolean> {
    const w = weights ?? (await this.abilityAdjustService.getWeights());

    // 查询该球员收到的所有评分，并直接关联 matchId（避免 N+1）
    // 使用 getMany() 保持 TypeORM 枚举/boolean 类型转换，同时通过 addSelect 获取 matchId
    const ratingsWithMatch = await this.ratingRepo
      .createQueryBuilder('rating')
      .innerJoin(Feedback, 'fb', 'fb.id = rating.feedback_id')
      .addSelect('fb.matchId', 'matchId')
      .where('rating.rated_player_id = :playerId', { playerId })
      .getMany();

    // 按比赛分组计算调节值
    const ratingsByMatch = new Map<number, FeedbackPlayerRating[]>();
    for (const rating of ratingsWithMatch) {
      // 通过 feedback 关联获取 matchId
      const feedback = await this.feedbackRepo.findOne({
        where: { id: rating.feedbackId },
        select: ['matchId'],
      });
      if (!feedback) continue;

      const list = ratingsByMatch.get(feedback.matchId) ?? [];
      list.push(rating);
      ratingsByMatch.set(feedback.matchId, list);
    }

    // 计算累计调节值
    let totalAdjust = 0;
    for (const [, matchRatings] of ratingsByMatch) {
      totalAdjust +=
        this.abilityAdjustService.calculateMatchAdjustForPlayer(matchRatings, w);
    }
    totalAdjust = this.abilityAdjustService.clampAdjustValue(totalAdjust);

    // 查询当前值
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
      select: ['id', 'matchAdjustValue', 'version'],
    });

    if (!player) {
      this.logger.warn(`Player not found for sync: playerId=${playerId}`);
      return false;
    }

    const currentValue = player.matchAdjustValue;
    if (currentValue === totalAdjust) {
      return false;
    }

    // 原子更新
    const updateResult = await this.playerRepo
      .createQueryBuilder()
      .update(Player)
      .set({ matchAdjustValue: totalAdjust })
      .where('id = :id', { id: playerId })
      .andWhere('version = :version', { version: player.version })
      .execute();

    if (updateResult.affected === 0) {
      this.logger.warn(
        `Sync update conflict for playerId=${playerId}, will retry next run`,
      );
      return false;
    }

    this.logger.log({
      event: 'match_adjust_value_synced',
      playerId,
      oldValue: currentValue,
      newValue: totalAdjust,
      delta: totalAdjust - currentValue,
    });

    return true;
  }
}
