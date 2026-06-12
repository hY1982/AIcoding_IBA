/**
 * Phase 5: 匹配引擎执行 + 结果校验
 */

import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { DbTools } from '../helpers/db-tools';
import { DEFAULT_REGION } from '../config';

export interface MatchingPhaseResult {
  matchIds: number[];
  matchesCreated: number;
}

export async function runMatchingPhase(
  appContext: any,
  dbTools: DbTools,
  metrics: MetricsCollector,
  report: ReportGenerator,
): Promise<MatchingPhaseResult> {
  report.startPhase('Phase 5: 匹配引擎');

  const matchIds: number[] = [];

  // ─── 5.1 触发匹配引擎 ───
  report.printInfo('步骤 5.1', '手动触发匹配引擎');

  const start = performance.now();
  let matchResult: any;

  try {
    matchResult = await dbTools.triggerMatching(appContext, DEFAULT_REGION);
    const durationMs = Math.round(performance.now() - start);
    metrics.record('匹配引擎', 'success', durationMs);

    const scanned = matchResult?.intentionsScanned ?? matchResult?.totalIntentions ?? '?';
    const created = matchResult?.matchesCreated ?? matchResult?.totalMatches ?? '?';
    const failed = matchResult?.matchesFailed ?? matchResult?.failedMatches ?? 0;

    report.addSuccess('匹配引擎执行', `扫描=${scanned}, 创建=${created}, 失败=${failed}`, durationMs);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    metrics.record('匹配引擎', 'error', durationMs, err.message);
    report.addFailure('匹配引擎执行', err.message, durationMs);
    report.endPhase();
    return { matchIds, matchesCreated: 0 };
  }

  // ─── 5.2 查询已创建的比赛 ───
  report.printInfo('步骤 5.2', '查询比赛记录');

  try {
    const pendingMatches = await dbTools.getPendingConfirmationMatches();
    for (const m of pendingMatches) {
      matchIds.push(Number(m.id));
      report.addSuccess(`比赛记录`, `matchId=${m.id} totalPlayers=${m.total_players} status=pending_confirmation`);
    }

    if (pendingMatches.length === 0) {
      report.printWarning('无比赛', '匹配引擎未产生比赛，可能是意向数量不足或时间不匹配');
    }
  } catch (err: any) {
    report.addFailure('查询比赛', err.message);
  }

  // ─── 5.3 校验 MatchPlayer ───
  report.printInfo('步骤 5.3', '校验参赛球员');

  for (const matchId of matchIds) {
    try {
      const players = await dbTools.getMatchPlayers(matchId);
      const invitedCount = players.filter((p) => p.status === 'invited').length;
      report.addSuccess(
        `MatchPlayer`,
        `matchId=${matchId} ${players.length} 名球员, ${invitedCount} invited`,
      );

      // 验证所有球员都是 invited 状态
      if (invitedCount !== players.length) {
        report.addFailure(`MatchPlayer 状态`, `matchId=${matchId} 有 ${players.length - invitedCount} 个非 invited 状态`);
      }
    } catch (err: any) {
      report.addFailure(`MatchPlayer 校验`, `matchId=${matchId} ${err.message}`);
    }
  }

  report.printInfo('匹配汇总', `${matchIds.length} 场比赛已创建`);

  report.endPhase();
  return { matchIds, matchesCreated: matchIds.length };
}
