/**
 * 意向分身（Intention Avatar）
 *
 * 一个意向若有 N 个场地偏好和 M 个赛制偏好，则产生 N × M 个分身。
 * 每个分身代表该意向在特定场地+赛制组合下的独立匹配实体。
 */
export interface IntentionAvatar {
  /** 分身唯一标识: `${intentionId}_${venueId}_${formatId}` */
  id: string;

  /** 原始意向 ID */
  intentionId: number;

  /** 球员 ID */
  playerId: number;

  /** 球员总能力值 */
  totalAbilityScore: number;

  /** 分身场地 ID */
  venueId: number;

  /** 分身赛制 ID */
  formatId: number;

  /** 意向开始时间 */
  startTime: Date;

  /** 可接受等待分钟数 */
  acceptableWaitMinutes: number;

  /** 意向持续分钟数 */
  durationMinutes: number;

  /** 意向提交时间 */
  submittedAt: Date;

  /** 时间窗口结束 = startTime + acceptableWaitMinutes */
  timeWindowEnd: Date;
}

/**
 * 构建意向分身所需的原始意向信息
 */
export interface AvatarSource {
  intentionId: number;
  playerId: number;
  totalAbilityScore: number;
  startTime: Date;
  acceptableWaitMinutes: number;
  durationMinutes: number;
  submittedAt: Date;
  venueIds: number[];
  formatIds: number[];
}
