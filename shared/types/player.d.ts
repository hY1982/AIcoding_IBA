import { Timestamps } from './common';
export declare const BASKETBALL_POSITIONS: readonly ["PG", "SG", "SF", "PF", "C"];
export type BasketballPosition = (typeof BASKETBALL_POSITIONS)[number];
export declare const POSITION_LABELS: Record<BasketballPosition, string>;
export declare const GENDERS: readonly ["male", "female"];
export type Gender = (typeof GENDERS)[number];
export declare const GENDER_LABELS: Record<Gender, string>;
export interface PlayerPosition {
    position: BasketballPosition;
    priority: number;
}
export interface PlayerAttributes {
    age: number;
    basketballAge: number;
    gender: Gender;
    height: number;
    weight?: number;
    wingspan?: number;
    standingReach?: number;
    jumpingReach?: number;
    positions: BasketballPosition[];
    regionCode?: string;
}
export interface PlayerAbilityInput {
    baseAbilityScore: number;
    matchAdjustValue: number;
}
export interface PlayerAbility extends PlayerAbilityInput {
    totalAbilityScore: number;
}
export interface PlayerProfile extends PlayerAttributes, PlayerAbility, Timestamps {
    id: number;
    userId: number;
    phone: string;
    nickname: string;
    realName: string;
    avatarUrl?: string;
}
export declare const TEAM_ROLES: readonly ["starter", "bench"];
export type TeamRole = (typeof TEAM_ROLES)[number];
export interface PlayerExtendedAttributes {
    benchPress?: number;
    handLength?: number;
    sprint100m?: number;
    run1000m?: number;
    run2000m?: number;
    run5000m?: number;
    runRecordDate?: string;
    teamExperience?: string[];
    teamRole?: TeamRole;
    breakthroughLevel?: number;
    passingLevel?: number;
    defenseLevel?: number;
}
export declare const SHOOTING_RECORD_TYPES: readonly ["free_throw", "three_point"];
export type ShootingRecordType = (typeof SHOOTING_RECORD_TYPES)[number];
export interface ShootingRecord {
    id: number;
    playerId: number;
    recordType: ShootingRecordType;
    shotsAttempted: number;
    shotsMade: number;
    recordDate: string;
}
export interface ShootingStats {
    recordType: ShootingRecordType;
    totalAttempted: number;
    totalMade: number;
    percentage: number;
}
