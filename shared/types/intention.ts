// 意向状态 — v2.0 重构：移除 matched/failed，仅保留四状态
export const INTENTION_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'expired',
] as const;
export type IntentionStatus = (typeof INTENTION_STATUSES)[number];

export const INTENTION_STATUS_LABELS: Record<IntentionStatus, string> = {
  pending: '等待匹配',
  confirmed: '已确认',
  cancelled: '已取消',
  expired: '已过期',
};

/**
 * 意向状态机 — v2.0 重构
 *
 * 关键变更：
 * - 移除 matched/failed，意向可同时参与多个候选比赛
 * - confirmed → pending 回退（场地方拒绝且未在其他比赛 confirmed）
 * - cancelled → pending 支持重新编辑
 */
export const INTENTION_STATUS_TRANSITIONS: Record<
  IntentionStatus,
  IntentionStatus[]
> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['pending'],  // 场地方拒绝时回退（前提：该意向未在其他比赛 confirmed）
  cancelled: ['pending'],  // 支持重新编辑
  expired: [],
};

/**
 * 意向场地关联
 */
export interface IntentionVenue {
  id: number;
  intentionId: number;
  venueId: number;
  priority: number; // 1 = 最高
}

/**
 * 意向赛制关联
 */
export interface IntentionFormat {
  id: number;
  intentionId: number;
  formatId: number;
  priority: number; // 1 = 最高
}

/**
 * 比赛意向（API 响应契约）— v2.0 重构
 *
 * 关键变更：
 * - 移除 matchId（意向不再 1:1 绑定比赛，可同时参与多个候选比赛）
 * - expiresAt 语义改为 startTime - 1小时
 */
export interface Intention {
  id: number;
  playerId: number;
  startTime: string; // ISO 8601
  durationMinutes: number;
  acceptableWaitMinutes: number;
  endTime: string; // ISO 8601，由后端根据 start_time + duration_minutes 计算
  status: IntentionStatus;
  // v2.0: 移除 matchId，意向不再 1:1 绑定比赛
  regionCode: string | null;
  submittedAt: string;
  updatedAt: string;
  expiresAt: string; // v2.0: = startTime - 1小时
}

/**
 * 创建意向输入（后续 Module 2.5/3.4 使用）
 *
 * 注意：
 * - end_time 由后端根据 start_time + duration_minutes 自动计算，不可传入
 * - expires_at 由后端根据 start_time - 1小时自动计算，不可传入（v2.0 变更）
 * - region_code 由后端根据 player 地区或首选场地地区自动填充，不可传入
 */
export interface CreateIntentionInput {
  playerId: number;
  startTime: string; // ISO 8601
  durationMinutes: number; // 120-360
  acceptableWaitMinutes?: number; // 默认 30
  venueIds: { venueId: number; priority: number }[]; // 最多3个，按优先级排序
  formatIds: { formatId: number; priority: number }[]; // 最多3个，按优先级排序
}
