export declare const MATCH_STATUSES: readonly ["pending_confirmation", "confirmed", "in_progress", "completed", "cancelled", "failed"];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export declare const MATCH_PLAYER_STATUSES: readonly ["invited", "confirmed", "declined", "no_show"];
export type MatchPlayerStatus = (typeof MATCH_PLAYER_STATUSES)[number];
export declare const MESSAGE_TYPES: readonly ["text", "image", "system"];
export type MessageType = (typeof MESSAGE_TYPES)[number];
export declare const MATCH_STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]>;
export declare function canTransitionMatchStatus(from: MatchStatus, to: MatchStatus): boolean;
export declare const MATCH_PLAYER_STATUS_TRANSITIONS: Record<MatchPlayerStatus, MatchPlayerStatus[]>;
export declare function canTransitionMatchPlayerStatus(from: MatchPlayerStatus, to: MatchPlayerStatus): boolean;
export declare const MATCH_STATUS_LABELS: Record<MatchStatus, string>;
export declare const MATCH_PLAYER_STATUS_LABELS: Record<MatchPlayerStatus, string>;
export interface Match {
    id: number;
    venueId: number;
    formatId: number;
    startTime: string;
    endTime: string;
    status: MatchStatus;
    teamCount: number;
    playersPerTeam: number;
    totalPlayers: number;
    confirmedPlayers: number;
    depositAmount: string;
    groupChatId: string | null;
    regionCode: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface MatchPlayer {
    id: number;
    matchId: number;
    playerId: number;
    teamNumber: number | null;
    isConfirmed: boolean;
    isReserve: boolean;
    confirmedAt: string | null;
    depositPaid: boolean;
    status: MatchPlayerStatus;
}
export interface MatchTeam {
    id: number;
    matchId: number;
    teamNumber: number;
    teamName: string | null;
    avgAbility: string | null;
}
export interface MatchMessage {
    id: number;
    matchId: number;
    senderId: number;
    content: string;
    messageType: MessageType;
    createdAt: string;
}
