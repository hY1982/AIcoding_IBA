import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v2.2 满员人数配置调整 + 最低人数兜底机制。
 *
 * 变更摘要：
 * - formats: 更新 team_count_min 从 3 改为 2（最低2队）
 * - matches: 新增 min_players 列（最低人数要求）
 * - 3v3: 满员12人(4队)，最低6人(2队)
 * - 4v4: 满员16人(4队)，最低8人(2队)
 * - 5v5: 满员20人(4队)，最低10人(2队)
 */
export class V22MinPlayersConfig1781400000001 implements MigrationInterface {
  name = 'V22MinPlayersConfig1781400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Part 1: Matches — 新增 min_players 列
    // ========================================

    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "min_players" INTEGER NOT NULL DEFAULT 0`,
    );

    // ========================================
    // Part 2: Formats — 更新 team_count_min 为 2
    // ========================================

    await queryRunner.query(
      `UPDATE "formats" SET "team_count_min" = 2 WHERE "name" IN ('3v3短赛', '4v4短赛', '5v5短赛')`,
    );

    // ========================================
    // Part 3: 更新现有 matches 的 min_players
    // ========================================

    // 3v3: min_players = 6 (2队 * 3人)
    await queryRunner.query(
      `UPDATE "matches" SET "min_players" = 6 WHERE "format_id" = (SELECT id FROM "formats" WHERE "name" = '3v3短赛')`,
    );

    // 4v4: min_players = 8 (2队 * 4人)
    await queryRunner.query(
      `UPDATE "matches" SET "min_players" = 8 WHERE "format_id" = (SELECT id FROM "formats" WHERE "name" = '4v4短赛')`,
    );

    // 5v5: min_players = 10 (2队 * 5人)
    await queryRunner.query(
      `UPDATE "matches" SET "min_players" = 10 WHERE "format_id" = (SELECT id FROM "formats" WHERE "name" = '5v5短赛')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: remove min_players column and restore team_count_min
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "min_players"`,
    );

    await queryRunner.query(
      `UPDATE "formats" SET "team_count_min" = 3 WHERE "name" IN ('3v3短赛', '4v4短赛', '5v5短赛')`,
    );
  }
}
