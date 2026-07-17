// 比赛状态 — v2.0 重构：7状态（拆分为两阶段确认）
export const MATCH_STATUSES = [
  'pending_players',   // 候选比赛，等球员确认
  'pending_venue',     // 满员，等场地方确认（30分钟窗口）
  'confirmed',         // 场地已确认，比赛正式生效
  'in_progress',       // 进行中
  'completed',         // 已完成
  'cancelled',         // 已取消（场地拒绝/不可用）
  'expired',           // 超时未满员
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// 比赛球员参赛状态 — v2.0 重构：declined→withdrawn
export const MATCH_PLAYER_STATUSES = [
  'invited',
  'confirmed',
  'withdrawn',   // v2.0: 统一表达"释放"（确认其他比赛/超时/场地拒绝/比赛取消）
  'no_show',
] as const;
export type MatchPlayerStatus = (typeof MATCH_PLAYER_STATUSES)[number];

// 消息类型 — 联合类型 + const 数组（单一来源）
export const MESSAGE_TYPES = ['text', 'image', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/**
 * 比赛状态机 — v2.0 重构（二阶段确认）
 *
 * 状态流转规则：
 * - pending_players: 候选比赛，等球员先到先得确认
 * - pending_venue: 满员（confirmedPlayers == requiredPlayers），等场地方确认
 * - confirmed: 场地已确认，比赛正式生效
 * - in_progress: 比赛进行中
 * - completed: 比赛结束
 * - cancelled: 场地拒绝/不可用
 * - expired: 候选比赛超时未满员
 */
export const MATCH_STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  pending_players: ['pending_venue', 'expired'],
  pending_venue: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
};

/**
 * 校验比赛状态流转是否合法。
 * @param from 当前状态
 * @param to 目标状态
 * @returns 是否允许流转
 */
export function canTransitionMatchStatus(
  from: MatchStatus,
  to: MatchStatus,
): boolean {
  return MATCH_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * 球员参赛状态机 — v2.0 重构
 *
 * 关键变更：
 * - declined → withdrawn（统一表达"释放"）
 * - confirmed 可回退到 withdrawn（场地拒绝/比赛取消）
 */
export const MATCH_PLAYER_STATUS_TRANSITIONS: Record<MatchPlayerStatus, MatchPlayerStatus[]> = {
  invited: ['confirmed', 'withdrawn'],
  confirmed: ['withdrawn', 'no_show'],
  withdrawn: [],
  no_show: [],
};

/**
 * 校验球员参赛状态流转是否合法。
 * @param from 当前状态
 * @param to 目标状态
 * @returns 是否允许流转
 */
export function canTransitionMatchPlayerStatus(
  from: MatchPlayerStatus,
  to: MatchPlayerStatus,
): boolean {
  return MATCH_PLAYER_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * 比赛状态标签 — v2.0
 */
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  pending_players: '等待球员确认',
  pending_venue: '等待场地确认',
  confirmed: '已确认',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  expired: '已超时',
};

/**
 * 球员参赛状态标签 — v2.0
 */
export const MATCH_PLAYER_STATUS_LABELS: Record<MatchPlayerStatus, string> = {
  invited: '已邀请',
  confirmed: '已确认',
  withdrawn: '已释放',
  no_show: '未到场',
};

/**
 * 比赛（API 响应契约）— v2.0 重构
 *
 * 关键变更：
 * - 新增 requiredPlayers、confirmDeadline、venueConfirmDeadline
 * - 删除 totalPlayers（改用 requiredPlayers）
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
  requiredPlayers: number;    // v2.0: teamCount * playersPerTeam
  confirmedPlayers: number;
  depositAmount: string; // decimal 作为 string 传输避免精度问题
  confirmDeadline: string | null;         // v2.0: 球员确认截止时间
  venueConfirmDeadline: string | null;    // v2.0: 场地方确认截止时间
  groupChatId: string | null;
  regionCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 比赛球员关联（API 响应契约）— v2.0 重构
 *
 * 关键变更：
 * - 新增 intentionId、depositOrderNo
 * - 删除 isReserve
 */
export interface MatchPlayer {
  id: number;
  matchId: number;
  playerId: number;
  intentionId: number | null;  // v2.0: 关联产生该邀请的意向
  teamNumber: number | null;
  isConfirmed: boolean;
  confirmedAt: string | null;
  depositPaid: boolean;
  depositOrderNo: string | null;  // v2.0: 支付订单号（Saga补偿用）
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
  senderNickname: string | null;
  content: string;
  messageType: MessageType;
  createdAt: string;
}
