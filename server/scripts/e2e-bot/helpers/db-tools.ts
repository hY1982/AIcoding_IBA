/**
 * E2E Bot 测试 — DB 工具（初始化/清理/种子数据/手动操作）
 *
 * 仅用于:
 * - 数据清理 (TRUNCATE + Redis flushdb)
 * - 种子数据 (SystemParam + Format)
 * - 手动触发匹配
 * - 比赛状态推进
 * - SQL 完整性校验
 *
 * 不做业务操作（注册/登录/意向等），这些全部走 HTTP API。
 */

import { DataSource } from 'typeorm';
import { DB_TABLES_TO_TRUNCATE } from '../config';

export class DbTools {
  constructor(private dataSource: DataSource) {}

  /**
   * 检查数据库连接
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清空所有业务表
   */
  async truncateAll(): Promise<void> {
    for (const table of DB_TABLES_TO_TRUNCATE) {
      try {
        await this.dataSource.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      } catch {
        // 表可能不存在，忽略
      }
    }
  }

  /**
   * 写入 SystemParam 种子数据
   */
  async seedSystemParams(): Promise<void> {
    const params = [
      {
        key: 'match_threshold_params',
        value: JSON.stringify({
          base_threshold: 50,
          min_threshold: 5,
          intention_count_factor: 0.5,
        }),
        description: '匹配引擎阈值参数',
      },
      {
        key: 'ability_adjust_weights',
        value: JSON.stringify({
          level_match: { equal: 0, higher: -1, lower: 1, unclear: 0 },
          sportsmanship: { good: -1, average: 0, poor: 2 },
          action_cleanliness: { clean: -1, average: 0, dirty: 2 },
          punctuality: { punctual: -1, late: 2 },
        }),
        description: '能力调节值权重配置',
      },
      {
        key: 'group_chat_expiry_days',
        value: JSON.stringify({ expiry_days: 7 }),
        description: '群聊有效期天数',
      },
      {
        key: 'base_ability_weights',
        value: JSON.stringify({
          height: 0.2,
          weight: 0.1,
          wingspan: 0.15,
          standingReach: 0.15,
          jumpingReach: 0.15,
          age: 0.1,
          basketballAge: 0.15,
        }),
        description: '基础能力值计算权重',
      },
    ];

    for (const p of params) {
      await this.dataSource.query(
        `INSERT INTO system_params (param_key, param_value, description)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (param_key) DO UPDATE SET param_value = $2::jsonb, description = $3, updated_at = NOW()`,
        [p.key, p.value, p.description],
      );
    }
  }

  /**
   * 写入 Format 种子数据
   */
  async seedFormats(): Promise<void> {
    const formats = [
      {
        name: '3v3 标准',
        format_type: 'short',
        team_size: 3,
        team_count_min: 2,
        team_count_max: 4,
        win_condition: 'score',
        duration_hours: 2,
        is_active: true,
      },
      {
        name: '4v4 标准',
        format_type: 'short',
        team_size: 4,
        team_count_min: 2,
        team_count_max: 4,
        win_condition: 'score',
        duration_hours: 2,
        is_active: true,
      },
      {
        name: '5v5 全场',
        format_type: 'long',
        team_size: 5,
        team_count_min: 2,
        team_count_max: 2,
        win_condition: 'score',
        duration_hours: 3,
        is_active: true,
      },
    ];

    for (const f of formats) {
      await this.dataSource.query(
        `INSERT INTO formats (name, format_type, team_size, team_count_min, team_count_max, win_condition, duration_hours, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [f.name, f.format_type, f.team_size, f.team_count_min, f.team_count_max, f.win_condition, f.duration_hours, f.is_active],
      );
    }
  }

  /**
   * 手动触发匹配引擎（直接调用 Service）
   */
  async triggerMatching(appContext: any, regionCode: string): Promise<any> {
    // 通过 NestJS ApplicationContext 获取 MatchingEngineService
    const { MatchingEngineService } = require('../../../src/modules/matching/services/matching-engine.service');
    const matchingEngine = appContext.get(MatchingEngineService);
    return matchingEngine.runMatching(regionCode);
  }

  /**
   * 手动推进比赛状态到 completed（供反馈测试）
   */
  async setMatchCompleted(matchId: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE matches SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [matchId],
    );
  }

  /**
   * 获取所有已创建的 Format
   */
  async getFormats(): Promise<Array<{ id: number; name: string; team_size: number }>> {
    const result = await this.dataSource.query(
      `SELECT id, name, team_size FROM formats WHERE is_active = true ORDER BY id`,
    );
    return result;
  }

  /**
   * 查询比赛的参赛球员
   */
  async getMatchPlayers(matchId: number): Promise<Array<{ player_id: number; status: string; team_number: number }>> {
    const result = await this.dataSource.query(
      `SELECT mp.player_id, mp.status, mp.team_number
       FROM match_players mp
       WHERE mp.match_id = $1
       ORDER BY mp.team_number, mp.player_id`,
      [matchId],
    );
    return result;
  }

  /**
   * 查询所有 pending_confirmation 比赛
   */
  async getPendingConfirmationMatches(): Promise<Array<{ id: number; total_players: number }>> {
    const result = await this.dataSource.query(
      `SELECT id, total_players FROM matches WHERE status = 'pending_confirmation'`,
    );
    return result;
  }

  /**
   * 获取球员的 playerId（通过 userId）
   */
  async getPlayerIdByUserId(userId: number): Promise<number | null> {
    const result = await this.dataSource.query(
      `SELECT id FROM players WHERE user_id = $1`,
      [userId],
    );
    return result.length > 0 ? Number(result[0].id) : null;
  }

  /**
   * 获取场地经理的 venueManagerId（通过 userId）
   */
  async getVenueManagerIdByUserId(userId: number): Promise<number | null> {
    const result = await this.dataSource.query(
      `SELECT id FROM venue_managers WHERE user_id = $1`,
      [userId],
    );
    return result.length > 0 ? Number(result[0].id) : null;
  }

  /**
   * 查询所有比赛的参赛球员完整信息（压力测试结果展示）
   */
  async getMatchDetailsForReport(): Promise<Array<{
    match_id: number; match_status: string; start_time: Date;
    team_number: number; player_id: number; nickname: string;
    age: number; basketball_age: number; height: number;
    base_ability_score: number; position: string | null;
  }>> {
    return this.dataSource.query(`
      SELECT m.id AS match_id, m.status AS match_status, m.start_time,
             mp.team_number, p.id AS player_id, u.nickname,
             p.age, p.basketball_age, p.height, p.base_ability_score,
             pp.position
      FROM matches m
      JOIN match_players mp ON mp.match_id = m.id
      JOIN players p ON p.id = mp.player_id
      JOIN users u ON u.id = p.user_id
      LEFT JOIN player_positions pp ON pp.player_id = p.id
      ORDER BY m.id, mp.team_number, p.id
    `);
  }

  /**
   * 查询所有已匹配意向的详情（含场地/赛制名称）
   */
  async getMatchedIntentions(): Promise<Array<{
    intention_id: number; player_id: number; nickname: string;
    start_time: Date; duration_minutes: number; acceptable_wait_minutes: number;
    status: string; match_id: number; venue_name: string; format_name: string;
  }>> {
    return this.dataSource.query(`
      SELECT i.id AS intention_id, i.player_id, u.nickname,
             i.start_time, i.duration_minutes, i.acceptable_wait_minutes,
             i.status, i.match_id,
             v.name AS venue_name, f.name AS format_name
      FROM intentions i
      LEFT JOIN players p ON p.id = i.player_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN intention_venues iv ON iv.intention_id = i.id AND iv.priority = 1
      LEFT JOIN venues v ON v.id = iv.venue_id
      LEFT JOIN intention_formats ifmt ON ifmt.intention_id = i.id AND ifmt.priority = 1
      LEFT JOIN formats f ON f.id = ifmt.format_id
      WHERE i.match_id IS NOT NULL
      ORDER BY i.match_id, i.id
    `);
  }

  /**
   * 查询场地时段预订状态
   */
  async getVenueSlotStatus(): Promise<Array<{
    venue_name: string; slot_date: string; start_time: string;
    end_time: string; is_booked: boolean; match_id: number | null;
    match_status: string | null; total_players: number | null;
  }>> {
    return this.dataSource.query(`
      SELECT v.name AS venue_name, vts.slot_date, vts.start_time,
             vts.end_time, vts.is_booked, vts.match_id,
             m.status AS match_status, m.total_players
      FROM venue_time_slots vts
      JOIN venues v ON v.id = vts.venue_id
      LEFT JOIN matches m ON m.id = vts.match_id
      ORDER BY vts.venue_id, vts.slot_date, vts.start_time
    `);
  }
}
