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
  openTime?: string;   // HH:mm, 默认 08:00
  closeTime?: string;  // HH:mm, 默认 22:00
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
  displaySlots?: Record<string, VenueDisplaySlot[]>; // 按日期分组的连续展示时段
}

// 新增：不可预订时段
export interface VenueUnavailableSlot {
  id: number;
  venueId: number;
  slotDate: string;  // YYYY-MM-DD
  startTime: string; // HH:mm（15分钟粒度）
  endTime: string;   // HH:mm（15分钟粒度）
  reason?: string;
}

// 新增：展示时段（连续时间轴）
export interface VenueDisplaySlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  status: 'available' | 'unavailable' | 'booked';
  reason?: string;   // unavailable/booked 时显示原因
  matchId?: number;  // booked 时关联的比赛ID
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

// 场地列表项（含主要展示字段）
export interface VenueListItem {
  id: number;
  name: string;
  address: string;
  pricePerHour: number;
  courtCount: number;
  floorMaterial?: FloorMaterial;
  courtType?: CourtType;
  ventilation?: boolean;
  bigFan?: boolean;
  airCondition?: boolean;
  parking?: boolean;
  restroom?: boolean;
  shower?: boolean;
  lockerRoom?: boolean;
  videoRecord?: boolean;
  status: VenueStatus;
  ratingAvg?: number;
  ratingCount?: number;
}
