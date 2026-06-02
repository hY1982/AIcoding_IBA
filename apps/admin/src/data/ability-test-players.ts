import type { Gender } from '@/lib/ability-calculation';

export interface TestPlayer {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  basketballAge: number;
  height: number;
  weight: number;
  wingspan: number;
  standingReach: number;
  jumpingReach: number;
  category: string;
  description: string;
}

export const testPlayers: TestPlayer[] = [
  // 极值球员
  {
    id: 'extreme-max',
    name: '全能巨星',
    gender: 'male',
    age: 40,
    basketballAge: 12,
    height: 220,
    weight: 120,
    wingspan: 220,
    standingReach: 260,
    jumpingReach: 350,
    category: '极值',
    description: '所有属性均超出数据集最大值，能力值应为 100',
  },
  {
    id: 'extreme-min',
    name: '新手小白',
    gender: 'male',
    age: 10,
    basketballAge: 0,
    height: 150,
    weight: 40,
    wingspan: 150,
    standingReach: 190,
    jumpingReach: 240,
    category: '极值',
    description: '所有属性均低于数据集最小值，能力值应为 0',
  },

  // 平均值球员
  {
    id: 'average',
    name: '普通球员',
    gender: 'male',
    age: 26,
    basketballAge: 3,
    height: 175,
    weight: 72,
    wingspan: 180,
    standingReach: 228,
    jumpingReach: 300,
    category: '平均',
    description: '所有属性接近中位数，能力值应接近 50',
  },

  // 单项突出球员
  {
    id: ' standout-height',
    name: '高塔中锋',
    gender: 'male',
    age: 26,
    basketballAge: 3,
    height: 220,
    weight: 72,
    wingspan: 180,
    standingReach: 228,
    jumpingReach: 300,
    category: '单项突出',
    description: '身高极高（超出最大值），其余属性为中位数，验证身高权重 0.20 的影响',
  },
  {
    id: 'standout-jump',
    name: '弹簧人',
    gender: 'male',
    age: 26,
    basketballAge: 3,
    height: 175,
    weight: 72,
    wingspan: 180,
    standingReach: 228,
    jumpingReach: 350,
    category: '单项突出',
    description: '弹跳摸高极高（超出最大值），其余属性为中位数，验证弹跳权重 0.20 的影响',
  },
  {
    id: 'standout-exp',
    name: '老将',
    gender: 'male',
    age: 26,
    basketballAge: 15,
    height: 175,
    weight: 72,
    wingspan: 180,
    standingReach: 228,
    jumpingReach: 300,
    category: '单项突出',
    description: '球龄极高（超出最大值），其余属性为中位数，验证球龄权重 0.15 的影响',
  },

  // 单项薄弱球员
  {
    id: 'weak-weight',
    name: '瘦小子',
    gender: 'male',
    age: 26,
    basketballAge: 3,
    height: 175,
    weight: 40,
    wingspan: 180,
    standingReach: 228,
    jumpingReach: 300,
    category: '单项薄弱',
    description: '体重极低（低于最小值），其余属性为中位数，验证体重权重 0.10 的影响',
  },
  {
    id: 'weak-wingspan',
    name: '短手球员',
    gender: 'male',
    age: 26,
    basketballAge: 3,
    height: 175,
    weight: 72,
    wingspan: 150,
    standingReach: 228,
    jumpingReach: 300,
    category: '单项薄弱',
    description: '臂展极短（低于最小值），其余属性为中位数，验证臂展权重 0.15 的影响',
  },

  // 特殊组合球员
  {
    id: 'special-tall-young',
    name: '天才少年',
    gender: 'male',
    age: 16,
    basketballAge: 1,
    height: 200,
    weight: 65,
    wingspan: 195,
    standingReach: 245,
    jumpingReach: 320,
    category: '特殊组合',
    description: '身高很高但年龄很小、球龄很短，验证年龄/球龄百分位对高分属性的抵消效果',
  },
  {
    id: 'special-old-short',
    name: '经验型老将',
    gender: 'male',
    age: 40,
    basketballAge: 12,
    height: 165,
    weight: 70,
    wingspan: 168,
    standingReach: 215,
    jumpingReach: 280,
    category: '特殊组合',
    description: '年龄大身高矮但球龄长，验证综合权衡效果',
  },

  // 女性球员
  {
    id: 'female-average',
    name: '女篮平均',
    gender: 'female',
    age: 25,
    basketballAge: 2,
    height: 162,
    weight: 58,
    wingspan: 165,
    standingReach: 210,
    jumpingReach: 265,
    category: '平均',
    description: '女性中位数属性，验证女性数据集切换和能力值范围',
  },
  {
    id: 'female-extreme',
    name: '女篮巨星',
    gender: 'female',
    age: 38,
    basketballAge: 10,
    height: 180,
    weight: 80,
    wingspan: 185,
    standingReach: 230,
    jumpingReach: 300,
    category: '极值',
    description: '女性属性接近最大值，验证女性数据集边界处理',
  },
];
