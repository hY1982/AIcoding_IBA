export declare const FLOOR_MATERIALS: readonly ["wood", "pu", "silicone", "cement", "other"];
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];
export declare const FLOOR_MATERIAL_LABELS: Record<FloorMaterial, string>;
export declare const COURT_TYPES: readonly ["indoor", "outdoor", "semi"];
export type CourtType = (typeof COURT_TYPES)[number];
export declare const COURT_TYPE_LABELS: Record<CourtType, string>;
export declare const VENUE_STATUSES: readonly ["active", "inactive"];
export type VenueStatus = (typeof VENUE_STATUSES)[number];
export declare const VENUE_STATUS_LABELS: Record<VenueStatus, string>;
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
export interface VenueDetail extends Venue {
    floorMaterial?: FloorMaterial;
    lighting?: string;
    courtType?: CourtType;
    ventilation?: boolean;
    bigFan?: boolean;
    airCondition?: boolean;
    turnoverTime?: number;
    parking?: boolean;
    restroom?: boolean;
    shower?: boolean;
    lockerRoom?: boolean;
    videoRecord?: boolean;
    timeSlots?: VenueTimeSlot[];
}
export interface VenueTimeSlot {
    id: number;
    venueId: number;
    slotDate: string;
    startTime: string;
    endTime: string;
    isBooked: boolean;
    matchId?: number;
}
export interface VenueListItem {
    id: number;
    name: string;
    address: string;
    pricePerHour: number;
    courtCount: number;
    ratingAvg?: number;
    ratingCount?: number;
}
