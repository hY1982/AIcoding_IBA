// 比赛状态 — 联合类型 + const 数组（单一来源）
export const MATCH_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// 比赛球员参赛状态 — 联合类型 + const 数组（单一来源）
export const MATCH_PLAYER_STATUSES = [
  'invited',
  'confirmed',
  'declined',
  'no_show',
] as const;
export type MatchPlayerStatus = (typeof MATCH_PLAYER_STATUSES)[number];

// 消息类型 — 联合类型 + const 数组（单一来源）
export const MESSAGE_TYPES = ['text', 'image', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/**
 * 比赛状态机 — 定义合法的状态流转路径。
 * 为 Module 2.7（比赛确认服务）提供状态流转校验依据。
 *
 * 状态流转规则：
 * - pending_confirmation: 匹配成功，等待球员确认参赛
 * - confirmed: 足够人数确认，比赛正式确认
 * - in_progress: 比赛进行中（由系统或人工标记）
 * - completed: 比赛结束，进入反馈阶段
 * - cancelled: 比赛取消（人数不足或主动取消）
 * - failed: 匹配失败（确认人数不足）
 */
export const MATCH_STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled', 'failed'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: [],
};

/**
 * 比赛状态标签
 */
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  pending_confirmation: '等待确认',
  confirmed: '已确认',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  failed: '匹配失败',
};

/**
 * 球员参赛状态标签
 */
export const MATCH_PLAYER_STATUS_LABELS: Record<MatchPlayerStatus, string> = {
  invited: '已邀请',
  confirmed: '已确认',
  declined: '已拒绝',
  no_show: '未到场',
};

/**
 * 比赛（API 响应契约）
 */
export interface Match {
  id: number;
  venueId: number;
  formatId: number;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: MatchStatus;
  teamCount: number;
  playersPerTeam: number;
  totalPlayers: number;
  confirmedPlayers: number;
  depositAmount: string; // decimal 作为 string 传输避免精度问题
  groupChatId: string | null;
  regionCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 比赛球员关联（API 响应契约）
 */
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

/**
 * 比赛队伍（API 响应契约）
 */
export interface MatchTeam {
  id: number;
  matchId: number;
  teamNumber: number;
  teamName: string | null;
  avgAbility: string | null; // decimal 作为 string
}

/**
 * 群聊消息（API 响应契约）
 */
export interface MatchMessage {
  id: number;
  matchId: number;
  senderId: number;
  content: string;
  messageType: MessageType;
  createdAt: string;
}
