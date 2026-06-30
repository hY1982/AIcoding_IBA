/**
 * E2E Bot 测试 — 性能指标收集器
 */

export interface MetricsRecord {
  label: string;
  status: 'success' | 'error';
  durationMs: number;
  timestamp: number;
  error?: string;
}

export interface TimingStats {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

export interface ScenarioMetrics {
  total: number;
  success: number;
  error: number;
  successRate: number;
  timing: TimingStats;
}

export interface MetricsSummary {
  scenarios: Record<string, ScenarioMetrics>;
  overall: {
    totalOps: number;
    totalSuccess: number;
    totalError: number;
    totalDurationMs: number;
    memoryUsageMB: number;
  };
}

export class MetricsCollector {
  private records: MetricsRecord[] = [];
  private startTime = Date.now();

  record(label: string, status: 'success' | 'error', durationMs: number, error?: string): void {
    this.records.push({
      label,
      status,
      durationMs,
      timestamp: Date.now(),
      error,
    });
  }

  getRecords(): MetricsRecord[] {
    return this.records;
  }

  getSummary(): MetricsSummary {
    const grouped: Record<string, MetricsRecord[]> = {};
    for (const r of this.records) {
      if (!grouped[r.label]) grouped[r.label] = [];
      grouped[r.label].push(r);
    }

    const scenarios: Record<string, ScenarioMetrics> = {};
    let totalSuccess = 0;
    let totalError = 0;

    for (const [label, recs] of Object.entries(grouped)) {
      const success = recs.filter((r) => r.status === 'success').length;
      const error = recs.filter((r) => r.status === 'error').length;
      totalSuccess += success;
      totalError += error;

      const durations = recs.map((r) => r.durationMs).sort((a, b) => a - b);
      scenarios[label] = {
        total: recs.length,
        success,
        error,
        successRate: recs.length > 0 ? success / recs.length : 0,
        timing: computeTimingStats(durations),
      };
    }

    const mem = process.memoryUsage();
    return {
      scenarios,
      overall: {
        totalOps: this.records.length,
        totalSuccess,
        totalError,
        totalDurationMs: Date.now() - this.startTime,
        memoryUsageMB: Math.round(mem.heapUsed / 1024 / 1024),
      },
    };
  }

  reset(): void {
    this.records = [];
    this.startTime = Date.now();
  }

  /**
   * 获取匹配执行频率统计（按时间窗口聚合）
   */
  getMatchingFrequencyStats(windowMs: number = 5 * 60 * 1000): Array<{
    windowStart: string;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
    p95DurationMs: number;
  }> {
    if (this.records.length === 0) return [];

    const matchingRecords = this.records.filter((r) => r.label.includes('匹配引擎'));
    if (matchingRecords.length === 0) return [];

    const windows = new Map<number, MetricsRecord[]>();
    for (const r of matchingRecords) {
      const windowStart = Math.floor(r.timestamp / windowMs) * windowMs;
      if (!windows.has(windowStart)) windows.set(windowStart, []);
      windows.get(windowStart)!.push(r);
    }

    const result: Array<{
      windowStart: string;
      successCount: number;
      errorCount: number;
      avgDurationMs: number;
      p95DurationMs: number;
    }> = [];

    for (const [windowStart, recs] of Array.from(windows)) {
      const successCount = recs.filter((r) => r.status === 'success').length;
      const errorCount = recs.filter((r) => r.status === 'error').length;
      const durations = recs.map((r) => r.durationMs).sort((a, b) => a - b);
      const avgDurationMs = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      const p95Idx = Math.ceil(0.95 * durations.length) - 1;
      const p95DurationMs = durations.length > 0 ? durations[Math.max(0, p95Idx)] : 0;

      result.push({
        windowStart: new Date(windowStart).toISOString(),
        successCount,
        errorCount,
        avgDurationMs,
        p95DurationMs,
      });
    }

    return result.sort((a, b) => a.windowStart.localeCompare(b.windowStart));
  }
}

function computeTimingStats(durations: number[]): TimingStats {
  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }
  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    min: durations[0],
    max: durations[durations.length - 1],
    avg: Math.round(sum / durations.length),
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}
