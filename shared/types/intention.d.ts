export declare const INTENTION_STATUSES: readonly ["pending", "matched", "confirmed", "cancelled", "expired", "failed"];
export type IntentionStatus = (typeof INTENTION_STATUSES)[number];
export declare const INTENTION_STATUS_LABELS: Record<IntentionStatus, string>;
export declare const INTENTION_STATUS_TRANSITIONS: Record<IntentionStatus, IntentionStatus[]>;
export interface IntentionVenue {
    id: number;
    intentionId: number;
    venueId: number;
    priority: number;
}
export interface IntentionFormat {
    id: number;
    intentionId: number;
    formatId: number;
    priority: number;
}
export interface Intention {
    id: number;
    playerId: number;
    startTime: string;
    durationMinutes: number;
    acceptableWaitMinutes: number;
    endTime: string;
    status: IntentionStatus;
    matchId: number | null;
    regionCode: string | null;
    submittedAt: string;
    updatedAt: string;
    expiresAt: string;
}
export interface CreateIntentionInput {
    playerId: number;
    startTime: string;
    durationMinutes: number;
    acceptableWaitMinutes?: number;
    venueIds: {
        venueId: number;
        priority: number;
    }[];
    formatIds: {
        formatId: number;
        priority: number;
    }[];
}
