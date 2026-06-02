import { Inject, Injectable, Logger } from '@nestjs/common';
import { BaseAbilityWeights } from '@shared/system';
import { Gender, PlayerAttributes } from '@shared/player';
import {
  getDataset,
  PercentileDataPoint,
} from '../data/percentile-datasets';
import {
  AbilityWeightsProvider,
  ABILITY_WEIGHTS_PROVIDER,
} from '../interfaces/ability-weights.provider';
import { DefaultWeightsProvider } from '../providers/default-weights.provider';

/**
 * 权重和校验允许的浮点误差
 */
const WEIGHT_SUM_TOLERANCE = 0.01;

/**
 * 能力值计算服务
 *
 * 根据球员的生理和篮球属性计算基础能力值。
 * MVP阶段采用统一的身体属性权重，不含位置适配度计算。
 *
 * 安全网：计算前校验权重和是否为1.0，校验失败回退到 DefaultWeightsProvider。
 */
@Injectable()
export class AbilityCalculationService {
  private readonly logger = new Logger(AbilityCalculationService.name);

  constructor(
    @Inject(ABILITY_WEIGHTS_PROVIDER)
    private readonly weightsProvider: AbilityWeightsProvider,
    private readonly defaultProvider: DefaultWeightsProvider,
  ) {}

  /**
   * 计算球员基础能力值
   *
   * 流程：
   * 1. 通过 weightsProvider 获取权重
   * 2. 校验权重和是否为1.0（安全网）
   * 3. 校验失败 → 回退到 DefaultWeightsProvider
   * 4. 对每个指标调用 getPercentile() 获取百分位打分
   * 5. 加权求和，返回 0-100 的得分
   */
  calculateBaseAbility(player: PlayerAttributes): number {
    let weights = this.weightsProvider.getWeights();

    // P0安全网：校验权重和是否为1.0
    if (!this.validateWeights(weights)) {
      const sum =
        weights.height +
        weights.weight +
        weights.wingspan +
        weights.standing_reach +
        weights.jumping_reach +
        weights.basketball_age +
        weights.age;
      this.logger.warn(
        `权重配置校验失败（和=${sum.toFixed(4)}≠1.0），回退到默认权重`,
      );
      weights = this.defaultProvider.getWeights();
    }

    const g = player.gender;
    const dataset = getDataset(g);

    const scores = {
      height: this.getPercentile(player.height, dataset.height),
      weight: this.getPercentile(
        player.weight ?? this.getMedianValue(dataset.weight),
        dataset.weight,
      ),
      wingspan: this.getPercentile(
        player.wingspan ?? this.getMedianValue(dataset.wingspan),
        dataset.wingspan,
      ),
      standingReach: this.getPercentile(
        player.standingReach ?? this.getMedianValue(dataset.standingReach),
        dataset.standingReach,
      ),
      jumpingReach: this.getPercentile(
        player.jumpingReach ?? this.getMedianValue(dataset.jumpingReach),
        dataset.jumpingReach,
      ),
      basketballAge: this.getBasketballAgePercentile(
        player.basketballAge,
        dataset.basketballAge,
      ),
      age: this.getAgePercentile(player.age, dataset.age),
    };

    let total = 0;
    total += scores.height * weights.height;
    total += scores.weight * weights.weight;
    total += scores.wingspan * weights.wingspan;
    total += scores.standingReach * weights.standing_reach;
    total += scores.jumpingReach * weights.jumping_reach;
    total += scores.basketballAge * weights.basketball_age;
    total += scores.age * weights.age;

    return Math.round(total * 100) / 100;
  }

  /**
   * 获取指标的中位数（用于可空字段默认值）
   */
  private getMedianValue(dataPoints: PercentileDataPoint[]): number {
    // 找百分位最接近50的数据点
    const medianPoint = dataPoints.reduce((closest, current) =>
      Math.abs(current.percentile - 50) < Math.abs(closest.percentile - 50)
        ? current
        : closest,
    );
    return medianPoint.value;
  }

  /**
   * 百分位查询（线性插值）
   */
  getPercentile(value: number, dataPoints: PercentileDataPoint[]): number {
    if (dataPoints.length === 0) {
      return 50;
    }

    // 小于最小值 → 返回 0
    if (value <= dataPoints[0].value) {
      return 0;
    }

    // 大于最大值 → 返回 100
    if (value >= dataPoints[dataPoints.length - 1].value) {
      return 100;
    }

    // 查找相邻数据点
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const current = dataPoints[i];
      const next = dataPoints[i + 1];

      if (value >= current.value && value <= next.value) {
        if (next.value === current.value) {
          return current.percentile;
        }
        // 线性插值
        const ratio =
          (value - current.value) / (next.value - current.value);
        return (
          current.percentile +
          ratio * (next.percentile - current.percentile)
        );
      }
    }

    return 50;
  }

  /**
   * 年龄百分位查询（倒U型曲线）
   *
   * 篮球运动员表现呈倒U型：青少年期上升，26-28岁巅峰，之后下降。
   * 不依赖数据点的单调性，直接查找距离目标值最近的两个点做插值。
   */
  private getAgePercentile(age: number, dataPoints: PercentileDataPoint[]): number {
    if (dataPoints.length === 0) {
      return 50;
    }

    const minAge = dataPoints[0].value;
    const maxAge = dataPoints[dataPoints.length - 1].value;

    // 边界：小于最小年龄返回最小年龄的百分位
    if (age <= minAge) {
      return dataPoints[0].percentile;
    }

    // 边界：大于最大年龄返回最大年龄的百分位
    if (age >= maxAge) {
      return dataPoints[dataPoints.length - 1].percentile;
    }

    // 查找距离目标年龄最近的两个数据点
    let lower = dataPoints[0];
    let upper = dataPoints[dataPoints.length - 1];

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const current = dataPoints[i];
      const next = dataPoints[i + 1];
      if (age >= current.value && age <= next.value) {
        lower = current;
        upper = next;
        break;
      }
    }

    if (upper.value === lower.value) {
      return lower.percentile;
    }

    const ratio = (age - lower.value) / (upper.value - lower.value);
    return lower.percentile + ratio * (upper.percentile - lower.percentile);
  }

  /**
   * 球龄百分位查询（S型饱和曲线）
   *
   * 篮球技能学习呈S型曲线：前2年快速入门，2-5年稳步成长，
   * 5-8年接近饱和，8年后边际收益递减。
   * 不依赖数据点的单调性，直接查找距离目标值最近的两个点做插值。
   */
  private getBasketballAgePercentile(
    basketballAge: number,
    dataPoints: PercentileDataPoint[],
  ): number {
    if (dataPoints.length === 0) {
      return 50;
    }

    const minYears = dataPoints[0].value;
    const maxYears = dataPoints[dataPoints.length - 1].value;

    // 边界：小于最小值返回最小值的百分位
    if (basketballAge <= minYears) {
      return dataPoints[0].percentile;
    }

    // 边界：大于最大值返回最大值的百分位
    if (basketballAge >= maxYears) {
      return dataPoints[dataPoints.length - 1].percentile;
    }

    // 查找距离目标球龄最近的两个数据点
    let lower = dataPoints[0];
    let upper = dataPoints[dataPoints.length - 1];

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const current = dataPoints[i];
      const next = dataPoints[i + 1];
      if (basketballAge >= current.value && basketballAge <= next.value) {
        lower = current;
        upper = next;
        break;
      }
    }

    if (upper.value === lower.value) {
      return lower.percentile;
    }

    const ratio =
      (basketballAge - lower.value) / (upper.value - lower.value);
    return lower.percentile + ratio * (upper.percentile - lower.percentile);
  }

  /**
   * 校验权重和是否为1.0（允许 ±0.01 浮点误差）
   */
  validateWeights(weights: BaseAbilityWeights): boolean {
    const sum =
      weights.height +
      weights.weight +
      weights.wingspan +
      weights.standing_reach +
      weights.jumping_reach +
      weights.basketball_age +
      weights.age;

    return Math.abs(sum - 1.0) <= WEIGHT_SUM_TOLERANCE;
  }
}
