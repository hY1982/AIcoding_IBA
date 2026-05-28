// 水平匹配评价 — 联合类型 + const 数组（单一来源）
export const LEVEL_MATCH_OPTIONS = ['unclear', 'lower', 'equal', 'higher'] as const;
export type LevelMatch = (typeof LEVEL_MATCH_OPTIONS)[number];
export const LEVEL_MATCH_LABELS: Record<LevelMatch, string> = {
  unclear: '无法判断',
  lower: '水平偏低',
  equal: '水平相当',
  higher: '水平偏高',
};

// 体育道德评价 — 联合类型 + const 数组（单一来源）
export const SPORTSMANSHIP_OPTIONS = ['good', 'average', 'poor'] as const;
export type Sportsmanship = (typeof SPORTSMANSHIP_OPTIONS)[number];
export const SPORTSMANSHIP_LABELS: Record<Sportsmanship, string> = {
  good: '优秀',
  average: '一般',
  poor: '较差',
};

// 动作干净程度评价 — 联合类型 + const 数组（单一来源）
export const ACTION_CLEANLINESS_OPTIONS = ['clean', 'average', 'dirty'] as const;
export type ActionCleanliness = (typeof ACTION_CLEANLINESS_OPTIONS)[number];
export const ACTION_CLEANLINESS_LABELS: Record<ActionCleanliness, string> = {
  clean: '干净',
  average: '一般',
  dirty: '脏',
};

/**
 * 赛后反馈（API 响应契约）
 */
export interface Feedback {
  id: number;
  matchId: number;
  playerId: number;
  overallRating: number; // 1-5
  overallReason: string | null;
  submittedAt: string;
  regionCode: string | null;
}

/**
 * 对其他球员的评分（API 响应契约）
 */
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

/**
 * 创建反馈输入（后续 Module 2.8/3.6 使用）
 */
export interface CreateFeedbackInput {
  matchId: number;
  playerId: number;
  overallRating: number; // 1-5
  overallReason?: string;
  playerRatings: {
    ratedPlayerId: number;
    levelMatch?: LevelMatch;
    sportsmanship?: Sportsmanship;
    actionCleanliness?: ActionCleanliness;
    isPunctual?: boolean;
  }[];
}
