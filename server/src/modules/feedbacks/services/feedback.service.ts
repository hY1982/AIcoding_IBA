import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Player } from '@modules/players/entities/player.entity';
import { AbilityAdjustService } from './ability-adjust.service';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';

/**
 * 赛后反馈服务
 *
 * 负责处理球员赛后反馈的提交、查询，以及触发能力匹配调节值的更新。
 *
 * 事务边界设计：
 * - Feedback + FeedbackPlayerRating 的创建在数据库事务内，保证原子性
 * - 调节值更新在事务外执行，避免长事务；失败不重滚反馈数据（派生数据最终一致性）
 * - 调节值更新失败时进行最多 3 次指数退避重试
 *
 * 并发安全：
 * - updatePlayerMatchAdjust 使用 QueryBuilder + version 乐观锁，禁止先 findOne 再 save
 */
/**
 * 反馈服务常量配置
 */
const FEEDBACK_CONSTANTS = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 100,
  MAX_ERROR_MESSAGE_LENGTH: 500,
} as const;

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly maxRetries = FEEDBACK_CONSTANTS.MAX_RETRIES;
  private readonly retryDelayMs = FEEDBACK_CONSTANTS.RETRY_DELAY_MS;

  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(FeedbackPlayerRating)
    private readonly ratingRepo: Repository<FeedbackPlayerRating>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer)
    private readonly matchPlayerRepo: Repository<MatchPlayer>,
    @InjectRepository(Player)
    private readonly playerRepo: Repository<Player>,
    @InjectRepository(AdjustUpdateFailure)
    private readonly failureRepo: Repository<AdjustUpdateFailure>,
    private readonly abilityAdjustService: AbilityAdjustService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 提交赛后反馈
   *
   * 流程：
   * 1. 校验比赛存在且 status = 'completed'
   * 2. 校验球员是该比赛的 confirmed 参赛球员
   * 3. 校验未重复提交
   * 4. 校验 playerRatings 不自评、评价对象是同场 confirmed 球员
   * 5. 事务内创建 Feedback + FeedbackPlayerRating
   * 6. 事务外更新各被评价球员的 matchAdjustValue（含重试）
   *
   * @param dto 创建反馈 DTO
   * @returns Feedback 创建的反馈记录
   * @throws NotFoundException 比赛不存在 / 球员未参赛
   * @throws ConflictException 比赛未结束 / 球员未确认 / 已提交过反馈
   * @throws BadRequestException 自评 / 评价非参赛球员
   */
  async createFeedback(dto: CreateFeedbackDto): Promise<Feedback> {
    // 校验比赛存在性和状态
    const match = await this.matchRepo.findOne({
      where: { id: dto.matchId },
    });
    if (!match) {
      throw new NotFoundException(`比赛不存在: matchId=${dto.matchId}`);
    }
    if (match.status !== 'completed') {
      throw new ConflictException(`比赛状态为 ${match.status}，不可提交反馈`);
    }

    // 校验球员是 confirmed 参赛球员
    const matchPlayer = await this.matchPlayerRepo.findOne({
      where: { matchId: dto.matchId, playerId: dto.playerId },
    });
    if (!matchPlayer) {
      throw new NotFoundException(
        `球员未参与该比赛: matchId=${dto.matchId}, playerId=${dto.playerId}`,
      );
    }
    if (matchPlayer.status !== 'confirmed') {
      throw new ConflictException(
        `球员未确认参赛，不可提交反馈: status=${matchPlayer.status}`,
      );
    }

    // 校验未重复提交
    const existingFeedback = await this.feedbackRepo.findOneBy({
      matchId: dto.matchId,
      playerId: dto.playerId,
    });
    if (existingFeedback) {
      throw new ConflictException(
        `已提交过反馈: matchId=${dto.matchId}, playerId=${dto.playerId}`,
      );
    }

    // 校验 playerRatings
    for (const rating of dto.playerRatings) {
      // 禁止自评
      if (rating.ratedPlayerId === dto.playerId) {
        throw new BadRequestException('不可对自己进行评价');
      }

      // 评价对象必须是同场比赛的 confirmed 球员
      const ratedMatchPlayer = await this.matchPlayerRepo.findOne({
        where: {
          matchId: dto.matchId,
          playerId: rating.ratedPlayerId,
        },
      });
      if (!ratedMatchPlayer) {
        throw new BadRequestException(
          `评价对象未参与该比赛: ratedPlayerId=${rating.ratedPlayerId}`,
        );
      }
      if (ratedMatchPlayer.status !== 'confirmed') {
        throw new BadRequestException(
          `评价对象未确认参赛: ratedPlayerId=${rating.ratedPlayerId}, status=${ratedMatchPlayer.status}`,
        );
      }
    }

    // 事务内创建 Feedback + FeedbackPlayerRating
    const feedback = await this.dataSource.transaction(async (manager) => {
      const feedbackEntity = manager.create(Feedback, {
        matchId: dto.matchId,
        playerId: dto.playerId,
        overallRating: dto.overallRating,
        overallReason: dto.overallReason ?? null,
        regionCode: match.regionCode,
      });
      const savedFeedback = await manager.save(Feedback, feedbackEntity);

      // 创建 FeedbackPlayerRating 记录
      if (dto.playerRatings && dto.playerRatings.length > 0) {
        const ratingEntities = dto.playerRatings.map((rating) =>
          manager.create(FeedbackPlayerRating, {
            feedbackId: savedFeedback.id,
            ratedPlayerId: rating.ratedPlayerId,
            levelMatch: rating.levelMatch ?? null,
            sportsmanship: rating.sportsmanship ?? null,
            actionCleanliness: rating.actionCleanliness ?? null,
            isPunctual: rating.isPunctual ?? null,
          }),
        );
        await manager.save(FeedbackPlayerRating, ratingEntities);
      }

      return savedFeedback;
    });

    this.logger.log(
      `Feedback created: id=${feedback.id}, matchId=${dto.matchId}, playerId=${dto.playerId}`,
    );

    // 事务外并行更新各被评价球员的调节值
    const adjustPromises = dto.playerRatings.map(async (rating) => {
      try {
        await this.updatePlayerMatchAdjustWithRetry(
          dto.matchId,
          rating.ratedPlayerId,
        );
      } catch (error) {
        const errorMessage = (error as Error).message;
        this.logger.error(
          `Failed to update matchAdjustValue after ${this.maxRetries} retries: matchId=${dto.matchId}, ratedPlayerId=${rating.ratedPlayerId}: ${errorMessage}`,
        );

        // 持久化失败记录，供异步补偿服务精准重试
        await this.failureRepo.save({
          matchId: dto.matchId,
          ratedPlayerId: rating.ratedPlayerId,
          errorMessage: errorMessage.slice(
            0,
            FEEDBACK_CONSTANTS.MAX_ERROR_MESSAGE_LENGTH,
          ),
          retryCount: this.maxRetries,
          resolved: false,
        });

        // 记录监控指标（后续 Module 7 接入 MetricsService）
        // this.metricsService.increment('adjust_update_failed_total', { matchId: String(dto.matchId), playerId: String(rating.ratedPlayerId) });
      }
    });
    await Promise.all(adjustPromises);

    return feedback;
  }

  /**
   * 查询某球员待反馈的比赛列表
   *
   * 条件：
   * - 比赛状态为 'completed'
   * - 球员是 confirmed 参赛球员
   * - 球员尚未提交反馈
   *
   * @param playerId 球员ID
   * @returns Match[] 待反馈的比赛列表
   */
  async findPendingFeedbacks(playerId: number): Promise<Match[]> {
    const qb = this.matchRepo
      .createQueryBuilder('match')
      .innerJoin(
        MatchPlayer,
        'mp',
        'mp.match_id = match.id AND mp.player_id = :playerId AND mp.status = :confirmedStatus',
        { playerId, confirmedStatus: 'confirmed' },
      )
      .leftJoin(
        Feedback,
        'fb',
        'fb.match_id = match.id AND fb.player_id = :playerId',
        { playerId },
      )
      .where('match.status = :completedStatus', {
        completedStatus: 'completed',
      })
      .andWhere('fb.id IS NULL');

    return qb.getMany();
  }

  /**
   * 原子更新球员调节值（含重试）
   *
   * @param matchId 比赛ID
   * @param playerId 被评价球员ID
   */
  private async updatePlayerMatchAdjustWithRetry(
    matchId: number,
    playerId: number,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.updatePlayerMatchAdjust(matchId, playerId);
        return;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `updatePlayerMatchAdjust attempt ${attempt} failed for playerId=${playerId}: ${lastError.message}`,
        );
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    throw lastError;
  }

  /**
   * 原子更新球员调节值
   *
   * 使用 QueryBuilder + version 乐观锁，禁止先 findOne 再 save。
   * 读取-计算-写入在同一原子操作中完成。
   *
   * @param matchId 比赛ID
   * @param playerId 被评价球员ID
   */
  async updatePlayerMatchAdjust(
    matchId: number,
    playerId: number,
  ): Promise<void> {
    // 读取权重配置
    const weights = await this.abilityAdjustService.getWeights();

    // 查询该球员在这场比赛中收到的所有评分
    const ratings = await this.ratingRepo
      .createQueryBuilder('rating')
      .innerJoin(Feedback, 'fb', 'fb.id = rating.feedback_id')
      .where('fb.match_id = :matchId', { matchId })
      .andWhere('rating.rated_player_id = :playerId', { playerId })
      .getMany();

    // 计算这场比赛对该球员的调节值
    const matchAdjust = this.abilityAdjustService.calculateMatchAdjustForPlayer(
      ratings,
      weights,
    );

    // 查询球员当前调节值
    const player = await this.playerRepo.findOne({
      where: { id: playerId },
      select: ['id', 'matchAdjustValue', 'version'],
    });

    if (!player) {
      this.logger.warn(
        `Player not found for adjust update: playerId=${playerId}`,
      );
      return;
    }

    const oldValue = player.matchAdjustValue;
    const newValue = this.abilityAdjustService.clampAdjustValue(
      oldValue + matchAdjust,
    );

    if (newValue === oldValue) {
      this.logger.log(
        `matchAdjustValue unchanged: playerId=${playerId}, value=${oldValue}`,
      );
      return;
    }

    // 原子更新：使用 QueryBuilder + version 乐观锁
    const updateResult = await this.playerRepo
      .createQueryBuilder()
      .update(Player)
      .set({ matchAdjustValue: newValue })
      .where('id = :id', { id: playerId })
      .andWhere('version = :version', { version: player.version })
      .execute();

    if (updateResult.affected === 0) {
      throw new ConflictException(
        `调节值更新冲突: playerId=${playerId}，请重试`,
      );
    }

    // 结构化审计日志
    this.logger.log({
      event: 'match_adjust_value_updated',
      matchId,
      playerId,
      oldValue,
      newValue,
      delta: newValue - oldValue,
      version: player.version,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
