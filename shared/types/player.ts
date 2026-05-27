import { Timestamps } from './common';

// 篮球位置 — 联合类型 + const 数组（单一来源）
export const BASKETBALL_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export type BasketballPosition = (typeof BASKETBALL_POSITIONS)[number];
export const POSITION_LABELS: Record<BasketballPosition, string> = {
  PG: '控球后卫',
  SG: '得分后卫',
  SF: '小前锋',
  PF: '大前锋',
  C: '中锋',
};

// 性别 — 联合类型 + const 数组
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  male: '男',
  female: '女',
};

// 位置优先级
export interface PlayerPosition {
  position: BasketballPosition;
  priority: number; // 1 = 最高
}

// 球员基础属性（MVP）
export interface PlayerAttributes {
  age: number;
  basketballAge: number; // 球龄，年
  gender: Gender;
  height: number; // cm
  weight?: number; // kg
  wingspan?: number; // cm
  standingReach?: number; // cm 站立摸高
  jumpingReach?: number; // cm 起跳摸高
  positions: BasketballPosition[];
  regionCode?: string;
}

// 能力值（计算得出）
export interface PlayerAbility {
  baseAbilityScore: number;
  matchAdjustValue: number;
  totalAbilityScore: number;
}

// 球员完整资料
export interface PlayerProfile extends PlayerAttributes, PlayerAbility, Timestamps {
  id: number;
  userId: number;
}

// 球队角色
export const TEAM_ROLES = ['starter', 'bench'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

// P1 扩展属性
export interface PlayerExtendedAttributes {
  benchPress?: number; // kg
  handLength?: number; // cm
  sprint100m?: number; // 秒
  run1000m?: number;
  run2000m?: number;
  run5000m?: number;
  runRecordDate?: string;
  teamExperience?: string[];
  teamRole?: TeamRole;
  breakthroughLevel?: number; // 0-4
  passingLevel?: number; // 0-4
  defenseLevel?: number; // 0-4
}

// 投篮记录
export const SHOOTING_RECORD_TYPES = ['free_throw', 'three_point'] as const;
export type ShootingRecordType = (typeof SHOOTING_RECORD_TYPES)[number];

export interface ShootingRecord {
  id: number;
  playerId: number;
  recordType: ShootingRecordType;
  shotsAttempted: number;
  shotsMade: number;
  recordDate: string;
}

// 投篮统计（滚动半年）
export interface ShootingStats {
  recordType: ShootingRecordType;
  totalAttempted: number;
  totalMade: number;
  percentage: number;
}
