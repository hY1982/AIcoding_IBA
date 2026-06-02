/**
 * 球员能力值计算逻辑（前端版本）
 *
 * 从后端 server/src/modules/players/data/percentile-datasets.ts
 * 和 server/src/modules/players/services/ability-calculation.service.ts
 * 移植而来，用于可视化验证界面独立计算。
 */

export type Gender = 'male' | 'female';

export interface PercentileDataPoint {
  value: number;
  percentile: number;
}

export interface PercentileDataset {
  height: PercentileDataPoint[];
  weight: PercentileDataPoint[];
  wingspan: PercentileDataPoint[];
  standingReach: PercentileDataPoint[];
  jumpingReach: PercentileDataPoint[];
  basketballAge: PercentileDataPoint[];
  age: PercentileDataPoint[];
}

// 男性百分位数据集
export const MALE_PERCENTILE_DATASET: PercentileDataset = {
  height: [
    { value: 160, percentile: 5 },
    { value: 170, percentile: 25 },
    { value: 175, percentile: 50 },
    { value: 180, percentile: 75 },
    { value: 190, percentile: 95 },
  ],
  weight: [
    { value: 55, percentile: 5 },
    { value: 65, percentile: 25 },
    { value: 72, percentile: 50 },
    { value: 80, percentile: 75 },
    { value: 95, percentile: 95 },
  ],
  wingspan: [
    { value: 165, percentile: 5 },
    { value: 175, percentile: 25 },
    { value: 180, percentile: 50 },
    { value: 188, percentile: 75 },
    { value: 198, percentile: 95 },
  ],
  standingReach: [
    { value: 210, percentile: 5 },
    { value: 220, percentile: 25 },
    { value: 228, percentile: 50 },
    { value: 235, percentile: 75 },
    { value: 245, percentile: 95 },
  ],
  jumpingReach: [
    { value: 270, percentile: 5 },
    { value: 285, percentile: 25 },
    { value: 300, percentile: 50 },
    { value: 315, percentile: 75 },
    { value: 330, percentile: 95 },
  ],
  basketballAge: [
    { value: 0, percentile: 5 },
    { value: 2, percentile: 45 },
    { value: 5, percentile: 85 },
    { value: 8, percentile: 95 },
    { value: 15, percentile: 90 },
  ],
  age: [
    { value: 16, percentile: 30 },
    { value: 22, percentile: 80 },
    { value: 26, percentile: 100 },
    { value: 32, percentile: 70 },
    { value: 40, percentile: 35 },
  ],
};

// 女性百分位数据集
export const FEMALE_PERCENTILE_DATASET: PercentileDataset = {
  height: [
    { value: 150, percentile: 5 },
    { value: 158, percentile: 25 },
    { value: 162, percentile: 50 },
    { value: 166, percentile: 75 },
    { value: 172, percentile: 95 },
  ],
  weight: [
    { value: 45, percentile: 5 },
    { value: 52, percentile: 25 },
    { value: 58, percentile: 50 },
    { value: 65, percentile: 75 },
    { value: 75, percentile: 95 },
  ],
  wingspan: [
    { value: 152, percentile: 5 },
    { value: 160, percentile: 25 },
    { value: 165, percentile: 50 },
    { value: 170, percentile: 75 },
    { value: 178, percentile: 95 },
  ],
  standingReach: [
    { value: 198, percentile: 5 },
    { value: 205, percentile: 25 },
    { value: 210, percentile: 50 },
    { value: 216, percentile: 75 },
    { value: 224, percentile: 95 },
  ],
  jumpingReach: [
    { value: 245, percentile: 5 },
    { value: 255, percentile: 25 },
    { value: 265, percentile: 50 },
    { value: 275, percentile: 75 },
    { value: 288, percentile: 95 },
  ],
  basketballAge: [
    { value: 0, percentile: 5 },
    { value: 2, percentile: 45 },
    { value: 4, percentile: 85 },
    { value: 7, percentile: 95 },
    { value: 12, percentile: 90 },
  ],
  age: [
    { value: 16, percentile: 30 },
    { value: 21, percentile: 80 },
    { value: 25, percentile: 100 },
    { value: 30, percentile: 70 },
    { value: 38, percentile: 35 },
  ],
};

export function getDataset(gender: Gender): PercentileDataset {
  return gender === 'male' ? MALE_PERCENTILE_DATASET : FEMALE_PERCENTILE_DATASET;
}

export function getPercentile(value: number, dataPoints: PercentileDataPoint[]): number {
  if (dataPoints.length === 0) {
    return 50;
  }

  if (value <= dataPoints[0].value) {
    return 0;
  }

  if (value >= dataPoints[dataPoints.length - 1].value) {
    return 100;
  }

  for (let i = 0; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i];
    const next = dataPoints[i + 1];

    if (value >= current.value && value <= next.value) {
      if (next.value === current.value) {
        return current.percentile;
      }
      const ratio = (value - current.value) / (next.value - current.value);
      return current.percentile + ratio * (next.percentile - current.percentile);
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
function getAgePercentile(age: number, dataPoints: PercentileDataPoint[]): number {
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
function getBasketballAgePercentile(
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

  const ratio = (basketballAge - lower.value) / (upper.value - lower.value);
  return lower.percentile + ratio * (upper.percentile - lower.percentile);
}

function getMedianValue(dataPoints: PercentileDataPoint[]): number {
  const medianPoint = dataPoints.reduce((closest, current) =>
    Math.abs(current.percentile - 50) < Math.abs(closest.percentile - 50)
      ? current
      : closest,
  );
  return medianPoint.value;
}

export interface AbilityWeights {
  height: number;
  weight: number;
  wingspan: number;
  standing_reach: number;
  jumping_reach: number;
  basketball_age: number;
  age: number;
}

export const DEFAULT_WEIGHTS: AbilityWeights = {
  height: 0.20,
  weight: 0.10,
  wingspan: 0.15,
  standing_reach: 0.15,
  jumping_reach: 0.20,
  basketball_age: 0.15,
  age: 0.05,
};

export interface AttributeBreakdown {
  name: string;
  rawValue: number;
  percentile: number;
  weight: number;
  contribution: number;
}

export interface CalculationResult {
  score: number;
  percentiles: Record<string, number>;
  breakdown: AttributeBreakdown[];
}

export interface PlayerAttributes {
  age: number;
  basketballAge: number;
  gender: Gender;
  height: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
}

export function calculateBaseAbility(
  player: PlayerAttributes,
  weights: AbilityWeights = DEFAULT_WEIGHTS,
): CalculationResult {
  const dataset = getDataset(player.gender);

  const scores = {
    height: getPercentile(player.height, dataset.height),
    weight: getPercentile(
      player.weight ?? getMedianValue(dataset.weight),
      dataset.weight,
    ),
    wingspan: getPercentile(
      player.wingspan ?? getMedianValue(dataset.wingspan),
      dataset.wingspan,
    ),
    standingReach: getPercentile(
      player.standingReach ?? getMedianValue(dataset.standingReach),
      dataset.standingReach,
    ),
    jumpingReach: getPercentile(
      player.jumpingReach ?? getMedianValue(dataset.jumpingReach),
      dataset.jumpingReach,
    ),
    basketballAge: getBasketballAgePercentile(player.basketballAge, dataset.basketballAge),
    age: getAgePercentile(player.age, dataset.age),
  };

  const breakdown: AttributeBreakdown[] = [
    { name: '身高', rawValue: player.height, percentile: scores.height, weight: weights.height, contribution: scores.height * weights.height },
    { name: '体重', rawValue: player.weight ?? getMedianValue(dataset.weight), percentile: scores.weight, weight: weights.weight, contribution: scores.weight * weights.weight },
    { name: '臂展', rawValue: player.wingspan ?? getMedianValue(dataset.wingspan), percentile: scores.wingspan, weight: weights.wingspan, contribution: scores.wingspan * weights.wingspan },
    { name: '站立摸高', rawValue: player.standingReach ?? getMedianValue(dataset.standingReach), percentile: scores.standingReach, weight: weights.standing_reach, contribution: scores.standingReach * weights.standing_reach },
    { name: '弹跳摸高', rawValue: player.jumpingReach ?? getMedianValue(dataset.jumpingReach), percentile: scores.jumpingReach, weight: weights.jumping_reach, contribution: scores.jumpingReach * weights.jumping_reach },
    { name: '球龄', rawValue: player.basketballAge, percentile: scores.basketballAge, weight: weights.basketball_age, contribution: scores.basketballAge * weights.basketball_age },
    { name: '年龄', rawValue: player.age, percentile: scores.age, weight: weights.age, contribution: scores.age * weights.age },
  ];

  const total = breakdown.reduce((sum, item) => sum + item.contribution, 0);

  return {
    score: Math.round(total * 100) / 100,
    percentiles: scores,
    breakdown,
  };
}

/**
 * 获取能力值对应的颜色
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#faad14'; // 金色
  if (score >= 70) return '#52c41a'; // 绿色
  if (score >= 50) return '#1890ff'; // 蓝色
  if (score >= 30) return '#fa8c16'; // 橙色
  return '#f5222d'; // 红色
}

/**
 * 获取能力值等级标签
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return 'SS';
  if (score >= 70) return 'S';
  if (score >= 50) return 'A';
  if (score >= 30) return 'B';
  return 'C';
}
