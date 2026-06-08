export declare const FORMAT_TYPES: readonly ["short", "long"];
export type FormatType = (typeof FORMAT_TYPES)[number];
export declare const FORMAT_TYPE_LABELS: Record<FormatType, string>;
export interface Format {
    id: number;
    name: string;
    formatType: FormatType;
    teamSize: number;
    teamCountMin: number;
    teamCountMax: number;
    winCondition?: string;
    durationHours?: number;
    description?: string;
    isActive: boolean;
    createdAt: string;
}
