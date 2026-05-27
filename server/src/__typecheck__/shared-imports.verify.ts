import { LoginDto, AuthResponse } from '@shared/auth';
import { PlayerProfile, PlayerAbility } from '@shared/player';
import { Venue, VenueDetail, VenueTimeSlot } from '@shared/venue';
import { ApiResponse, PaginatedResponse, TokenPair, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, USER_STATUSES, USER_TYPES } from '@shared/common';

// 类型验证：确保关键接口可解析（编译时检查）
export type VerifyLoginDto = LoginDto;
export type VerifyPlayerProfile = PlayerProfile;
export type VerifyVenue = Venue;
export type VerifyApiResponse = ApiResponse<unknown>;
export type VerifyPaginatedResponse = PaginatedResponse<Venue>;
export type VerifyTokenPair = TokenPair;
export type VerifyAuthResponse = AuthResponse;
export type VerifyPlayerAbility = PlayerAbility;
export type VerifyVenueDetail = VenueDetail;
export type VerifyVenueTimeSlot = VenueTimeSlot;

// 运行时常量验证
export const verifyDefaultPageSize: number = DEFAULT_PAGE_SIZE;
export const verifyMaxPageSize: number = MAX_PAGE_SIZE;
export const verifyUserStatuses: readonly string[] = USER_STATUSES;
export const verifyUserTypes: readonly string[] = USER_TYPES;
