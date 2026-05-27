import { PlayerProfile, PlayerAttributes, BasketballPosition } from '@shared/player';
import { Venue, VenueListItem, VenueStatus, VENUE_STATUSES } from '@shared/venue';
import { ApiResponse, PaginatedResponse, UserType, USER_TYPES } from '@shared/common';

// 类型验证：确保关键接口可解析（编译时检查）
export type VerifyPlayerProfile = PlayerProfile;
export type VerifyPlayerAttributes = PlayerAttributes;
export type VerifyBasketballPosition = BasketballPosition;
export type VerifyVenue = Venue;
export type VerifyVenueListItem = VenueListItem;
export type VerifyUserType = UserType;
export type VerifyVenueStatus = VenueStatus;
export type VerifyApiResponse = ApiResponse<unknown>;
export type VerifyPaginatedResponse = PaginatedResponse<Venue>;

// 运行时常量验证
export const verifyVenueStatuses: readonly string[] = VENUE_STATUSES;
export const verifyUserTypes: readonly string[] = USER_TYPES;
