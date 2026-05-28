import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntentionTables1716740000005 implements MigrationInterface {
  name = 'CreateIntentionTables1716740000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM type (idempotent)
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."intentions_status_enum" AS ENUM('pending','matched','confirmed','cancelled','expired','failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 2. Create intentions table
    await queryRunner.query(
      `CREATE TABLE "intentions" (
        "id" BIGSERIAL NOT NULL,
        "player_id" bigint NOT NULL,
        "start_time" TIMESTAMPTZ NOT NULL,
        "duration_minutes" integer NOT NULL,
        "acceptable_wait_minutes" integer NOT NULL DEFAULT '30',
        "end_time" TIMESTAMPTZ NOT NULL,
        "status" "public"."intentions_status_enum" NOT NULL DEFAULT 'pending',
        "match_id" bigint,
        "region_code" character varying(20),
        "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_intentions" PRIMARY KEY ("id")
      )`,
    );

    // 3. Add CHECK constraint on duration_minutes (120-360)
    await queryRunner.query(
      `ALTER TABLE "intentions" ADD CONSTRAINT "CHK_intentions_duration" CHECK ("duration_minutes" >= 120 AND "duration_minutes" <= 360)`,
    );

    // 4. Create indexes on intentions
    await queryRunner.query(
      `CREATE INDEX "IDX_intentions_status" ON "intentions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_intentions_time" ON "intentions" ("start_time", "end_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_intentions_player" ON "intentions" ("player_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_intentions_region_status_time" ON "intentions" ("region_code", "status", "start_time")`,
    );

    // 5. Create intention_venues table
    await queryRunner.query(
      `CREATE TABLE "intention_venues" (
        "id" BIGSERIAL NOT NULL,
        "intention_id" bigint NOT NULL,
        "venue_id" bigint NOT NULL,
        "priority" integer NOT NULL DEFAULT '1',
        CONSTRAINT "PK_intention_venues" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_intention_venues_intention_venue" UNIQUE ("intention_id", "venue_id")
      )`,
    );

    // 6. Create intention_formats table
    await queryRunner.query(
      `CREATE TABLE "intention_formats" (
        "id" BIGSERIAL NOT NULL,
        "intention_id" bigint NOT NULL,
        "format_id" bigint NOT NULL,
        "priority" integer NOT NULL DEFAULT '1',
        CONSTRAINT "PK_intention_formats" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_intention_formats_intention_format" UNIQUE ("intention_id", "format_id")
      )`,
    );

    // 7. Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "intentions" ADD CONSTRAINT "FK_intentions_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "intention_venues" ADD CONSTRAINT "FK_intention_venues_intention" FOREIGN KEY ("intention_id") REFERENCES "intentions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "intention_venues" ADD CONSTRAINT "FK_intention_venues_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "intention_formats" ADD CONSTRAINT "FK_intention_formats_intention" FOREIGN KEY ("intention_id") REFERENCES "intentions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "intention_formats" ADD CONSTRAINT "FK_intention_formats_format" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intention_formats" DROP CONSTRAINT IF EXISTS "FK_intention_formats_format"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intention_formats" DROP CONSTRAINT IF EXISTS "FK_intention_formats_intention"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intention_venues" DROP CONSTRAINT IF EXISTS "FK_intention_venues_venue"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intention_venues" DROP CONSTRAINT IF EXISTS "FK_intention_venues_intention"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intentions" DROP CONSTRAINT IF EXISTS "FK_intentions_player"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intentions" DROP CONSTRAINT IF EXISTS "CHK_intentions_duration"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "intention_formats"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intention_venues"`);
    // Drop indexes BEFORE dropping the parent table (intentions)
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_intentions_region_status_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_intentions_player"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_intentions_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_intentions_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "intentions"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."intentions_status_enum"`,
    );
  }
}
