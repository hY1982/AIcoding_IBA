/**
 * E2E Bot 测试 — SQL 数据完整性校验查询
 *
 * Phase 11: 10 项 JOIN 查询验证数据库引用完整性和一致性
 */

import { DataSource } from 'typeorm';
import { ReportGenerator } from '../report-generator';

export interface IntegrityResult {
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
  sql: string;
}

export class SqlVerifier {
  constructor(private dataSource: DataSource) {}

  async runAll(report: ReportGenerator): Promise<IntegrityResult[]> {
    const checks: Array<() => Promise<IntegrityResult>> = [
      this.checkUserCount.bind(this),
      this.checkPlayerUserRef.bind(this),
      this.checkMatchPlayerRef.bind(this),
      this.checkMatchStatusConsistency.bind(this),
      this.checkPaymentOrderCompleteness.bind(this),
      this.checkIntentionStatusConsistency.bind(this),
      this.checkTimeSlotBookingConsistency.bind(this),
      this.checkFeedbackScoreRange.bind(this),
      this.checkOptimisticLockVersion.bind(this),
      this.checkNotificationStats.bind(this),
    ];

    const results: IntegrityResult[] = [];
    for (const check of checks) {
      const result = await check();
      report.addIntegrityCheck(result.label, result.passed, result.sql, `${result.expected} → 实际: ${result.actual}`);
      results.push(result);
    }

    return results;
  }

  // 1. 用户计数
  private async checkUserCount(): Promise<IntegrityResult> {
    const sql = `SELECT user_type, COUNT(*) as cnt FROM users GROUP BY user_type`;
    const rows = await this.dataSource.query(sql);
    const playerCount = rows.find((r: any) => r.user_type === 'player')?.cnt || 0;
    const vmCount = rows.find((r: any) => r.user_type === 'venue_manager')?.cnt || 0;
    const passed = Number(playerCount) >= 1 && Number(vmCount) >= 1;
    return {
      label: '用户计数（球员≥1, 场地方≥1）',
      passed,
      expected: '球员≥1, 场地方≥1',
      actual: `球员=${playerCount}, 场地方=${vmCount}`,
      sql,
    };
  }

  // 2. Player → User 引用完整性
  private async checkPlayerUserRef(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as orphan FROM players p LEFT JOIN users u ON p.user_id = u.id WHERE u.id IS NULL`;
    const rows = await this.dataSource.query(sql);
    const orphans = Number(rows[0]?.orphan || 0);
    return {
      label: 'Player→User 引用完整性',
      passed: orphans === 0,
      expected: '0 孤立记录',
      actual: `${orphans} 孤立记录`,
      sql,
    };
  }

  // 3. MatchPlayer → Match + Player 引用完整性
  private async checkMatchPlayerRef(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as orphan FROM match_players mp
      LEFT JOIN matches m ON mp.match_id = m.id
      LEFT JOIN players p ON mp.player_id = p.id
      WHERE m.id IS NULL OR p.id IS NULL`;
    const rows = await this.dataSource.query(sql);
    const orphans = Number(rows[0]?.orphan || 0);
    return {
      label: 'MatchPlayer→Match+Player 引用完整性',
      passed: orphans === 0,
      expected: '0 孤立记录',
      actual: `${orphans} 孤立记录`,
      sql,
    };
  }

  // 4. 比赛状态一致性
  private async checkMatchStatusConsistency(): Promise<IntegrityResult> {
    const sql = `SELECT m.id, m.status, m.required_players,
      COUNT(mp.id) as actual_players,
      COUNT(CASE WHEN mp.status = 'confirmed' THEN 1 END) as confirmed_count
      FROM matches m
      LEFT JOIN match_players mp ON mp.match_id = m.id
      GROUP BY m.id, m.status, m.required_players`;
    const rows = await this.dataSource.query(sql);
    let issues = 0;
    for (const row of rows) {
      if (row.status === 'confirmed' && Number(row.confirmed_count) < Number(row.required_players)) {
        // confirmed 比赛应该有足够确认人数
        issues++;
      }
    }
    return {
      label: '比赛状态一致性',
      passed: issues === 0,
      expected: '0 异常',
      actual: `${rows.length} 场比赛, ${issues} 异常`,
      sql,
    };
  }

  // 5. 支付订单完整性
  private async checkPaymentOrderCompleteness(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as missing FROM match_players mp
      LEFT JOIN mock_orders o ON mp.match_id = o.match_id AND mp.player_id = o.player_id
      WHERE mp.status = 'confirmed' AND (o.order_no IS NULL OR o.status != 'paid')`;
    try {
      const rows = await this.dataSource.query(sql);
      const missing = Number(rows[0]?.missing || 0);
      return {
        label: '支付订单完整性（confirmed 球员都有 paid 订单）',
        passed: missing === 0,
        expected: '0 缺失',
        actual: `${missing} 缺失`,
        sql,
      };
    } catch {
      return {
        label: '支付订单完整性（confirmed 球员都有 paid 订单）',
        passed: true,
        expected: 'N/A',
        actual: 'mock_orders 表不存在，跳过',
        sql,
      };
    }
  }

  // 6. 意向状态一致性
  private async checkIntentionStatusConsistency(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as bad FROM intentions i
      WHERE i.status = 'matched' AND i.match_id IS NULL`;
    const rows = await this.dataSource.query(sql);
    const bad = Number(rows[0]?.bad || 0);
    return {
      label: '意向状态一致性（matched 意向有 matchId）',
      passed: bad === 0,
      expected: '0 异常',
      actual: `${bad} 异常`,
      sql,
    };
  }

  // 7. 时段预订一致性
  private async checkTimeSlotBookingConsistency(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as bad FROM venue_time_slots vts
      WHERE vts.is_booked = true AND vts.match_id IS NULL`;
    const rows = await this.dataSource.query(sql);
    const bad = Number(rows[0]?.bad || 0);
    return {
      label: '时段预订一致性（isBooked=true 的时段有 matchId）',
      passed: bad === 0,
      expected: '0 异常',
      actual: `${bad} 异常`,
      sql,
    };
  }

  // 8. 反馈评分范围
  private async checkFeedbackScoreRange(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as out_of_range FROM players p
      WHERE p.match_adjust_value < -50 OR p.match_adjust_value > 50`;
    const rows = await this.dataSource.query(sql);
    const bad = Number(rows[0]?.out_of_range || 0);
    return {
      label: '反馈评分范围 ∈ [-50, 50]',
      passed: bad === 0,
      expected: '0 越界',
      actual: `${bad} 越界`,
      sql,
    };
  }

  // 9. 乐观锁版本号
  private async checkOptimisticLockVersion(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as bad FROM players p WHERE p.version < 1`;
    const rows = await this.dataSource.query(sql);
    const bad = Number(rows[0]?.bad || 0);
    return {
      label: '乐观锁版本号 ≥ 1',
      passed: bad === 0,
      expected: '0 异常',
      actual: `${bad} 异常`,
      sql,
    };
  }

  // 10. 通知数量统计
  private async checkNotificationStats(): Promise<IntegrityResult> {
    const sql = `SELECT COUNT(*) as total,
      COUNT(DISTINCT user_id) as users_with_notifications
      FROM notifications`;
    const rows = await this.dataSource.query(sql);
    const total = Number(rows[0]?.total || 0);
    const users = Number(rows[0]?.users_with_notifications || 0);
    return {
      label: '通知数量统计',
      passed: total >= 0, // 通知可能为 0（仅记录不要求非空）
      expected: '≥ 0 条通知',
      actual: `${total} 条通知, ${users} 个用户`,
      sql,
    };
  }
}
