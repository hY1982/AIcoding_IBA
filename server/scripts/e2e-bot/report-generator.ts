/**
 * E2E Bot 测试 — 报告生成器（Console 彩色输出 + JSON 报告文件）
 */

import * as fs from 'fs';
import * as path from 'path';
import { MetricsCollector, MetricsSummary } from './metrics-collector';
import { REPORT_OUTPUT_DIR } from './config';

// 颜色
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

export interface TestResult {
  label: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  detail?: string;
}

export interface PhaseResult {
  name: string;
  results: TestResult[];
  totalDurationMs: number;
}

export interface IntegrityCheck {
  label: string;
  status: 'PASS' | 'FAIL';
  sql?: string;
  detail?: string;
}

export class ReportGenerator {
  private phases: PhaseResult[] = [];
  private currentPhase: PhaseResult | null = null;
  private integrityChecks: IntegrityCheck[] = [];
  private humanActions: Array<{ phase: string; action: string; durationMs: number }> = [];
  private startTime = Date.now();

  // ─── Phase 管理 ───

  startPhase(name: string): void {
    this.currentPhase = { name, results: [], totalDurationMs: 0 };
    const line = '═'.repeat(58);
    console.log(`\n${CYAN}${BOLD}${line}${RESET}`);
    console.log(`${CYAN}${BOLD}  ${name}${RESET}`);
    console.log(`${CYAN}${BOLD}${line}${RESET}`);
  }

  endPhase(): void {
    if (!this.currentPhase) return;
    const phase = this.currentPhase;
    phase.totalDurationMs = phase.results.reduce((sum, r) => sum + r.durationMs, 0);

    const passed = phase.results.filter((r) => r.status === 'PASS').length;
    const failed = phase.results.filter((r) => r.status === 'FAIL').length;
    const skipped = phase.results.filter((r) => r.status === 'SKIP').length;

    console.log(`  ${'─'.repeat(54)}`);
    console.log(
      `  ${BOLD}Phase 结果:${RESET} ${GREEN}${passed} 通过${RESET}` +
      (failed > 0 ? ` | ${RED}${failed} 失败${RESET}` : '') +
      (skipped > 0 ? ` | ${YELLOW}${skipped} 跳过${RESET}` : '') +
      ` | 总耗时: ${(phase.totalDurationMs / 1000).toFixed(1)}s`,
    );

    this.phases.push(phase);
    this.currentPhase = null;
  }

  // ─── 结果记录 ───

  addResult(label: string, status: 'PASS' | 'FAIL' | 'SKIP', durationMs = 0, detail?: string): void {
    const result: TestResult = { label, status, durationMs, detail };
    if (this.currentPhase) {
      this.currentPhase.results.push(result);
    }

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    const color = status === 'PASS' ? GREEN : status === 'FAIL' ? RED : YELLOW;
    const suffix = detail ? ` | ${detail}` : '';
    const timeSuffix = durationMs > 0 ? ` (${durationMs}ms)` : '';
    console.log(`  ${color}${icon} [${status}]${RESET} ${label}${timeSuffix}${suffix}`);
  }

  addSuccess(label: string, detail?: string, durationMs = 0): void {
    this.addResult(label, 'PASS', durationMs, detail);
  }

  addFailure(label: string, detail?: string, durationMs = 0): void {
    this.addResult(label, 'FAIL', durationMs, detail);
  }

  addSkip(label: string, detail?: string): void {
    this.addResult(label, 'SKIP', 0, detail);
  }

  // ─── 完整性检查 ───

  addIntegrityCheck(label: string, passed: boolean, sql?: string, detail?: string): void {
    const check: IntegrityCheck = { label, status: passed ? 'PASS' : 'FAIL', sql, detail };
    this.integrityChecks.push(check);
    this.addResult(`[DB] ${label}`, passed ? 'PASS' : 'FAIL', 0, detail);
  }

  // ─── 真人操作记录 ───

  recordHumanAction(phase: string, action: string, durationMs: number): void {
    this.humanActions.push({ phase, action, durationMs });
  }

  // ─── 信息输出 ───

  printInfo(label: string, value: string): void {
    console.log(`  ${BLUE}ℹ️  ${label}${RESET} | ${value}`);
  }

  printWarning(label: string, value: string): void {
    console.log(`  ${YELLOW}⚠️  ${label}${RESET} | ${value}`);
  }

  printDivider(): void {
    console.log(`  ${'─'.repeat(54)}`);
  }

  // ─── 最终报告 ───

  async writeReport(scenarioName: string, metrics: MetricsCollector): Promise<string> {
    const totalDurationMs = Date.now() - this.startTime;
    const allResults = this.phases.flatMap((p) => p.results);
    const passed = allResults.filter((r) => r.status === 'PASS').length;
    const failed = allResults.filter((r) => r.status === 'FAIL').length;
    const skipped = allResults.filter((r) => r.status === 'SKIP').length;
    const total = allResults.length;

    const metricsSummary = metrics.getSummary();

    const report = {
      timestamp: new Date().toISOString(),
      scenario: scenarioName,
      duration: `${(totalDurationMs / 1000).toFixed(1)}s`,
      environment: {
        node: process.version,
        platform: process.platform,
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      summary: {
        totalTests: total,
        passed,
        failed,
        skipped,
        passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%',
        totalDurationMs,
      },
      phases: this.phases.map((p) => ({
        name: p.name,
        passed: p.results.filter((r) => r.status === 'PASS').length,
        failed: p.results.filter((r) => r.status === 'FAIL').length,
        skipped: p.results.filter((r) => r.status === 'SKIP').length,
        totalDurationMs: p.totalDurationMs,
        results: p.results,
      })),
      metrics: metricsSummary,
      integrityChecks: this.integrityChecks,
      humanActions: this.humanActions,
    };

    // 输出到文件
    const filename = `e2e-bot-report-${scenarioName}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const outputPath = path.join(process.cwd(), REPORT_OUTPUT_DIR, filename);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    // Console 汇总
    this.printFinalSummary(report);

    return outputPath;
  }

  private printFinalSummary(report: any): void {
    const line = '═'.repeat(58);
    console.log(`\n${CYAN}${BOLD}${line}${RESET}`);
    console.log(`${CYAN}${BOLD}  📊 测试报告汇总${RESET}`);
    console.log(`${CYAN}${BOLD}${line}${RESET}`);

    const s = report.summary;
    const passColor = s.failed > 0 ? RED : GREEN;
    console.log(`  总测试: ${BOLD}${s.totalTests}${RESET}`);
    console.log(`  ${GREEN}通过: ${s.passed}${RESET} | ${RED}失败: ${s.failed}${RESET} | ${YELLOW}跳过: ${s.skipped}${RESET}`);
    console.log(`  ${BOLD}通过率: ${passColor}${s.passRate}${RESET}`);
    console.log(`  总耗时: ${(s.totalDurationMs / 1000).toFixed(1)}s`);

    // 完整性检查汇总
    const dbPassed = this.integrityChecks.filter((c) => c.status === 'PASS').length;
    const dbTotal = this.integrityChecks.length;
    console.log(`  数据完整性: ${dbTotal > 0 ? (dbPassed === dbTotal ? GREEN : RED) : BLUE}${dbPassed}/${dbTotal}${RESET}`);

    // 性能指标 Top 5
    const metricsEntries = Object.entries(report.metrics.scenarios || {}) as Array<[string, any]>;
    if (metricsEntries.length > 0) {
      console.log(`\n  ${BOLD}性能指标 (Top 5 耗时操作):${RESET}`);
      const sorted = metricsEntries
        .sort((a, b) => (b[1].timing?.avg || 0) - (a[1].timing?.avg || 0))
        .slice(0, 5);
      for (const [label, m] of sorted) {
        console.log(
          `    ${label}: avg=${m.timing.avg}ms p95=${m.timing.p95}ms ` +
          `(${m.success}/${m.total} 成功)`,
        );
      }
    }

    console.log(`\n${CYAN}${BOLD}${line}${RESET}`);
    console.log(`${CYAN}${BOLD}  测试完成！${RESET}`);
    console.log(`${CYAN}${BOLD}${line}${RESET}\n`);
  }
}
