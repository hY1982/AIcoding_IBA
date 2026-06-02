/**
 * 球员身体属性百分位数据集
 *
 * ## 数据来源说明（Known Assumption）
 *
 * 当前数据集基于中国国民体质监测公开数据**合理估算**，属于已知假设，存在以下局限：
 * - 数据来源为一般人群体质监测，非篮球专项人群，可能存在系统性偏差
 * - 篮球运动员的身体素质分布（如臂展、起跳摸高）与普通人群差异显著
 * - 女性数据为基于男性数据的性别差异调整，未使用独立的女性篮球运动员样本
 * - 年龄分布假设为16-40岁，可能未覆盖所有目标用户群体
 *
 * ## 未来校准规划
 * - MVP上线后收集真实用户数据，定期（每季度）分析各指标的分布情况
 * - 当样本量达到统计显著性（每个性别≥1000人）时，用真实数据替换估算数据
 * - 校准过程应通过A/B测试验证：对比新旧数据集对匹配成功率的影响
 * - 数据集版本化管理，保留历史版本以便回滚
 *
 * ## 数据格式
 * 每个指标提供一组按 value 升序排列的 `(value, percentile)` 数据点。
 * 百分位计算采用线性插值法：
 *   percentile = p1 + (value - v1) * (p2 - p1) / (v2 - v1)
 * 边界处理：
 *   - value <= 最小数据点 → 返回 0
 *   - value >= 最大数据点 → 返回 100
 *   - 精确匹配数据点 → 返回对应百分位
 */

import { Gender } from '@shared/player';

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

// 男性百分位数据集（估算值，基于中国国民体质监测公开数据）
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

// 女性百分位数据集（估算值，基于男性数据按性别差异调整）
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
