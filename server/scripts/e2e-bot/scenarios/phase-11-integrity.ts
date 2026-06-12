/**
 * Phase 11: SQL 数据完整性校验
 *
 * 调用 SqlVerifier 执行 10 项 JOIN 查询，验证全流程后的数据一致性。
 */

import { DataSource } from 'typeorm';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';
import { SqlVerifier, IntegrityResult } from '../helpers/sql-verifier';

export interface IntegrityPhaseResult {
  total: number;
  passed: number;
  failed: number;
  results: IntegrityResult[];
}

export async function runIntegrityPhase(
  dataSource: DataSource,
  metrics: MetricsCollector,
  report: ReportGenerator,
): Promise<IntegrityPhaseResult> {
  report.startPhase('Phase 11: SQL 数据完整性校验');

  const verifier = new SqlVerifier(dataSource);

  const start = performance.now();
  let results: IntegrityResult[] = [];

  try {
    results = await verifier.runAll(report);
    const durationMs = Math.round(performance.now() - start);
    metrics.record('SQL 完整性校验', 'success', durationMs);

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    report.printDivider();
    report.printInfo(
      '完整性汇总',
      `${passed}/${results.length} 通过, ${failed} 失败 (${durationMs}ms)`,
    );

    if (failed > 0) {
      report.addFailure(
        '完整性检查',
        `${failed} 项未通过: ${results.filter((r) => !r.passed).map((r) => r.label).join(', ')}`,
        durationMs,
      );
    } else {
      report.addSuccess(
        '完整性检查',
        `全部 ${results.length} 项通过 ✅`,
        durationMs,
      );
    }

    report.endPhase();
    return { total: results.length, passed, failed, results };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    metrics.record('SQL 完整性校验', 'error', durationMs, err.message);
    report.addFailure('完整性检查异常', err.message, durationMs);
    report.endPhase();
    return { total: 0, passed: 0, failed: 0, results: [] };
  }
}
