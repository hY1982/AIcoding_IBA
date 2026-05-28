// 意向状态 — 联合类型 + const 数组（单一来源）
export const INTENTION_STATUSES = [
  'pending',
  'matched',
  'confirmed',
  'cancelled',
  'expired',
  'failed',
] as const;
export type IntentionStatus = (typeof INTENTION_STATUSES)[number];

export const INTENTION_STATUS_LABELS: Record<IntentionStatus, string> = {
  pending: '等待匹配',
  matched: '已匹配',
  confirmed: '已确认',
  cancelled: '已取消',
  expired: '已过期',
  failed: '匹配失败',
};

/**
 * 意向状态机 — 定义合法的状态流转路径。
 * 为 Module 2.5（意向服务）提供状态流转校验依据。
 */
export const INTENTION_STATUS_TRANSITIONS: Record<
  IntentionStatus,
  IntentionStatus[]
> = {
  pending: ['matched', 'cancelled', 'expired'],
  matched: ['confirmed', 'cancelled', 'failed'],
  confirmed: ['cancelled'],
  cancelled: [],
  expired: [],
  failed: [],
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
 * 比赛意向（API 响应契约）
 */
export interface Intention {
  id: number;
  playerId: number;
  startTime: string; // ISO 8601
  durationMinutes: number;
  acceptableWaitMinutes: number;
  endTime: string; // ISO 8601，由后端根据 start_time + duration_minutes 计算
  status: IntentionStatus;
  matchId: number | null;
  regionCode: string | null;
  submittedAt: string;
  updatedAt: string;
  expiresAt: string;
}

/**
 * 创建意向输入（后续 Module 2.5/3.4 使用）
 *
 * 注意：
 * - end_time 由后端根据 start_time + duration_minutes 自动计算，不可传入
 * - expires_at 由后端根据 submitted_at + acceptable_wait_minutes 自动计算，不可传入
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
