"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATCH_PLAYER_STATUS_LABELS = exports.MATCH_STATUS_LABELS = exports.MATCH_PLAYER_STATUS_TRANSITIONS = exports.MATCH_STATUS_TRANSITIONS = exports.MESSAGE_TYPES = exports.MATCH_PLAYER_STATUSES = exports.MATCH_STATUSES = void 0;
exports.canTransitionMatchStatus = canTransitionMatchStatus;
exports.canTransitionMatchPlayerStatus = canTransitionMatchPlayerStatus;
exports.MATCH_STATUSES = [
    'pending_confirmation',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'failed',
];
exports.MATCH_PLAYER_STATUSES = [
    'invited',
    'confirmed',
    'declined',
    'no_show',
];
exports.MESSAGE_TYPES = ['text', 'image', 'system'];
exports.MATCH_STATUS_TRANSITIONS = {
    pending_confirmation: ['confirmed', 'cancelled', 'failed'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    failed: [],
};
function canTransitionMatchStatus(from, to) {
    return exports.MATCH_STATUS_TRANSITIONS[from].includes(to);
}
exports.MATCH_PLAYER_STATUS_TRANSITIONS = {
    invited: ['confirmed', 'declined'],
    confirmed: ['no_show'],
    declined: [],
    no_show: [],
};
function canTransitionMatchPlayerStatus(from, to) {
    return exports.MATCH_PLAYER_STATUS_TRANSITIONS[from].includes(to);
}
exports.MATCH_STATUS_LABELS = {
    pending_confirmation: '等待确认',
    confirmed: '已确认',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    failed: '匹配失败',
};
exports.MATCH_PLAYER_STATUS_LABELS = {
    invited: '已邀请',
    confirmed: '已确认',
    declined: '已拒绝',
    no_show: '未到场',
};
//# sourceMappingURL=match.js.map