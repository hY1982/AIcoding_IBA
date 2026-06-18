import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v2.0 核心重构迁移：intentions + matches + match_players 表结构变更 + 数据兼容。
 *
 * 变更摘要：
 * - intentions: 删除 match_id 列/FK，status enum 精简为 4 状态，新增 expires_at 索引
 * - matches: status enum 改为 7 状态，删除 total_players，新增 required_players/confirm_deadline/venue_confirm_deadline
 * - match_players: status enum 改为 4 状态，删除 is_reserve，新增 intention_id/deposit_order_no，唯一约束变更
 * - 数据兼容：旧状态值映射到新状态值
 */
export class V2CoreFlowRefactor1781200000001 implements MigrationInterface {
  name = 'V2CoreFlowRefactor1781200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Part 1: Intentions
    // ========================================

    // 1a. 数据兼容：旧状态映射
    await queryRunner.query(
      `UPDATE "intentions" SET "status" = 'confirmed' WHERE "status" = 'matched'`,
    );
    await queryRunner.query(
      `UPDATE "intentions" SET "status" = 'expired' WHERE "status" = 'failed'`,
    );

    // 1b. 删除 match_id FK 和列
    await queryRunner.query(
      `ALTER TABLE "intentions" DROP CONSTRAINT IF EXISTS "FK_intentions_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "intentions" DROP COLUMN IF EXISTS "match_id"`,
    );

    // 1c. 修改 status enum（4 状态）
    await queryRunner.query(
      `ALTER TABLE "intentions" ALTER COLUMN "status" TYPE text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."intentions_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."intentions_status_enum" AS ENUM('pending','confirmed','cancelled','expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "intentions" ALTER COLUMN "status" TYPE "public"."intentions_status_enum" USING "status"::"public"."intentions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "intentions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );

    // 1d. 新增 expires_at 索引
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_intentions_expires_at" ON "intentions" ("expires_at")`,
    );

    // ========================================
    // Part 2: Matches
    // ========================================

    // 2a. 数据兼容：旧状态映射
    await queryRunner.query(
      `UPDATE "matches" SET "status" = 'pending_players' WHERE "status" = 'pending_confirmation'`,
    );
    await queryRunner.query(
      `UPDATE "matches" SET "status" = 'cancelled' WHERE "status" = 'failed'`,
    );

    // 2b. 删除旧的 CHECK constraints（引用 total_players）
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "CHK_matches_total_players"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "CHK_matches_confirmed_players"`,
    );

    // 2c. 删除旧索引
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_status"`,
    );

    // 2d. 修改 status enum（7 状态）
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "status" TYPE text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."matches_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."matches_status_enum" AS ENUM('pending_players','pending_venue','confirmed','in_progress','completed','cancelled','expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "status" TYPE "public"."matches_status_enum" USING "status"::"public"."matches_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'pending_players'`,
    );

    // 2e. 删除 total_players，新增 required_players + deadlines
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "total_players"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN "required_players" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN "confirm_deadline" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN "venue_confirm_deadline" TIMESTAMPTZ`,
    );

    // 2f. 回填 required_players = team_count * players_per_team
    await queryRunner.query(
      `UPDATE "matches" SET "required_players" = "team_count" * "players_per_team"`,
    );

    // 2g. 新增 CHECK constraints
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "CHK_matches_required_players" CHECK ("required_players" = "team_count" * "players_per_team")`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "CHK_matches_confirmed_players_v2" CHECK ("confirmed_players" <= "required_players")`,
    );

    // 2h. 新增索引
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_status_v2" ON "matches" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_status_confirm_deadline" ON "matches" ("status", "confirm_deadline")`,
    );

    // ========================================
    // Part 3: Match Players
    // ========================================

    // 3a. 数据兼容：旧状态映射（declined → withdrawn）
    await queryRunner.query(
      `UPDATE "match_players" SET "status" = 'withdrawn' WHERE "status" = 'declined'`,
    );

    // 3b. 删除旧唯一约束
    await queryRunner.query(
      `ALTER TABLE "match_players" DROP CONSTRAINT IF EXISTS "UQ_match_players_match_player"`,
    );

    // 3c. 修改 status enum（4 状态）
    await queryRunner.query(
      `ALTER TABLE "match_players" ALTER COLUMN "status" TYPE text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."match_players_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."match_players_status_enum" AS ENUM('invited','confirmed','withdrawn','no_show')`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ALTER COLUMN "status" TYPE "public"."match_players_status_enum" USING "status"::"public"."match_players_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ALTER COLUMN "status" SET DEFAULT 'invited'`,
    );

    // 3d. 删除 is_reserve，新增 intention_id + deposit_order_no
    await queryRunner.query(
      `ALTER TABLE "match_players" DROP COLUMN IF EXISTS "is_reserve"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD COLUMN "intention_id" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD COLUMN "deposit_order_no" character varying(100)`,
    );

    // 3e. 新增 intention_id 索引
    await queryRunner.query(
      `CREATE INDEX "IDX_mp_intention" ON "match_players" ("intention_id")`,
    );

    // 3f. 新增 partial unique index (match_id, intention_id)
    // 仅对 intention_id IS NOT NULL 的行生效，旧数据（NULL）不受约束
    // 原因：PostgreSQL UNIQUE 约束对 NULL 视为不相等，多个 (match_id, NULL) 不冲突，
    // 导致依赖此约束的 ON CONFLICT 行为不可靠。改用 partial index 确保语义一致。
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_match_players_match_intention_notnull" ON "match_players" ("match_id", "intention_id") WHERE "intention_id" IS NOT NULL`,
    );

    // 3g. 新增 intention_id FK
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_intention" FOREIGN KEY ("intention_id") REFERENCES "intentions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Reverse: Match Players
    // ========================================

    await queryRunner.query(
      `ALTER TABLE "match_players" DROP CONSTRAINT IF EXISTS "FK_match_players_intention"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_match_players_match_intention_notnull"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_mp_intention"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" DROP COLUMN IF EXISTS "deposit_order_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" DROP COLUMN IF EXISTS "intention_id"`,
    );

    // 恢复 status enum
    await queryRunner.query(
      `ALTER TABLE "match_players" ALTER COLUMN "status" TYPE text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."match_players_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."match_players_status_enum" AS ENUM('invited','confirmed','declined','no_show')`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ALTER COLUMN "status" TYPE "public"."match_players_status_enum" USING "status"::"public"."match_players_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ALTER COLUMN "status" SET DEFAULT 'invited'`,
    );

    await queryRunner.query(
      `ALTER TABLE "match_players" ADD COLUMN "is_reserve" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD CONSTRAINT "UQ_match_players_match_player" UNIQUE ("match_id", "player_id")`,
    );

    // ========================================
    // Reverse: Matches
    // ========================================

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_status_confirm_deadline"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_status_v2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "CHK_matches_confirmed_players_v2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "CHK_matches_required_players"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "venue_confirm_deadline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "confirm_deadline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "required_players"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN "total_players" integer NOT NULL DEFAULT 0`,
    );

    // 恢复 status enum
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "status" TYPE text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."matches_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."matches_status_enum" AS ENUM('pending_confirmation','confirmed','in_progress','completed','cancelled','failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "status" TYPE "public"."matches_status_enum" USING "status"::"public"."matches_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'pending_confirmation'`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_matches_status" ON "matches" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "CHK_matches_total_players" CHECK ("total_players" = "team_count" * "players_per_team")`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "CHK_matches_confirmed_players" CHECK ("confirmed_players" <= "total_players")`,
    );

    // ========================================
    // Reverse: Intentions
    // ========================================

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_intentions_expires_at"`,
    );

    // 恢复 status enum
    await queryRunner.query(
      `ALTER TABLE "intentions" ALTER COLUMN "status" TYPE text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."intentions_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."intentions_status_enum" AS ENUM('pending','matched','confirmed','cancelled','expired','failed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "intentions" ALTER COLUMN "status" TYPE "public"."intentions_status_enum" USING "status"::"public"."intentions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "intentions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );

    await queryRunner.query(
      `ALTER TABLE "intentions" ADD COLUMN "match_id" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "intentions" ADD CONSTRAINT "FK_intentions_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
