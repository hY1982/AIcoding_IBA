import { Injectable, Logger } from '@nestjs/common';
import { BaseAbilityWeights } from '@shared/system';
import { AbilityWeightsProvider } from '../interfaces/ability-weights.provider';

/**
 * 权重和校验允许的浮点误差
 */
const WEIGHT_SUM_TOLERANCE = 0.01;

/**
 * 默认权重提供者
 *
 * 返回硬编码的MVP默认权重配置。
 * 当数据库不可用时作为 fallback 使用。
 *
 * 自检：构造函数中校验权重和是否为 1.0，防止硬编码错误。
 */
@Injectable()
export class DefaultWeightsProvider implements AbilityWeightsProvider {
  private readonly logger = new Logger(DefaultWeightsProvider.name);

  private readonly defaultWeights: BaseAbilityWeights = {
    height: 0.20,
    weight: 0.10,
    wingspan: 0.15,
    standing_reach: 0.15,
    jumping_reach: 0.20,
    basketball_age: 0.15,
    age: 0.05,
  };

  constructor() {
    const sum =
      this.defaultWeights.height +
      this.defaultWeights.weight +
      this.defaultWeights.wingspan +
      this.defaultWeights.standing_reach +
      this.defaultWeights.jumping_reach +
      this.defaultWeights.basketball_age +
      this.defaultWeights.age;

    if (Math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE) {
      this.logger.error(
        `默认权重配置错误：权重和=${sum.toFixed(4)}≠1.0，请立即修正`,
      );
    }
  }

  getWeights(): BaseAbilityWeights {
    return { ...this.defaultWeights };
  }
}
