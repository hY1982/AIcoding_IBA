import { ApiResponse, TokenPair, UserType, UserStatus } from './common';
import { Gender, BasketballPosition } from './player';

// 注册请求 — 可辨识联合类型：根据 userType 区分必填字段
interface BaseRegisterDto {
  phone: string;
  password: string;
  nickname: string;
  regionCode?: string;
}

export interface PlayerRegisterDto extends BaseRegisterDto {
  userType: 'player';
  birthDate: string; // 生日 YYYY-MM-DD
  startPlayingDate: string; // 开始打球年月 YYYY-MM
  gender: Gender;
  height: number;
  weight?: number;
  wingspan?: number;
  standingReach?: number;
  jumpingReach?: number;
  positions?: BasketballPosition[];
}

export interface VenueManagerRegisterDto extends BaseRegisterDto {
  userType: 'venue_manager';
  companyName: string;
  contactName: string;
  contactPhone: string;
}

export type RegisterDto = PlayerRegisterDto | VenueManagerRegisterDto;

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
