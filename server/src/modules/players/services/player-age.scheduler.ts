import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlayerService } from './player.service';

/**
 * 球员年龄/球龄定时重算任务
 *
 * 每月1号 00:00 自动触发，分批重算所有球员的年龄和球龄。
 * 错误处理：捕获异常并记录日志，不抛出（避免定时任务中断后续调度）。
 */
@Injectable()
export class PlayerAgeScheduler {
  private readonly logger = new Logger(PlayerAgeScheduler.name);

  constructor(private readonly playerService: PlayerService) {}

  /**
   * 每月1号 00:00 执行
   * Cron 表达式：秒 分 时 日 月 周
   */
  @Cron('0 0 1 * *')
  async handleMonthlyRecalculation(): Promise<void> {
    this.logger.log('开始执行每月年龄/球龄重算任务');
    try {
      const result = await this.playerService.recalculateAllAges();
      this.logger.log(
        `年龄/球龄重算完成: total=${result.total}, updated=${result.updated}, recalculated=${result.recalculated}`,
      );
    } catch (error) {
      this.logger.error(
        `年龄/球龄重算失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      // 不抛出异常，避免中断后续定时调度
    }
  }
}
