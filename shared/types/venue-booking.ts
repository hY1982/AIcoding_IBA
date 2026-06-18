// 场地预订请求状态 — v2.0 新增
export const BOOKING_REQUEST_STATUSES = [
  'pending',        // 等待场地方响应
  'confirmed',      // 场地方手动确认
  'auto_confirmed', // 30分钟超时系统自动确认
  'rejected',       // 场地方拒绝
  'cancelled',      // 比赛取消连带取消
] as const;
export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

/**
 * 场地预订请求状态标签
 */
export const BOOKING_REQUEST_STATUS_LABELS: Record<BookingRequestStatus, string> = {
  pending: '等待确认',
  confirmed: '已确认',
  auto_confirmed: '系统自动确认',
  rejected: '已拒绝',
  cancelled: '已取消',
};

/**
 * 场地预订请求状态机
 */
export const BOOKING_REQUEST_STATUS_TRANSITIONS: Record<
  BookingRequestStatus,
  BookingRequestStatus[]
> = {
  pending: ['confirmed', 'auto_confirmed', 'rejected', 'cancelled'],
  confirmed: [],
  auto_confirmed: [],
  rejected: [],
  cancelled: [],
};

/**
 * 场地预订请求（API 响应契约）
 */
export interface VenueBookingRequest {
  id: number;
  matchId: number;
  venueId: number;
  slotDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  status: BookingRequestStatus;
  requestedAt: string; // ISO 8601
  respondedAt: string | null;
  responseDeadline: string; // ISO 8601
  rejectionReason: string | null;
}
