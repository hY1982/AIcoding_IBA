import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import {
  AbilityAdjustWeights,
  isAbilityAdjustWeights,
} from '@shared/system';

/**
 * 能力匹配调节值计算服务
 *
 * 负责从系统参数读取权重配置，根据赛后反馈中的多维度评价计算调节值。
 *
 * 设计原则：
 * - 纯计算逻辑与业务流程解耦，便于独立测试和算法调优
 * - null 维度视为中性评价（贡献值 0），权重仍参与计算，保证总权重和不变
 * - 调节值累加有上下限 [-50, 50]
 * - 权重实时从数据库读取，不缓存，保证管理员修改后即时生效
 */
@Injectable()
export class AbilityAdjustService {
  private readonly MIN_ADJUST = -50;
  private readonly MAX_ADJUST = 50;

  constructor(
    @InjectRepository(SystemParam)
    private readonly systemParamRepo: Repository<SystemParam>,
  ) {}

  /**
   * 从数据库读取并校验 ability_adjust_weights 配置
   *
   * @returns AbilityAdjustWeights 权重配置
   * @throws InternalServerErrorException 当参数不存在或结构不合法时
   */
  async getWeights(): Promise<AbilityAdjustWeights> {
    const param = await this.systemParamRepo.findOne({
      where: { paramKey: 'ability_adjust_weights' },
    });

    if (!param) {
      throw new InternalServerErrorException(
        '系统参数 ability_adjust_weights 不存在',
      );
    }

    if (!isAbilityAdjustWeights(param.paramValue)) {
      throw new InternalServerErrorException(
        '系统参数 ability_adjust_weights 结构不合法',
      );
    }

    return param.paramValue;
  }

  /**
   * 计算单条 FeedbackPlayerRating 的调节值
   *
   * null 维度视为中性评价（贡献值 0），权重仍参与计算。
   *
   * @param rating 一条球员评分记录
   * @param weights 权重配置
   * @returns number 该条评分产生的调节值（可正可负）
   */
  calculateSingleRatingAdjust(
    rating: FeedbackPlayerRating,
    weights: AbilityAdjustWeights,
  ): number {
    let adjust = 0;

    // level_match 维度
    if (rating.levelMatch !== null && rating.levelMatch !== undefined) {
      adjust += weights.level_match[rating.levelMatch];
    }

    // sportsmanship 维度
    if (rating.sportsmanship !== null && rating.sportsmanship !== undefined) {
      adjust += weights.sportsmanship[rating.sportsmanship];
    }

    // action_cleanliness 维度
    if (
      rating.actionCleanliness !== null &&
      rating.actionCleanliness !== undefined
    ) {
      adjust += weights.action_cleanliness[rating.actionCleanliness];
    }

    // punctuality 维度
    if (rating.isPunctual !== null && rating.isPunctual !== undefined) {
      const key = String(rating.isPunctual) as 'true' | 'false';
      adjust += weights.punctuality[key];
    }

    return adjust;
  }

  /**
   * 汇总一场比赛对一个球员的所有调节值
   *
   * @param ratings 指向同一 ratedPlayerId 的多条评分
   * @param weights 权重配置
   * @returns number 汇总后的调节值（已裁剪到 [-50, 50]）
   */
  calculateMatchAdjustForPlayer(
    ratings: FeedbackPlayerRating[],
    weights: AbilityAdjustWeights,
  ): number {
    const total = ratings.reduce((sum, rating) => {
      return sum + this.calculateSingleRatingAdjust(rating, weights);
    }, 0);

    return this.clampAdjustValue(total);
  }

  /**
   * 将调节值裁剪到 [-50, 50] 范围
   *
   * @param totalAdjust 原始调节值
   * @returns number 裁剪后的调节值
   */
  clampAdjustValue(totalAdjust: number): number {
    return Math.max(
      this.MIN_ADJUST,
      Math.min(this.MAX_ADJUST, totalAdjust),
    );
  }
}
