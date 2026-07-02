/**
 * E2E Bot 测试 — BotContext 类型与状态管理
 */

export type BotRole = 'player' | 'venue_manager';

export interface BotError {
  phase: string;
  message: string;
  timestamp: number;
}

export interface BotContext {
  // 档案信息（生成时填充）
  index: number;
  role: BotRole;
  phone: string;
  password: string;
  nickname: string;

  // 球员专属属性（生成时填充）
  birthDate?: string;       // YYYY-MM-DD
  startPlayingDate?: string; // YYYY-MM
  gender?: 'male' | 'female';
  height?: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions?: string[];

  // 场地经理专属属性（生成时填充）
  companyName?: string;
  contactName?: string;
  contactPhone?: string;

  // 注册后填充
  userId?: number;
  accessToken?: string;
  refreshToken?: string;

  // 球员登录后填充（通过 GET /players/profile）
  playerId?: number;
  baseAbilityScore?: number;

  // 场地经理登录后填充（通过 GET /venue-managers/profile）
  venueManagerId?: number;

  // 场地创建后填充
  venueId?: number;
  venueIds?: number[];  // 场地管理员管理的多个场地
  timeSlotIds?: number[];

  // 意向提交后填充
  intentionId?: number;
  intentionStartTime?: string;

  // 匹配后填充
  matchId?: number;
  matchStatus?: string;

  // 流程追踪
  confirmedMatch?: boolean;
  feedbackSubmitted?: boolean;
  messagesSent?: number;

  // 指标
  timings: Record<string, number>;
  errors: BotError[];
}

export function createEmptyBotContext(
  index: number,
  role: BotRole,
  phone: string,
  password: string,
  nickname: string,
): BotContext {
  return {
    index,
    role,
    phone,
    password,
    nickname,
    timings: {},
    errors: [],
    messagesSent: 0,
  };
}
