import { ApiResponse, TokenPair, UserType, UserStatus } from './common';

// 注册请求
export interface RegisterDto {
  phone: string;
  password: string;
  nickname: string;
  userType: UserType;
  // 球员专属（场地方可选）
  age?: number;
  basketballAge?: number;
  gender?: 'male' | 'female';
  height?: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions?: ('PG' | 'SG' | 'SF' | 'PF' | 'C')[];
  regionCode?: string;
  // 场地方专属（球员可选）
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
}

// 登录请求
export interface LoginDto {
  phone: string;
  password: string;
}

// 刷新 Token 请求
export interface RefreshTokenDto {
  refreshToken: string;
}

// 认证响应中的用户摘要
export interface AuthUser {
  id: number;
  phone: string;
  nickname: string;
  userType: UserType;
  avatarUrl?: string;
  status: UserStatus;
  regionCode?: string;
}

// 认证响应（登录/注册/刷新）
export interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
}

export type AuthApiResponse = ApiResponse<AuthResponse>;
