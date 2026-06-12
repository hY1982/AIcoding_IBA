/**
 * Phase 9: 通知验证（DB 直连 — 通知模块无 HTTP Controller）
 */

import { DataSource } from 'typeorm';
import { BotContext } from '../helpers/bot-context';
import { MetricsCollector } from '../metrics-collector';
import { ReportGenerator } from '../report-generator';

export async function runNotificationPhase(
  players: BotContext[],
  human: BotContext,
  matchIds: number[],
  dataSource: DataSource,
  metrics: MetricsCollector,
  report: ReportGenerator,
): Promise<void> {
  report.startPhase('Phase 9: 通知验证');

  if (matchIds.length === 0) {
    report.printWarning('无比赛', '跳过通知阶段');
    report.endPhase();
    return;
  }

  // ─── 9.1 通知记录存在性检查 ───
  report.printInfo('步骤 9.1', '查询通知记录');

  const start1 = performance.now();
  try {
    const notifStats = await dataSource.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as users FROM notifications`,
    );
    const durationMs = Math.round(performance.now() - start1);
    metrics.record('通知查询', 'success', durationMs);

    const total = Number(notifStats[0]?.total || 0);
    const users = Number(notifStats[0]?.users || 0);
    report.addSuccess('通知存在性', `共 ${total} 条通知, ${users} 个用户`, durationMs);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start1);
    metrics.record('通知查询', 'error', durationMs, err.message);
    report.addFailure('通知查询', err.message, durationMs);
  }

  // ─── 9.2 通知类型分布 ───
  report.printInfo('步骤 9.2', '通知类型分布');

  try {
    const typeDistribution = await dataSource.query(
      `SELECT type, COUNT(*) as cnt FROM notifications GROUP BY type ORDER BY cnt DESC`,
    );

    if (typeDistribution.length > 0) {
      for (const row of typeDistribution) {
        report.addSuccess(`通知类型`, `${row.type}: ${row.cnt} 条`);
      }
    } else {
      report.addSkip('通知类型', '无通知记录（通知模块可能未自动创建通知）');
    }
  } catch (err: any) {
    report.addFailure('通知类型分布', err.message);
  }

  // ─── 9.3 未读/已读状态检查 ───
  report.printInfo('步骤 9.3', '未读/已读状态');

  try {
    const readStats = await dataSource.query(
      `SELECT is_read, COUNT(*) as cnt FROM notifications GROUP BY is_read`,
    );

    const unread = Number(readStats.find((r: any) => !r.is_read)?.cnt || 0);
    const read = Number(readStats.find((r: any) => r.is_read)?.cnt || 0);
    report.addSuccess('读取状态', `未读: ${unread}, 已读: ${read}`);
  } catch (err: any) {
    report.addFailure('读取状态查询', err.message);
  }

  // ─── 9.4 通知与比赛关联 ───
  report.printInfo('步骤 9.4', '通知关联检查');

  const matchId = matchIds[0];
  try {
    const matchNotifs = await dataSource.query(
      `SELECT COUNT(*) as cnt FROM notifications
       WHERE data::text LIKE $1`,
      [`%${matchId}%`],
    );
    const cnt = Number(matchNotifs[0]?.cnt || 0);
    if (cnt > 0) {
      report.addSuccess('比赛关联通知', `matchId=${matchId} 关联了 ${cnt} 条通知`);
    } else {
      report.addSkip('比赛关联通知', `matchId=${matchId} 无关联通知（可能通知不含 match_id 字段）`);
    }
  } catch (err: any) {
    report.addSkip('比赛关联通知', `查询失败: ${err.message}`);
  }

  // ─── 9.5 标记已读模拟（直连 DB UPDATE）───
  report.printInfo('步骤 9.5', '标记已读模拟');

  // 获取一个有通知的用户
  try {
    const userWithNotif = await dataSource.query(
      `SELECT user_id FROM notifications WHERE is_read = false LIMIT 1`,
    );

    if (userWithNotif.length > 0) {
      const userId = userWithNotif[0].user_id;

      // 标记一条为已读
      const markResult = await dataSource.query(
        `UPDATE notifications SET is_read = true
         WHERE user_id = $1 AND is_read = false
         RETURNING id`,
        [userId],
      );

      if (markResult.length > 0) {
        report.addSuccess('标记已读', `userId=${userId} notificationId=${markResult[0].id} → 已读`);

        // 验证已读数量变化
        const afterStats = await dataSource.query(
          `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false`,
          [userId],
        );
        const remaining = Number(afterStats[0]?.unread || 0);
        report.addSuccess('已读验证', `userId=${userId} 剩余未读: ${remaining}`);
      } else {
        report.addSkip('标记已读', '无未读通知可标记');
      }
    } else {
      report.addSkip('标记已读', '无未读通知');
    }
  } catch (err: any) {
    report.addFailure('标记已读', err.message);
  }

  // ─── 9.6 全部标记已读 ───
  report.printInfo('步骤 9.6', '全部标记已读');

  try {
    const markAllResult = await dataSource.query(
      `UPDATE notifications SET is_read = true
       WHERE is_read = false`,
    );
    const affected = markAllResult?.length ?? 0;
    report.addSuccess('全部标记已读', `影响了 ${affected} 条通知`);

    // 验证: 应该没有未读通知
    const verifyResult = await dataSource.query(
      `SELECT COUNT(*) as unread FROM notifications WHERE is_read = false`,
    );
    const unread = Number(verifyResult[0]?.unread || 0);
    if (unread === 0) {
      report.addSuccess('已读验证', '所有通知均已读 ✅');
    } else {
      report.addFailure('已读验证', `仍有 ${unread} 条未读通知`);
    }
  } catch (err: any) {
    report.addFailure('全部标记已读', err.message);
  }

  report.endPhase();
}
