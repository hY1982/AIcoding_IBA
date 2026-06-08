"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTENTION_STATUS_TRANSITIONS = exports.INTENTION_STATUS_LABELS = exports.INTENTION_STATUSES = void 0;
exports.INTENTION_STATUSES = [
    'pending',
    'matched',
    'confirmed',
    'cancelled',
    'expired',
    'failed',
];
exports.INTENTION_STATUS_LABELS = {
    pending: '等待匹配',
    matched: '已匹配',
    confirmed: '已确认',
    cancelled: '已取消',
    expired: '已过期',
    failed: '匹配失败',
};
exports.INTENTION_STATUS_TRANSITIONS = {
    pending: ['matched', 'cancelled', 'expired'],
    matched: ['confirmed', 'cancelled', 'failed'],
    confirmed: [],
    cancelled: [],
    expired: [],
    failed: [],
};
//# sourceMappingURL=intention.js.map