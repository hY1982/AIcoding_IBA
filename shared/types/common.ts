// API 统一响应格式
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// 分页请求参数
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分页响应包装
export interface PaginatedResponse<T> {
  page: number;
  pageSize: number;
  total: number;
  list: T[];
}

// 运行时常量
// ⚠️ 修改以下常量需全局搜索并同步所有前后端使用方
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// 用户状态 — 联合类型 + const 数组（单一来源）
export const USER_STATUSES = ['active', 'inactive', 'banned'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: '正常',
  inactive: '未激活',
  banned: '已封禁',
};

// 用户类型 — 联合类型 + const 数组（单一来源）
export const USER_TYPES = ['player', 'venue_manager'] as const;
export type UserType = (typeof USER_TYPES)[number];
export const USER_TYPE_LABELS: Record<UserType, string> = {
  player: '球员',
  venue_manager: '场地方',
};

// JWT Token 对
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// 通用时间戳接口
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}
