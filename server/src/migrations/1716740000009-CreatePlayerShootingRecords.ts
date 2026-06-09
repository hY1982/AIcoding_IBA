import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建球员投篮记录表
 *
 * 支撑投篮记录录入和半年滚动统计查询。
 * 索引策略：
 * - (playerId, recordDate) — 支撑日期范围筛选（getShootingStats 核心查询）
 * - (playerId, recordType, recordDate) — 蓝图规范，支撑按类型细分查询
 */
export class CreatePlayerShootingRecords1716740000009 implements MigrationInterface {
  name = 'CreatePlayerShootingRecords1716740000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM type (idempotent)
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."player_shooting_records_record_type_enum" AS ENUM('free_throw', 'three_point'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 2. Create table
    await queryRunner.query(
      `CREATE TABLE "player_shooting_records" (
        "id" BIGSERIAL NOT NULL,
        "player_id" bigint NOT NULL,
        "record_type" "public"."player_shooting_records_record_type_enum" NOT NULL,
        "shots_attempted" integer NOT NULL,
        "shots_made" integer NOT NULL,
        "record_date" date NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_player_shooting_records" PRIMARY KEY ("id")
      )`,
    );

    // 3. Add indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_shooting_player_date" ON "player_shooting_records" ("player_id", "record_date" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shooting_player_type_date" ON "player_shooting_records" ("player_id", "record_type", "record_date")`,
    );

    // 4. Add foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "player_shooting_records" ADD CONSTRAINT "FK_shooting_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency

    // 1. Drop foreign key
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "player_shooting_records" DROP CONSTRAINT IF EXISTS "FK_shooting_player"`,
    );

    // 2. Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_shooting_player_type_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_shooting_player_date"`,
    );

    // 3. Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "player_shooting_records"`);

    // 4. Drop ENUM type
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."player_shooting_records_record_type_enum"`,
    );
  }
}
