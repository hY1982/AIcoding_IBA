export declare const LEVEL_MATCH_OPTIONS: readonly ["unclear", "lower", "equal", "higher"];
export type LevelMatch = (typeof LEVEL_MATCH_OPTIONS)[number];
export declare const LEVEL_MATCH_LABELS: Record<LevelMatch, string>;
export declare const SPORTSMANSHIP_OPTIONS: readonly ["good", "average", "poor"];
export type Sportsmanship = (typeof SPORTSMANSHIP_OPTIONS)[number];
export declare const SPORTSMANSHIP_LABELS: Record<Sportsmanship, string>;
export declare const ACTION_CLEANLINESS_OPTIONS: readonly ["clean", "average", "dirty"];
export type ActionCleanliness = (typeof ACTION_CLEANLINESS_OPTIONS)[number];
export declare const ACTION_CLEANLINESS_LABELS: Record<ActionCleanliness, string>;
export interface Feedback {
    id: number;
    matchId: number;
    playerId: number;
    overallRating: number;
    overallReason: string | null;
    submittedAt: string;
    regionCode: string | null;
}
export interface FeedbackPlayerRating {
    id: number;
    feedbackId: number;
    ratedPlayerId: number;
    levelMatch: LevelMatch | null;
    sportsmanship: Sportsmanship | null;
    actionCleanliness: ActionCleanliness | null;
    isPunctual: boolean | null;
    createdAt: string;
}
export interface CreateFeedbackInput {
    matchId: number;
    playerId: number;
    overallRating: number;
    overallReason?: string;
    playerRatings: {
        ratedPlayerId: number;
        levelMatch?: LevelMatch;
        sportsmanship?: Sportsmanship;
        actionCleanliness?: ActionCleanliness;
        isPunctual?: boolean;
    }[];
}
