import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitUserAndPlayerEntities1716740000001 implements MigrationInterface {
  name = 'InitUserAndPlayerEntities1716740000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."users_user_type_enum" AS ENUM('player', 'venue_manager'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'banned'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" BIGSERIAL NOT NULL, "phone" character varying(255) NOT NULL, "phone_hash" character varying(64) NOT NULL, "password_hash" character varying(255) NOT NULL, "nickname" character varying(50) NOT NULL, "real_name" character varying(255), "id_card" character varying(255), "avatar_url" character varying(500), "user_type" "public"."users_user_type_enum" NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "region_code" character varying(20), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0e438a8460e5816e07aeb6b334f" UNIQUE ("phone_hash"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")); COMMENT ON COLUMN "users"."phone_hash" IS 'HMAC-SHA256 hash of phone for indexed lookup'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f6a8ac2795a603f380bd496681" ON "users" ("region_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c6778957fcf0cd97c7e27f080e" ON "users" ("user_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e438a8460e5816e07aeb6b334" ON "users" ("phone_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "venue_managers" ("id" BIGSERIAL NOT NULL, "user_id" bigint NOT NULL, "company_name" character varying(100), "contact_name" character varying(50), "contact_phone" character varying(20), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_271744c7712b4f39e5be5d16578" UNIQUE ("user_id"), CONSTRAINT "REL_271744c7712b4f39e5be5d1657" UNIQUE ("user_id"), CONSTRAINT "PK_3818f1089141bafc49da2280061" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."players_gender_enum" AS ENUM('male', 'female'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."players_team_role_enum" AS ENUM('starter', 'bench'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'basketball_platform',
        'public',
        'players',
        'GENERATED_COLUMN',
        'total_ability_score',
        'base_ability_score + match_adjust_value',
      ],
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" BIGSERIAL NOT NULL, "user_id" bigint NOT NULL, "age" integer NOT NULL, "basketball_age" integer NOT NULL, "gender" "public"."players_gender_enum" NOT NULL, "height" integer NOT NULL, "weight" numeric(5,1), "wingspan" integer, "standing_reach" integer, "jumping_reach" integer, "base_ability_score" numeric(5,2) NOT NULL DEFAULT '0', "match_adjust_value" numeric(5,2) NOT NULL DEFAULT '0', "total_ability_score" numeric(6,2) GENERATED ALWAYS AS (base_ability_score + match_adjust_value) STORED NOT NULL, "bench_press" numeric(5,1), "hand_length" numeric(4,1), "sprint_100m" numeric(5,2), "run_1000m" numeric(6,2), "run_2000m" numeric(6,2), "run_5000m" numeric(6,2), "run_record_date" date, "team_experience" character varying(100) array, "team_role" "public"."players_team_role_enum", "breakthrough_level" integer DEFAULT '0', "passing_level" integer DEFAULT '0', "defense_level" integer DEFAULT '0', "region_code" character varying(20), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ba3575d2fbe71fab7155366235e" UNIQUE ("user_id"), CONSTRAINT "REL_ba3575d2fbe71fab7155366235" UNIQUE ("user_id"), CONSTRAINT "PK_de22b8fdeee0c33ab55ae71da3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee63dfe48b84140848cadad19f" ON "players" ("region_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50344bfd219fd4f7e0ae2f0090" ON "players" ("total_ability_score") `,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."player_positions_position_enum" AS ENUM('PG', 'SG', 'SF', 'PF', 'C'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE "player_positions" ("id" BIGSERIAL NOT NULL, "player_id" bigint NOT NULL, "position" "public"."player_positions_position_enum" NOT NULL, "priority" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_5b358a4a43b26bbb727bc235d00" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_089e71cd2ce8951a5065441ea1" ON "player_positions" ("player_id", "position") `,
    );
    await queryRunner.query(
      `ALTER TABLE "venue_managers" ADD CONSTRAINT "FK_271744c7712b4f39e5be5d16578" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_ba3575d2fbe71fab7155366235e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_positions" ADD CONSTRAINT "FK_1faa76b8b170b6f61095ae16451" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_positions" DROP CONSTRAINT "FK_1faa76b8b170b6f61095ae16451"`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" DROP CONSTRAINT "FK_ba3575d2fbe71fab7155366235e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "venue_managers" DROP CONSTRAINT "FK_271744c7712b4f39e5be5d16578"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_089e71cd2ce8951a5065441ea1"`,
    );
    await queryRunner.query(`DROP TABLE "player_positions"`);
    await queryRunner.query(
      `DROP TYPE "public"."player_positions_position_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50344bfd219fd4f7e0ae2f0090"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee63dfe48b84140848cadad19f"`,
    );
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      [
        'GENERATED_COLUMN',
        'total_ability_score',
        'basketball_platform',
        'public',
        'players',
      ],
    );
    await queryRunner.query(`DROP TYPE "public"."players_team_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."players_gender_enum"`);
    await queryRunner.query(`DROP TABLE "venue_managers"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0e438a8460e5816e07aeb6b334"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c6778957fcf0cd97c7e27f080e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f6a8ac2795a603f380bd496681"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_user_type_enum"`);
  }
}
