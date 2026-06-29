import { IntentionAvatar } from './intention-avatar.interface';

/**
 * 比赛池（Match Pool）
 *
 * 相同 venueId + 相同 formatId + 时间窗口重叠 的分身集合。
 * 由滑动窗口算法从同一 venue+format 组内的时间重叠分身合并而成。
 */
export interface MatchPool {
  /** 场地 ID */
  venueId: number;

  /** 赛制 ID */
  formatId: number;

  /** 池内所有分身 */
  avatars: IntentionAvatar[];

  /** 池内最早开始时间 */
  poolStartTime: Date;

  /** 池内最早截止时间点 = min(all timeWindowEnd) */
  poolEndTime: Date;
}

/**
 * 比赛段（Match Segment）
 *
 * 从比赛池中按能力值动态分段后，形成的一个独立候选比赛。
 */
export interface MatchSegment {
  /** 来源比赛池 */
  pool: MatchPool;

  /** 段内分身（已去重） */
  avatars: IntentionAvatar[];

  /** 比赛开始时间 = 最早截止时间点（对齐到整点或30分钟） */
  matchStartTime: Date;

  /** 比赛结束时间 */
  matchEndTime: Date;

  /** 球员确认截止时间 = matchStartTime - 1h */
  confirmDeadline: Date;

  /** 所需最少人数 = format.teamCountMin * format.teamSize */
  requiredPlayers: number;

  /** 最多人数 = format.teamCountMax * format.teamSize */
  maxPlayers: number;

  /** 赛制信息（用于创建 Match 记录） */
  format: {
    id: number;
    teamCountMin: number;
    teamCountMax: number;
    teamSize: number;
    durationHours: number | null;
  };
}

/**
 * 池化参数配置（从 system_params 读取）
 */
export interface PoolingParams {
  /** 段内能力值最大跨度（超过则多分一段） */
  maxAbilitySpread: number;

  /** 池内最少人数（低于此值不创建比赛） */
  minPoolSize: number;

  /** 比赛开始时间对齐粒度（分钟）默认30 */
  timeAlignmentMinutes: number;
}

/**
 * 池化服务结果
 */
export interface PoolingResult {
  /** 生成的比赛池列表 */
  pools: MatchPool[];

  /** 被废弃的分身数（因池内人数不足） */
  discardedAvatars: number;
}

/**
 * 分段服务结果
 */
export interface SegmentationResult {
  /** 生成的比赛段列表 */
  segments: MatchSegment[];

  /** 被废弃的分身数（因段内人数不足） */
  discardedAvatars: number;
}
