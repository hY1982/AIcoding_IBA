import { RegisterDto, LoginDto, AuthUser, AuthResponse } from '@shared/auth';
import { PlayerProfile, PlayerAttributes, Gender, GENDERS } from '@shared/player';
import { Venue, VenueDetail, CourtType, COURT_TYPES } from '@shared/venue';
import { ApiResponse, TokenPair, DEFAULT_PAGE_SIZE } from '@shared/common';

// 类型验证：确保关键接口可解析（编译时检查）
export type VerifyRegisterDto = RegisterDto;
export type VerifyLoginDto = LoginDto;
export type VerifyAuthUser = AuthUser;
export type VerifyAuthResponse = AuthResponse;
export type VerifyPlayerProfile = PlayerProfile;
export type VerifyPlayerAttributes = PlayerAttributes;
export type VerifyGender = Gender;
export type VerifyVenue = Venue;
export type VerifyVenueDetail = VenueDetail;
export type VerifyCourtType = CourtType;
export type VerifyApiResponse = ApiResponse<unknown>;
export type VerifyTokenPair = TokenPair;

// 运行时常量验证
export const verifyDefaultPageSize: number = DEFAULT_PAGE_SIZE;
export const verifyGenders: readonly string[] = GENDERS;
export const verifyCourtTypes: readonly string[] = COURT_TYPES;
