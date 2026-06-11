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
  birthDate?: string; // 生日 YYYY-MM-DD（原始事实数据）
  startPlayingDate?: string; // 开始打球年月 YYYY-MM（原始事实数据）
  gender: Gender;
  height: number; // cm
  weight?: number; // kg
  wingspan?: number; // cm
  standingReach?: number; // cm 站立摸高
  jumpingReach?: number; // cm 起跳摸高
  positions: BasketballPosition[];
  regionCode?: string;
}

// 可写能力值（用于更新/录入）
export interface PlayerAbilityInput {
  baseAbilityScore: number;
  matchAdjustValue: number;
}

// 完整能力值（含计算字段，仅用于查询响应）
export interface PlayerAbility extends PlayerAbilityInput {
  totalAbilityScore: number; // 计算列：baseAbilityScore + matchAdjustValue
}

/**
 * 球员完整资料（API 响应）
 *
 * 包含球员属性、能力值、用户信息（脱敏后）和时间戳。
 * 用于 PlayerService 查询响应，所有敏感字段已脱敏。
 */
export interface PlayerProfile extends Omit<PlayerAttributes, 'positions'>, PlayerAbility, Timestamps {
  id: number;
  userId: number;
  // 覆盖父接口：API 返回带优先级的位置对象数组
  positions: PlayerPosition[];
  // 用户信息（已脱敏）
  phone: string;        // 脱敏手机号，如 "138****5678"
  nickname: string;
  realName: string;     // 脱敏真实姓名，如 "张**"
  avatarUrl?: string;
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
