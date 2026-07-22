import { PaginatedResponse } from './common';
import { PlayerProfile } from './player';
import { Venue } from './venue';
import { Match } from './match';
import { SystemParam } from './system';

/**
 * 管理后台 — 球员列表项（完整信息，不脱敏）
 */
export interface AdminPlayerListItem extends PlayerProfile {
  /** 管理员可见：完整手机号 */
  phoneRaw: string;
  /** 管理员可见：完整真实姓名 */
  realNameRaw: string | null;
  /** 用户状态 */
  userStatus: string;
}

/**
 * 管理后台 — 比赛列表项（扩展字段）
 */
export interface AdminMatchListItem extends Match {
  /** 场地名称 */
  venueName: string;
  /** 赛制名称 */
  formatName: string;
}

/**
 * 管理后台 — 平台数据统计
 */
export interface AdminStats {
  /** 总注册球员数 */
  totalPlayers: number;
  /** 总注册场地方数 */
  totalVenueManagers: number;
  /** 总场地数 */
  totalVenues: number;
  /** 今日比赛数（开始时间在今日内） */
  todayMatches: number;
  /** 待处理意向数（status = pending） */
  pendingIntentions: number;
  /** 近7天每日比赛数 */
  weeklyMatchTrend: Array<{ date: string; count: number }>;
  /** 各状态比赛数量统计 */
  matchStatusDistribution: Array<{ status: string; count: number }>;
}

/**
 * 管理后台 — 列表查询参数
 */
export interface AdminListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  regionCode?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 管理后台 — 更新系统参数请求
 */
export interface UpdateSystemParamRequest {
  paramValue: unknown;
  description?: string;
}

/**
 * 管理后台 API 响应包装
 */
export type AdminPlayerListResponse = PaginatedResponse<AdminPlayerListItem>;
export type AdminVenueListResponse = PaginatedResponse<Venue>;
export type AdminMatchListResponse = PaginatedResponse<AdminMatchListItem>;
export type AdminSystemParamListResponse = SystemParam[];
