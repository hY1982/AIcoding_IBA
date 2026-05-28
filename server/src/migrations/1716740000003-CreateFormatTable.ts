import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFormatTable1716740000003 implements MigrationInterface {
  name = 'CreateFormatTable1716740000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM type for format_type
    await queryRunner.query(
      `CREATE TYPE "public"."formats_format_type_enum" AS ENUM('short','long')`,
    );

    // 2. Create formats table with CHECK constraint
    await queryRunner.query(
      `CREATE TABLE "formats" (
        "id" BIGSERIAL NOT NULL,
        "name" character varying(50) NOT NULL,
        "format_type" "public"."formats_format_type_enum" NOT NULL,
        "team_size" integer NOT NULL,
        "team_count_min" integer NOT NULL,
        "team_count_max" integer NOT NULL,
        "win_condition" character varying(100),
        "duration_hours" numeric(3,1),
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_formats" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_formats_team_counts" CHECK ("team_count_max" >= "team_count_min")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency
    await queryRunner.query(`DROP TABLE IF EXISTS "formats"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."formats_format_type_enum"`,
    );
  }
}
