"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEND_STATUS_LABELS = exports.SEND_STATUSES = exports.NOTIFICATION_CHANNELS = exports.NOTIFICATION_TYPES = void 0;
exports.NOTIFICATION_TYPES = [
    'match_invited',
    'match_confirmed',
    'match_success',
    'match_failed',
    'intention_matched',
    'intention_expired',
    'intention_reminder',
    'payment_success',
    'payment_failed',
    'feedback_request',
    'system_announcement',
];
exports.NOTIFICATION_CHANNELS = ['push', 'sms', 'in_app'];
exports.SEND_STATUSES = ['pending', 'succeeded', 'failed'];
exports.SEND_STATUS_LABELS = {
    pending: '发送中',
    succeeded: '发送成功',
    failed: '发送失败',
};
//# sourceMappingURL=notification.js.map