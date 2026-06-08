"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_PARAM_KEYS = void 0;
exports.isAbilityAdjustWeights = isAbilityAdjustWeights;
exports.isMatchThresholdParams = isMatchThresholdParams;
exports.isBaseAbilityWeights = isBaseAbilityWeights;
exports.isGroupChatExpiryDays = isGroupChatExpiryDays;
exports.getSystemParamGuard = getSystemParamGuard;
exports.SYSTEM_PARAM_KEYS = [
    'ability_adjust_weights',
    'match_threshold_params',
    'base_ability_weights',
    'group_chat_expiry_days',
];
function isAbilityAdjustWeights(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const v = value;
    if (typeof v.level_match !== 'object' || v.level_match === null ||
        typeof v.sportsmanship !== 'object' || v.sportsmanship === null ||
        typeof v.action_cleanliness !== 'object' || v.action_cleanliness === null ||
        typeof v.punctuality !== 'object' || v.punctuality === null) {
        return false;
    }
    const lm = v.level_match;
    const expectedLmKeys = ['unclear', 'lower', 'equal', 'higher'];
    if (!expectedLmKeys.every((k) => typeof lm[k] === 'number'))
        return false;
    const sp = v.sportsmanship;
    const expectedSpKeys = ['good', 'average', 'poor'];
    if (!expectedSpKeys.every((k) => typeof sp[k] === 'number'))
        return false;
    const ac = v.action_cleanliness;
    const expectedAcKeys = ['clean', 'average', 'dirty'];
    if (!expectedAcKeys.every((k) => typeof ac[k] === 'number'))
        return false;
    const pt = v.punctuality;
    const expectedPtKeys = ['true', 'false'];
    if (!expectedPtKeys.every((k) => typeof pt[k] === 'number'))
        return false;
    return true;
}
function isMatchThresholdParams(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const v = value;
    return (typeof v.base_threshold === 'number' &&
        v.base_threshold >= 0 &&
        typeof v.min_threshold === 'number' &&
        v.min_threshold >= 0 &&
        typeof v.intention_count_factor === 'number' &&
        v.intention_count_factor >= 0);
}
function isBaseAbilityWeights(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const v = value;
    return (typeof v.height === 'number' &&
        typeof v.weight === 'number' &&
        typeof v.wingspan === 'number' &&
        typeof v.standing_reach === 'number' &&
        typeof v.jumping_reach === 'number' &&
        typeof v.basketball_age === 'number' &&
        typeof v.age === 'number');
}
function isGroupChatExpiryDays(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const v = value;
    return typeof v.expiry_days === 'number' && v.expiry_days > 0;
}
function getSystemParamGuard(key) {
    switch (key) {
        case 'ability_adjust_weights':
            return isAbilityAdjustWeights;
        case 'match_threshold_params':
            return isMatchThresholdParams;
        case 'base_ability_weights':
            return isBaseAbilityWeights;
        case 'group_chat_expiry_days':
            return isGroupChatExpiryDays;
        default:
            return (_value) => false;
    }
}
//# sourceMappingURL=system.js.map