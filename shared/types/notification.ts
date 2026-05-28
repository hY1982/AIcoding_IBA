// 通知类型 — 联合类型 + const 数组（单一来源）
export const NOTIFICATION_TYPES = [
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
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// 通知渠道 — 联合类型 + const 数组（单一来源）
export const NOTIFICATION_CHANNELS = ['push', 'sms', 'in_app'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// 发送状态 — 联合类型 + const 数组（单一来源）
export const SEND_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];
export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  pending: '发送中',
  succeeded: '发送成功',
  failed: '发送失败',
};

/**
 * 通知记录（API 响应契约）
 */
export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  sendStatus: SendStatus;
  sentAt: string | null;
  sentVia: NotificationChannel[] | null;
  regionCode: string | null;
  createdAt: string;
}
