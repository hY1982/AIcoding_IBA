import type { LevelMatch, Sportsmanship, ActionCleanliness } from './feedback';

// 系统参数键名 — 联合类型 + const 数组（单一来源）
export const SYSTEM_PARAM_KEYS = [
  'ability_adjust_weights',
  'match_threshold_params',
  'base_ability_weights',
  'group_chat_expiry_days',
] as const;
export type SystemParamKey = (typeof SYSTEM_PARAM_KEYS)[number];

/**
 * 能力匹配调节值计算权重
 * 用于 Module 2.8（赛后反馈与调节值服务）
 */
export interface AbilityAdjustWeights {
  level_match: Record<LevelMatch, number>;
  sportsmanship: Record<Sportsmanship, number>;
  action_cleanliness: Record<ActionCleanliness, number>;
  punctuality: Record<'true' | 'false', number>;
}

/**
 * 匹配动态阈值参数
 * 用于 Module 2.6（匹配引擎服务）
 */
export interface MatchThresholdParams {
  base_threshold: number;
  min_threshold: number;
  intention_count_factor: number;
}

/**
 * 基础能力值计算权重
 * 用于 Module 2.1（基础能力值计算服务）
 */
export interface BaseAbilityWeights {
  height: number;
  weight: number;
  wingspan: number;
  standing_reach: number;
  jumping_reach: number;
  basketball_age: number;
  age: number;
}

/**
 * 群聊有效期配置
 * 用于 Module 2.10（群聊消息服务）
 */
export interface GroupChatExpiryDays {
  expiry_days: number;
}

/**
 * 系统参数值映射 — 将键名映射到对应的 TypeScript 接口类型
 * 保证类型安全：通过 SystemParamKey 可推导 param_value 的具体结构
 */
export interface SystemParamValueMap {
  ability_adjust_weights: AbilityAdjustWeights;
  match_threshold_params: MatchThresholdParams;
  base_ability_weights: BaseAbilityWeights;
  group_chat_expiry_days: GroupChatExpiryDays;
}

/**
 * 系统参数（API 响应契约）
 */
export interface SystemParam {
  id: number;
  paramKey: SystemParamKey;
  paramValue: unknown; // 实际使用时通过 SystemParamValueMap 做类型收窄
  description: string | null;
  updatedAt: string;
}

/**
 * 类型守卫：判断 value 是否符合 AbilityAdjustWeights 结构
 */
export function isAbilityAdjustWeights(value: unknown): value is AbilityAdjustWeights {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;

  if (
    typeof v.level_match !== 'object' || v.level_match === null ||
    typeof v.sportsmanship !== 'object' || v.sportsmanship === null ||
    typeof v.action_cleanliness !== 'object' || v.action_cleanliness === null ||
    typeof v.punctuality !== 'object' || v.punctuality === null
  ) {
    return false;
  }

  const lm = v.level_match as Record<string, unknown>;
  const expectedLmKeys = ['unclear', 'lower', 'equal', 'higher'];
  if (!expectedLmKeys.every((k) => typeof lm[k] === 'number')) return false;

  const sp = v.sportsmanship as Record<string, unknown>;
  const expectedSpKeys = ['good', 'average', 'poor'];
  if (!expectedSpKeys.every((k) => typeof sp[k] === 'number')) return false;

  const ac = v.action_cleanliness as Record<string, unknown>;
  const expectedAcKeys = ['clean', 'average', 'dirty'];
  if (!expectedAcKeys.every((k) => typeof ac[k] === 'number')) return false;

  const pt = v.punctuality as Record<string, unknown>;
  const expectedPtKeys = ['true', 'false'];
  if (!expectedPtKeys.every((k) => typeof pt[k] === 'number')) return false;

  return true;
}

/**
 * 类型守卫：判断 value 是否符合 MatchThresholdParams 结构
 */
export function isMatchThresholdParams(value: unknown): value is MatchThresholdParams {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.base_threshold === 'number' &&
    typeof v.min_threshold === 'number' &&
    typeof v.intention_count_factor === 'number'
  );
}

/**
 * 类型守卫：判断 value 是否符合 BaseAbilityWeights 结构
 */
export function isBaseAbilityWeights(value: unknown): value is BaseAbilityWeights {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.height === 'number' &&
    typeof v.weight === 'number' &&
    typeof v.wingspan === 'number' &&
    typeof v.standing_reach === 'number' &&
    typeof v.jumping_reach === 'number' &&
    typeof v.basketball_age === 'number' &&
    typeof v.age === 'number'
  );
}

/**
 * 类型守卫：判断 value 是否符合 GroupChatExpiryDays 结构
 */
export function isGroupChatExpiryDays(value: unknown): value is GroupChatExpiryDays {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.expiry_days === 'number' && v.expiry_days > 0;
}

/**
 * 根据 paramKey 获取对应的类型守卫函数
 */
export function getSystemParamGuard<K extends SystemParamKey>(
  key: K,
): (value: unknown) => value is SystemParamValueMap[K] {
  switch (key) {
    case 'ability_adjust_weights':
      return isAbilityAdjustWeights as (value: unknown) => value is SystemParamValueMap[K];
    case 'match_threshold_params':
      return isMatchThresholdParams as (value: unknown) => value is SystemParamValueMap[K];
    case 'base_ability_weights':
      return isBaseAbilityWeights as (value: unknown) => value is SystemParamValueMap[K];
    case 'group_chat_expiry_days':
      return isGroupChatExpiryDays as (value: unknown) => value is SystemParamValueMap[K];
    default:
      // exhaustive check
      return (_value: unknown): _value is SystemParamValueMap[K] => false;
  }
}
