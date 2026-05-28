// 赛制类型 — 联合类型 + const 数组
export const FORMAT_TYPES = ['short', 'long'] as const;
export type FormatType = (typeof FORMAT_TYPES)[number];
export const FORMAT_TYPE_LABELS: Record<FormatType, string> = {
  short: '短赛',
  long: '长赛',
};

export interface Format {
  id: number;
  name: string;
  formatType: FormatType;
  teamSize: number;
  teamCountMin: number;
  teamCountMax: number;
  winCondition?: string;
  /** 预计总占用时长（包含热身与间歇），单位：小时 */
  durationHours?: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}
