import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MatchingEngineService } from './services/matching-engine.service';
import { MatchingResult } from './interfaces/matching-result.interface';

/**
 * 匹配队列 Job 数据类型
 */
export interface MatchingJobData {
  /** 地区编码，若指定则只匹配该地区的意向 */
  regionCode?: string;
}

/**
 * BullMQ 队列处理器 — 匹配引擎
 *
 * 队列名：'matching'
 * Job 名：'match-region'
 *
 * 配置：
 * - lockDuration: 300000 (5分钟)
 * - attempts: 3
 * - backoff: exponential, 10s起
 */
@Processor('matching', {
  concurrency: 2,
  lockDuration: 300000,
})
export class MatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private readonly matchingEngine: MatchingEngineService) {
    super();
  }

  /**
   * 处理匹配任务
   *
   * @param job BullMQ Job 实例
   * @returns 匹配结果
   */
  async process(job: Job<MatchingJobData>): Promise<MatchingResult> {
    const { regionCode } = job.data;
    this.logger.log(
      `开始处理匹配任务: jobId=${job.id}, regionCode=${regionCode || 'all'}`,
    );

    const result = await this.matchingEngine.runMatching(regionCode);

    this.logger.log(
      `匹配任务完成: jobId=${job.id}, ` +
        `扫描=${result.intentionsScanned}, 成功=${result.matchesCreated}, ` +
        `失败=${result.matchesFailed}, 过期=${result.expiredCount}, ` +
        `耗时=${result.durationMs}ms`,
    );

    return result;
  }

  /**
   * Job 完成事件
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<MatchingJobData>): void {
    this.logger.log(`Job 完成: jobId=${job.id}, attempts=${job.attemptsMade}`);
  }

  /**
   * Job 失败事件
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<MatchingJobData>, error: Error): void {
    this.logger.error(
      `Job 失败: jobId=${job.id}, error=${error.message}`,
      error.stack,
    );
  }

  /**
   * Job 重试事件
   */
  @OnWorkerEvent('active')
  onActive(job: Job<MatchingJobData>): void {
    this.logger.log(
      `Job 开始执行: jobId=${job.id}, attempts=${job.attemptsMade + 1}`,
    );
  }
}
