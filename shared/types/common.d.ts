export interface ApiResponse<T = unknown> {
    code: number;
    message: string;
    data: T;
}
export interface PaginationParams {
    page: number;
    pageSize: number;
}
export interface PaginatedResponse<T> {
    page: number;
    pageSize: number;
    total: number;
    list: T[];
}
export declare const DEFAULT_PAGE_SIZE = 10;
export declare const MAX_PAGE_SIZE = 100;
export declare const USER_STATUSES: readonly ["active", "inactive", "banned"];
export type UserStatus = (typeof USER_STATUSES)[number];
export declare const USER_STATUS_LABELS: Record<UserStatus, string>;
export declare const USER_TYPES: readonly ["player", "venue_manager"];
export type UserType = (typeof USER_TYPES)[number];
export declare const USER_TYPE_LABELS: Record<UserType, string>;
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
export interface Timestamps {
    createdAt: string;
    updatedAt: string;
}
