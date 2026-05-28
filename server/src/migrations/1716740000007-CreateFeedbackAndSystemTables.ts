import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackAndSystemTables1716740000007 implements MigrationInterface {
  name = 'CreateFeedbackAndSystemTables1716740000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM types (idempotent)
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."feedback_player_ratings_level_match_enum" AS ENUM('unclear','lower','equal','higher'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."feedback_player_ratings_sportsmanship_enum" AS ENUM('good','average','poor'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."feedback_player_ratings_action_cleanliness_enum" AS ENUM('clean','average','dirty'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."notifications_send_status_enum" AS ENUM('pending','succeeded','failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."notifications_type_enum" AS ENUM('match_invited','match_confirmed','match_success','match_failed','intention_matched','intention_expired','intention_reminder','payment_success','payment_failed','feedback_request','system_announcement'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 2. Create feedbacks table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "feedbacks" (
        "id" BIGSERIAL NOT NULL,
        "match_id" bigint NOT NULL,
        "player_id" bigint NOT NULL,
        "overall_rating" integer NOT NULL,
        "overall_reason" character varying(500),
        "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "region_code" character varying(20),
        CONSTRAINT "PK_feedbacks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feedbacks_match_player" UNIQUE ("match_id", "player_id"),
        CONSTRAINT "CHK_feedbacks_overall_rating" CHECK ("overall_rating" BETWEEN 1 AND 5)
      )`,
    );

    // 3. Create feedback_player_ratings table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "feedback_player_ratings" (
        "id" BIGSERIAL NOT NULL,
        "feedback_id" bigint NOT NULL,
        "rated_player_id" bigint NOT NULL,
        "level_match" "public"."feedback_player_ratings_level_match_enum",
        "sportsmanship" "public"."feedback_player_ratings_sportsmanship_enum",
        "action_cleanliness" "public"."feedback_player_ratings_action_cleanliness_enum",
        "is_punctual" boolean,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback_player_ratings" PRIMARY KEY ("id")
      )`,
    );

    // 4. Create system_params table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "system_params" (
        "id" BIGSERIAL NOT NULL,
        "param_key" character varying(100) NOT NULL,
        "param_value" jsonb NOT NULL,
        "description" character varying(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_params" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_params_param_key" UNIQUE ("param_key")
      )`,
    );

    // 5. Create notifications table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "notifications" (
        "id" BIGSERIAL NOT NULL,
        "user_id" bigint NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "content" text NOT NULL,
        "data" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "send_status" "public"."notifications_send_status_enum" NOT NULL DEFAULT 'pending',
        "sent_at" TIMESTAMPTZ,
        "sent_via" character varying(20)[],
        "region_code" character varying(20),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )`,
    );

    // 6. Add foreign key constraints (idempotent)
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "feedbacks" ADD CONSTRAINT "FK_feedbacks_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "feedbacks" ADD CONSTRAINT "FK_feedbacks_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "feedback_player_ratings" ADD CONSTRAINT "FK_feedback_player_ratings_feedback" FOREIGN KEY ("feedback_id") REFERENCES "feedbacks"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "feedback_player_ratings" ADD CONSTRAINT "FK_feedback_player_ratings_rated_player" FOREIGN KEY ("rated_player_id") REFERENCES "players"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 7. Create indexes (idempotent)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_feedbacks_match" ON "feedbacks" ("match_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_feedbacks_player" ON "feedbacks" ("player_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_feedback_player_ratings_feedback" ON "feedback_player_ratings" ("feedback_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_feedback_player_ratings_rated_player" ON "feedback_player_ratings" ("rated_player_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_system_params_key" ON "system_params" ("param_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read_created" ON "notifications" ("user_id", "is_read", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_region" ON "notifications" ("region_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency

    // 1. Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "feedback_player_ratings" DROP CONSTRAINT IF EXISTS "FK_feedback_player_ratings_rated_player"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "feedback_player_ratings" DROP CONSTRAINT IF EXISTS "FK_feedback_player_ratings_feedback"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "feedbacks" DROP CONSTRAINT IF EXISTS "FK_feedbacks_player"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "feedbacks" DROP CONSTRAINT IF EXISTS "FK_feedbacks_match"`,
    );

    // 2. Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_notifications_region"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_notifications_user_read_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_system_params_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_feedback_player_ratings_rated_player"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_feedback_player_ratings_feedback"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_feedbacks_player"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_feedbacks_match"`,
    );

    // 3. Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_params"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_player_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedbacks"`);

    // 4. Drop ENUM types
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."notifications_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."notifications_send_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."feedback_player_ratings_action_cleanliness_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."feedback_player_ratings_sportsmanship_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."feedback_player_ratings_level_match_enum"`,
    );
  }
}
