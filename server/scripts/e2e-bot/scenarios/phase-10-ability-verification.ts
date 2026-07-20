/**
 * Phase 10: 能力值专项验证
 *
 * 全局验证所有 confirmed/in_progress/completed 比赛的球员能力值变化：
 * - adjust 累计计算准确性
 * - 边界值 [-50, 50] 限制
 * - total = base + adjust 计算正确性
 * - 生成能力值变化报告
 */

import { DataSource } from 'typeorm';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { DbTools } from '../helpers/db-tools';

export async function runAbilityVerificationPhase(
  matchIds: number[],
  dataSource: DataSource,
  metrics: MetricsCollector,
  report: ReportGenerator,
  dbTools: DbTools,
): Promise<void> {
  report.startPhase('Phase 10: 能力值专项验证');

  // ─── 10.1 查询所有可用比赛的球员能力值 ───
  report.printInfo('步骤 10.1', '查询所有 confirmed 比赛球员能力值');

  const start = performance.now();
  try {
    const playerAbilities = await dbTools.getConfirmedMatchPlayerAbilities();
    const durationMs = Math.round(performance.now() - start);
    metrics.record('能力值查询', 'success', durationMs);

    report.addSuccess('能力值查询', `共 ${playerAbilities.length} 条记录（${matchIds.length} 场比赛）`, durationMs);

    // ─── 10.2 验证 total = base + adjust ───
    report.printInfo('步骤 10.2', '验证 total = base + adjust');

    let totalCorrect = 0;
    let totalIncorrect = 0;
    const incorrectDetails: string[] = [];

    for (const record of playerAbilities) {
      const calculated = record.base_ability_score + record.match_adjust_value;
      const actual = record.total_ability_score;
      const match = Math.abs(calculated - actual) < 0.01;

      if (match) {
        totalCorrect++;
      } else {
        totalIncorrect++;
        incorrectDetails.push(
          `matchId=${record.match_id} playerId=${record.player_id} ${record.nickname}: ` +
          `base=${record.base_ability_score} adjust=${record.match_adjust_value} ` +
          `calculated=${calculated.toFixed(2)} actual=${actual}`
        );
      }
    }

    report.addSuccess(
      'total计算',
      `${totalCorrect}/${playerAbilities.length} 正确, ${totalIncorrect} 错误`,
    );

    if (totalIncorrect > 0) {
      for (const detail of incorrectDetails.slice(0, 5)) {
        report.addFailure('total计算', detail);
      }
      if (incorrectDetails.length > 5) {
        report.addFailure('total计算', `... 还有 ${incorrectDetails.length - 5} 条错误记录`);
      }
    }

    // ─── 10.3 验证 adjust 范围 [-50, 50] ───
    report.printInfo('步骤 10.3', '验证 adjust 范围 [-50, 50]');

    let inRange = 0;
    let outOfRange = 0;
    const outOfRangeDetails: string[] = [];

    for (const record of playerAbilities) {
      const adjust = record.match_adjust_value;
      if (adjust >= -50 && adjust <= 50) {
        inRange++;
      } else {
        outOfRange++;
        outOfRangeDetails.push(
          `matchId=${record.match_id} playerId=${record.player_id} ${record.nickname}: adjust=${adjust}`
        );
      }
    }

    report.addSuccess(
      'adjust范围',
      `${inRange}/${playerAbilities.length} 在范围内, ${outOfRange} 越界`,
    );

    if (outOfRange > 0) {
      for (const detail of outOfRangeDetails.slice(0, 5)) {
        report.addFailure('adjust范围', detail);
      }
      if (outOfRangeDetails.length > 5) {
        report.addFailure('adjust范围', `... 还有 ${outOfRangeDetails.length - 5} 条越界记录`);
      }
    }

    // ─── 10.4 生成能力值变化统计 ───
    report.printInfo('步骤 10.4', '能力值变化统计');

    const adjustValues = playerAbilities.map((r) => r.match_adjust_value);
    const minAdjust = Math.min(...adjustValues);
    const maxAdjust = Math.max(...adjustValues);
    const avgAdjust = adjustValues.reduce((a, b) => a + b, 0) / adjustValues.length;
    const positiveAdjust = adjustValues.filter((v) => v > 0).length;
    const negativeAdjust = adjustValues.filter((v) => v < 0).length;
    const zeroAdjust = adjustValues.filter((v) => v === 0).length;

    report.addSuccess(
      'adjust统计',
      `min=${minAdjust.toFixed(2)} max=${maxAdjust.toFixed(2)} avg=${avgAdjust.toFixed(2)} ` +
      `正=${positiveAdjust} 负=${negativeAdjust} 零=${zeroAdjust}`,
    );

    // ─── 10.5 按比赛分组统计 ───
    report.printInfo('步骤 10.5', '按比赛分组统计');

    const matchGroups = new Map<number, typeof playerAbilities>();
    for (const record of playerAbilities) {
      if (!matchGroups.has(record.match_id)) {
        matchGroups.set(record.match_id, []);
      }
      matchGroups.get(record.match_id)!.push(record);
    }

    for (const [matchId, players] of Array.from(matchGroups.entries())) {
      const avgBase = players.reduce((sum, p) => sum + p.base_ability_score, 0) / players.length;
      const avgTotal = players.reduce((sum, p) => sum + p.total_ability_score, 0) / players.length;
      const avgAdjust = players.reduce((sum, p) => sum + p.match_adjust_value, 0) / players.length;

      report.addSuccess(
        '比赛能力值',
        `matchId=${matchId} ${players.length}人: base_avg=${avgBase.toFixed(2)} ` +
        `adjust_avg=${avgAdjust.toFixed(2)} total_avg=${avgTotal.toFixed(2)}`,
      );
    }

    // ─── 10.6 验证数据隔离（未参与比赛球员）───
    report.printInfo('步骤 10.6', '验证未参与比赛球员能力值');

    const matchPlayerIds = new Set(playerAbilities.map((r) => r.player_id));
    const allPlayers = await dataSource.query(
      `SELECT id, nickname, base_ability_score, match_adjust_value, total_ability_score
       FROM players ORDER BY id`,
    );

    let isolationPass = 0;
    let isolationFail = 0;

    for (const player of allPlayers) {
      if (!matchPlayerIds.has(player.id)) {
        // 未参与 confirmed 比赛的球员，adjust 应该为 0
        if (player.match_adjust_value === 0) {
          isolationPass++;
        } else {
          isolationFail++;
          if (isolationFail <= 3) {
            report.addFailure(
              '数据隔离',
              `playerId=${player.id} ${player.nickname}: 未参与 confirmed 比赛但 adjust=${player.match_adjust_value}`,
            );
          }
        }
      }
    }

    report.addSuccess(
      '数据隔离',
      `未参与 confirmed 比赛球员 ${isolationPass} 人 adjust=0, ${isolationFail} 人异常`,
    );

  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    metrics.record('能力值查询', 'error', durationMs, err.message);
    report.addFailure('能力值查询', err.message, durationMs);
  }

  report.endPhase();
}
