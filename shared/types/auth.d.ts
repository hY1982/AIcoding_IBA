import { ApiResponse, TokenPair, UserType, UserStatus } from './common';
import { Gender, BasketballPosition } from './player';
interface BaseRegisterDto {
    phone: string;
    password: string;
    nickname: string;
    regionCode?: string;
}
export interface PlayerRegisterDto extends BaseRegisterDto {
    userType: 'player';
    age: number;
    basketballAge: number;
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
export interface LoginDto {
    phone: string;
    password: string;
}
export interface RefreshTokenDto {
    refreshToken: string;
}
export interface AuthUser {
    id: number;
    phone: string;
    nickname: string;
    userType: UserType;
    avatarUrl?: string;
    status: UserStatus;
    regionCode?: string;
}
export interface AuthResponse {
    user: AuthUser;
    tokens: TokenPair;
}
export type AuthApiResponse = ApiResponse<AuthResponse>;
export {};
