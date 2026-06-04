/**
 * 匹配任务结果摘要
 */
export interface MatchingResult {
  /** 扫描的意向总数 */
  intentionsScanned: number;

  /** 处理的分组数 */
  groupsProcessed: number;

  /** 成功创建的比赛数 */
  matchesCreated: number;

  /** 匹配失败的分组数 */
  matchesFailed: number;

  /** 过期取消的意向数 */
  expiredCount: number;

  /** 任务执行耗时（毫秒） */
  durationMs: number;
}
