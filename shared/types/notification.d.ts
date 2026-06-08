export declare const NOTIFICATION_TYPES: readonly ["match_invited", "match_confirmed", "match_success", "match_failed", "intention_matched", "intention_expired", "intention_reminder", "payment_success", "payment_failed", "feedback_request", "system_announcement"];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export declare const NOTIFICATION_CHANNELS: readonly ["push", "sms", "in_app"];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export declare const SEND_STATUSES: readonly ["pending", "succeeded", "failed"];
export type SendStatus = (typeof SEND_STATUSES)[number];
export declare const SEND_STATUS_LABELS: Record<SendStatus, string>;
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
