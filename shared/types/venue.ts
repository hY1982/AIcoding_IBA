// 地面材质 — 联合类型 + const 数组
export const FLOOR_MATERIALS = ['wood', 'pu', 'silicone', 'cement', 'other'] as const;
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];
export const FLOOR_MATERIAL_LABELS: Record<FloorMaterial, string> = {
  wood: '木地板',
  pu: 'PU',
  silicone: '硅PU',
  cement: '水泥地',
  other: '其他',
};

// 场地类型 — 联合类型 + const 数组
export const COURT_TYPES = ['indoor', 'outdoor', 'semi'] as const;
export type CourtType = (typeof COURT_TYPES)[number];
export const COURT_TYPE_LABELS: Record<CourtType, string> = {
  indoor: '室内',
  outdoor: '室外',
  semi: '半室内',
};

// 场地状态 — 联合类型 + const 数组
export const VENUE_STATUSES = ['active', 'inactive'] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];
export const VENUE_STATUS_LABELS: Record<VenueStatus, string> = {
  active: '营业中',
  inactive: '已停业',
};

// 基础场地（MVP）
export interface Venue {
  id: number;
  managerId: number;
  name: string;
  address: string;
  pricePerHour: number;
  courtCount: number;
  latitude?: number;
  longitude?: number;
  status: VenueStatus;
  regionCode?: string;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
}

// 场地详情（含 P1 扩展字段 + 时段列表）
export interface VenueDetail extends Venue {
  floorMaterial?: FloorMaterial;
  lighting?: string;
  courtType?: CourtType;
  ventilation?: boolean;
  bigFan?: boolean;
  airCondition?: boolean;
  turnoverTime?: number; // 翻场时间，分钟
  parking?: boolean;
  restroom?: boolean;
  shower?: boolean;
  lockerRoom?: boolean;
  videoRecord?: boolean;
  timeSlots?: VenueTimeSlot[];
}

// 场地可预订时段
export interface VenueTimeSlot {
  id: number;
  venueId: number;
  slotDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isBooked: boolean;
  matchId?: number;
}

// 场地列表项（简化）
export interface VenueListItem {
  id: number;
  name: string;
  address: string;
  pricePerHour: number;
  courtCount: number;
  ratingAvg?: number;
  ratingCount?: number;
}
