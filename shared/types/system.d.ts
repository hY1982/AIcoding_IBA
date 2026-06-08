import type { LevelMatch, Sportsmanship, ActionCleanliness } from './feedback';
export declare const SYSTEM_PARAM_KEYS: readonly ["ability_adjust_weights", "match_threshold_params", "base_ability_weights", "group_chat_expiry_days"];
export type SystemParamKey = (typeof SYSTEM_PARAM_KEYS)[number];
export interface AbilityAdjustWeights {
    level_match: Record<LevelMatch, number>;
    sportsmanship: Record<Sportsmanship, number>;
    action_cleanliness: Record<ActionCleanliness, number>;
    punctuality: Record<'true' | 'false', number>;
}
export interface MatchThresholdParams {
    base_threshold: number;
    min_threshold: number;
    intention_count_factor: number;
}
export interface BaseAbilityWeights {
    height: number;
    weight: number;
    wingspan: number;
    standing_reach: number;
    jumping_reach: number;
    basketball_age: number;
    age: number;
}
export interface GroupChatExpiryDays {
    expiry_days: number;
}
export interface SystemParamValueMap {
    ability_adjust_weights: AbilityAdjustWeights;
    match_threshold_params: MatchThresholdParams;
    base_ability_weights: BaseAbilityWeights;
    group_chat_expiry_days: GroupChatExpiryDays;
}
export interface SystemParam {
    id: number;
    paramKey: SystemParamKey;
    paramValue: unknown;
    description: string | null;
    updatedAt: string;
}
export declare function isAbilityAdjustWeights(value: unknown): value is AbilityAdjustWeights;
export declare function isMatchThresholdParams(value: unknown): value is MatchThresholdParams;
export declare function isBaseAbilityWeights(value: unknown): value is BaseAbilityWeights;
export declare function isGroupChatExpiryDays(value: unknown): value is GroupChatExpiryDays;
export declare function getSystemParamGuard<K extends SystemParamKey>(key: K): (value: unknown) => value is SystemParamValueMap[K];
