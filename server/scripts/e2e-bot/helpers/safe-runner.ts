/**
 * E2E Bot 测试 — 安全执行包装器
 *
 * 三级错误分类:
 *   FATAL    — 基础设施故障，终止全部测试
 *   SCENARIO — 场景失败，记录并跳过当前场景
 *   BOT      — 单个 bot 失败，记录并继续其他 bot
 */

import { MetricsCollector } from '../metrics-collector';
import { BotContext } from './bot-context';

export enum ErrorSeverity {
  FATAL = 'FATAL',
  SCENARIO = 'SCENARIO',
  BOT = 'BOT',
}

export class FatalError extends Error {
  severity = ErrorSeverity.FATAL;
}

export interface SafeResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  durationMs: number;
}

/**
 * 安全执行单个操作，捕获异常并记录指标
 */
export async function safeRun<T>(
  label: string,
  fn: () => Promise<T>,
  metrics: MetricsCollector,
): Promise<SafeResult<T>> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    metrics.record(label, 'success', durationMs);
    return { success: true, result, durationMs };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    const error = err instanceof Error ? err : new Error(String(err));
    metrics.record(label, 'error', durationMs, error.message);
    if (error instanceof FatalError) throw error;
    return { success: false, error, durationMs };
  }
}

/**
 * 安全执行 bot 操作，失败时记录到 bot.errors 但不中断
 */
export async function safeBotRun<T>(
  bot: BotContext,
  phase: string,
  label: string,
  fn: () => Promise<T>,
  metrics: MetricsCollector,
): Promise<SafeResult<T>> {
  const fullLabel = `${phase}:${label}`;
  const result = await safeRun(fullLabel, fn, metrics);
  bot.timings[fullLabel] = result.durationMs;
  if (!result.success && result.error) {
    bot.errors.push({
      phase,
      message: result.error.message,
      timestamp: Date.now(),
    });
  }
  return result;
}

/**
 * 批量并发执行器
 * @param items      要处理的项目列表
 * @param batchSize  每批并发数量
 * @param fn         处理函数
 * @param delayMs    批次间延迟（ms）
 */
export async function runBatch<T>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<void>,
  delayMs = 100,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item, j) => fn(item, i + j)));
    if (i + batchSize < items.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

/**
 * 带超时的 Promise 包装
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'operation',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[TIMEOUT] ${label} 超时 (${timeoutMs}ms)`)),
      timeoutMs,
    );
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
