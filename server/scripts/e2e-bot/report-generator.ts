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

export interface SystemStatus {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  conclusions: string[];
  issuesFound: string[];
  potentialRisks: string[];
}

export interface MatchingFrequencyRecord {
  timestamp: string;
  intentionsScanned: number;
  matchesCreated: number;
  matchesFailed: number;
  expiredCount: number;
  durationMs: number;
}

export interface FailureAnalysis {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface EnhancedReport {
  timestamp: string;
  scenario: string;
  duration: string;
  environment: {
    node: string;
    platform: string;
    memoryMB: number;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: string;
    totalDurationMs: number;
  };
  systemStatus: SystemStatus;
  matchSuccessRate?: {
    totalIntentions: number;
    matchedIntentions: number;
    successRate: string;
    multiSelectSuccessRate?: string;
    singleSelectSuccessRate?: string;
  };
  failureAnalysis: FailureAnalysis[];
  performanceMetrics: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
    min: number;
  };
  matchingFrequency: MatchingFrequencyRecord[];
  phases: Array<{
    name: string;
    passed: number;
    failed: number;
    skipped: number;
    totalDurationMs: number;
    results: TestResult[];
  }>;
  metrics: MetricsSummary;
  integrityChecks: IntegrityCheck[];
  humanActions: Array<{ phase: string; action: string; durationMs: number }>;
}

export class ReportGenerator {
  private phases: PhaseResult[] = [];
  private currentPhase: PhaseResult | null = null;
  private integrityChecks: IntegrityCheck[] = [];
  private humanActions: Array<{ phase: string; action: string; durationMs: number }> = [];
  private startTime = Date.now();
  private systemStatus: SystemStatus = {
    overallHealth: 'healthy',
    conclusions: [],
    issuesFound: [],
    potentialRisks: [],
  };
  private matchingFrequency: MatchingFrequencyRecord[] = [];
  private failureAnalysis: FailureAnalysis[] = [];
  private matchSuccessRate?: {
    totalIntentions: number;
    matchedIntentions: number;
    successRate: string;
    multiSelectSuccessRate?: string;
    singleSelectSuccessRate?: string;
  };
  private performanceMetrics = { p50: 0, p95: 0, p99: 0, avg: 0, max: 0, min: 0 };

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

  // ─── 增强报告数据 ───

  setSystemStatus(status: SystemStatus): void {
    this.systemStatus = status;
  }

  addSystemConclusion(conclusion: string): void {
    this.systemStatus.conclusions.push(conclusion);
  }

  addIssueFound(issue: string): void {
    this.systemStatus.issuesFound.push(issue);
    if (this.systemStatus.overallHealth === 'healthy') {
      this.systemStatus.overallHealth = 'degraded';
    }
  }

  addPotentialRisk(risk: string): void {
    this.systemStatus.potentialRisks.push(risk);
  }

  recordMatchingFrequency(record: MatchingFrequencyRecord): void {
    this.matchingFrequency.push(record);
  }

  setFailureAnalysis(analysis: FailureAnalysis[]): void {
    this.failureAnalysis = analysis;
  }

  setMatchSuccessRate(rate: typeof this.matchSuccessRate): void {
    this.matchSuccessRate = rate;
  }

  setPerformanceMetrics(metrics: typeof this.performanceMetrics): void {
    this.performanceMetrics = metrics;
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

    // 计算整体性能指标
    const allDurations = allResults.filter((r) => r.durationMs > 0).map((r) => r.durationMs).sort((a, b) => a - b);
    if (allDurations.length > 0) {
      const sum = allDurations.reduce((a, b) => a + b, 0);
      this.performanceMetrics = {
        p50: this.percentile(allDurations, 50),
        p95: this.percentile(allDurations, 95),
        p99: this.percentile(allDurations, 99),
        avg: Math.round(sum / allDurations.length),
        max: allDurations[allDurations.length - 1],
        min: allDurations[0],
      };
    }

    // 根据失败率判断系统健康状态
    const failRate = total > 0 ? failed / total : 0;
    if (failRate > 0.3) {
      this.systemStatus.overallHealth = 'critical';
    } else if (failRate > 0.1) {
      this.systemStatus.overallHealth = 'degraded';
    }

    const report: EnhancedReport = {
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
      systemStatus: this.systemStatus,
      matchSuccessRate: this.matchSuccessRate,
      failureAnalysis: this.failureAnalysis,
      performanceMetrics: this.performanceMetrics,
      matchingFrequency: this.matchingFrequency,
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

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  private printFinalSummary(report: EnhancedReport): void {
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

    // 系统状态
    const healthColor = report.systemStatus.overallHealth === 'healthy' ? GREEN : report.systemStatus.overallHealth === 'degraded' ? YELLOW : RED;
    console.log(`\n  ${BOLD}系统状态: ${healthColor}${report.systemStatus.overallHealth}${RESET}`);
    if (report.systemStatus.conclusions.length > 0) {
      console.log(`  ${BOLD}结论:${RESET}`);
      for (const c of report.systemStatus.conclusions) {
        console.log(`    • ${c}`);
      }
    }

    // 匹配成功率
    if (report.matchSuccessRate) {
      console.log(`\n  ${BOLD}匹配成功率:${RESET}`);
      console.log(`    总意向: ${report.matchSuccessRate.totalIntentions}`);
      console.log(`    已匹配: ${report.matchSuccessRate.matchedIntentions}`);
      console.log(`    成功率: ${report.matchSuccessRate.successRate}`);
      if (report.matchSuccessRate.multiSelectSuccessRate) {
        console.log(`    多选意向成功率: ${report.matchSuccessRate.multiSelectSuccessRate}`);
      }
      if (report.matchSuccessRate.singleSelectSuccessRate) {
        console.log(`    单选意向成功率: ${report.matchSuccessRate.singleSelectSuccessRate}`);
      }
    }

    // 失败分析
    if (report.failureAnalysis.length > 0) {
      console.log(`\n  ${BOLD}失败原因分析:${RESET}`);
      for (const fa of report.failureAnalysis) {
        console.log(`    ${fa.category}: ${fa.count} (${fa.percentage.toFixed(1)}%)`);
      }
    }

    // 性能指标
    console.log(`\n  ${BOLD}性能指标:${RESET}`);
    console.log(`    P50: ${report.performanceMetrics.p50}ms`);
    console.log(`    P95: ${report.performanceMetrics.p95}ms`);
    console.log(`    P99: ${report.performanceMetrics.p99}ms`);
    console.log(`    AVG: ${report.performanceMetrics.avg}ms`);
    console.log(`    MAX: ${report.performanceMetrics.max}ms`);

    // 匹配频率
    if (report.matchingFrequency.length > 0) {
      console.log(`\n  ${BOLD}匹配执行频率 (${report.matchingFrequency.length} 次):${RESET}`);
      for (const mf of report.matchingFrequency) {
        console.log(`    ${mf.timestamp}: 扫描=${mf.intentionsScanned}, 创建=${mf.matchesCreated}, 失败=${mf.matchesFailed}, 过期=${mf.expiredCount}, 耗时=${mf.durationMs}ms`);
      }
    }

    // 完整性检查汇总
    const dbPassed = this.integrityChecks.filter((c) => c.status === 'PASS').length;
    const dbTotal = this.integrityChecks.length;
    console.log(`\n  数据完整性: ${dbTotal > 0 ? (dbPassed === dbTotal ? GREEN : RED) : BLUE}${dbPassed}/${dbTotal}${RESET}`);

    // 发现的问题
    if (report.systemStatus.issuesFound.length > 0) {
      console.log(`\n  ${RED}${BOLD}发现的问题 (${report.systemStatus.issuesFound.length}):${RESET}`);
      for (const issue of report.systemStatus.issuesFound) {
        console.log(`    ❌ ${issue}`);
      }
    }

    // 潜在风险
    if (report.systemStatus.potentialRisks.length > 0) {
      console.log(`\n  ${YELLOW}${BOLD}潜在风险 (${report.systemStatus.potentialRisks.length}):${RESET}`);
      for (const risk of report.systemStatus.potentialRisks) {
        console.log(`    ⚠️  ${risk}`);
      }
    }

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
