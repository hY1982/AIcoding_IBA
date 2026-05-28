import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMatchTables1716740000006 implements MigrationInterface {
  name = 'CreateMatchTables1716740000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM types (idempotent)
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."matches_status_enum" AS ENUM('pending_confirmation','confirmed','in_progress','completed','cancelled','failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."match_players_status_enum" AS ENUM('invited','confirmed','declined','no_show'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."match_messages_message_type_enum" AS ENUM('text','image','system'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 2. Create matches table
    await queryRunner.query(
      `CREATE TABLE "matches" (
        "id" BIGSERIAL NOT NULL,
        "venue_id" bigint NOT NULL,
        "format_id" bigint NOT NULL,
        "start_time" TIMESTAMPTZ NOT NULL,
        "end_time" TIMESTAMPTZ NOT NULL,
        "status" "public"."matches_status_enum" NOT NULL DEFAULT 'pending_confirmation',
        "team_count" integer NOT NULL,
        "players_per_team" integer NOT NULL,
        "total_players" integer NOT NULL,
        "confirmed_players" integer NOT NULL DEFAULT '0',
        "deposit_amount" numeric(10,2) NOT NULL,
        "group_chat_id" character varying(100),
        "region_code" character varying(20),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_matches" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_matches_positive_team_count" CHECK ("team_count" > 0),
        CONSTRAINT "CHK_matches_positive_players_per_team" CHECK ("players_per_team" > 0),
        CONSTRAINT "CHK_matches_total_players" CHECK ("total_players" = "team_count" * "players_per_team"),
        CONSTRAINT "CHK_matches_confirmed_players" CHECK ("confirmed_players" <= "total_players"),
        CONSTRAINT "CHK_matches_time_order" CHECK ("start_time" < "end_time")
      )`,
    );

    // 3. Create match_players table
    await queryRunner.query(
      `CREATE TABLE "match_players" (
        "id" BIGSERIAL NOT NULL,
        "match_id" bigint NOT NULL,
        "player_id" bigint NOT NULL,
        "team_number" integer,
        "is_confirmed" boolean NOT NULL DEFAULT false,
        "is_reserve" boolean NOT NULL DEFAULT false,
        "confirmed_at" TIMESTAMPTZ,
        "deposit_paid" boolean NOT NULL DEFAULT false,
        "status" "public"."match_players_status_enum" NOT NULL DEFAULT 'invited',
        CONSTRAINT "PK_match_players" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_match_players_match_player" UNIQUE ("match_id", "player_id")
      )`,
    );

    // 4. Create match_teams table
    await queryRunner.query(
      `CREATE TABLE "match_teams" (
        "id" BIGSERIAL NOT NULL,
        "match_id" bigint NOT NULL,
        "team_number" integer NOT NULL,
        "team_name" character varying(50),
        "avg_ability" numeric(5,2),
        CONSTRAINT "PK_match_teams" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_match_teams_match_team" UNIQUE ("match_id", "team_number")
      )`,
    );

    // 5. Create match_messages table
    await queryRunner.query(
      `CREATE TABLE "match_messages" (
        "id" BIGSERIAL NOT NULL,
        "match_id" bigint NOT NULL,
        "sender_id" bigint NOT NULL,
        "content" text NOT NULL,
        "message_type" "public"."match_messages_message_type_enum" NOT NULL DEFAULT 'text',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_messages" PRIMARY KEY ("id")
      )`,
    );

    // 6. Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_matches_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_matches_format" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_teams" ADD CONSTRAINT "FK_match_teams_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_messages" ADD CONSTRAINT "FK_match_messages_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_messages" ADD CONSTRAINT "FK_match_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 7. Add indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_status" ON "matches" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_time" ON "matches" ("start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_venue_time" ON "matches" ("venue_id", "start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_matches_region" ON "matches" ("region_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mp_match" ON "match_players" ("match_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mp_player" ON "match_players" ("player_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_match" ON "match_messages" ("match_id", "created_at")`,
    );

    // 8. Add deferred foreign keys for previously reserved columns
    // intentions.match_id -> matches.id (ON DELETE SET NULL)
    await queryRunner.query(
      `ALTER TABLE "intentions" ADD CONSTRAINT "FK_intentions_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // venue_time_slots.match_id -> matches.id (ON DELETE SET NULL)
    await queryRunner.query(
      `ALTER TABLE "venue_time_slots" ADD CONSTRAINT "FK_venue_time_slots_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency

    // 1. Drop deferred foreign keys first
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "venue_time_slots" DROP CONSTRAINT IF EXISTS "FK_venue_time_slots_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "intentions" DROP CONSTRAINT IF EXISTS "FK_intentions_match"`,
    );

    // 2. Drop foreign keys on match-related tables
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "match_messages" DROP CONSTRAINT IF EXISTS "FK_match_messages_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "match_messages" DROP CONSTRAINT IF EXISTS "FK_match_messages_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "match_teams" DROP CONSTRAINT IF EXISTS "FK_match_teams_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "match_players" DROP CONSTRAINT IF EXISTS "FK_match_players_player"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "match_players" DROP CONSTRAINT IF EXISTS "FK_match_players_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "matches" DROP CONSTRAINT IF EXISTS "FK_matches_format"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "matches" DROP CONSTRAINT IF EXISTS "FK_matches_venue"`,
    );

    // 3. Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_messages_match"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_mp_player"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_mp_match"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_region"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_venue_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_matches_status"`,
    );

    // 4. Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "match_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_teams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_players"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "matches"`);

    // 5. Drop ENUM types
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."match_messages_message_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."match_players_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."matches_status_enum"`,
    );
  }
}
