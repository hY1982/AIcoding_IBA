import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUnavailableSlotsAndBusinessHours1716740000010 implements MigrationInterface {
  name = 'CreateUnavailableSlotsAndBusinessHours1716740000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add business hours columns to venues table
    await queryRunner.query(
      `ALTER TABLE "venues" ADD COLUMN "open_time" time without time zone DEFAULT '08:00:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "venues" ADD COLUMN "close_time" time without time zone DEFAULT '22:00:00'`,
    );

    // 2. Create venue_unavailable_slots table
    await queryRunner.query(
      `CREATE TABLE "venue_unavailable_slots" (
        "id" BIGSERIAL NOT NULL,
        "venue_id" bigint NOT NULL,
        "slot_date" date NOT NULL,
        "start_time" time without time zone NOT NULL,
        "end_time" time without time zone NOT NULL,
        "reason" character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venue_unavailable_slots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_unavailable_venue_date_start" UNIQUE ("venue_id", "slot_date", "start_time"),
        CONSTRAINT "FK_unavailable_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );

    // 3. Create composite index on venue_unavailable_slots
    await queryRunner.query(
      `CREATE INDEX "IDX_unavailable_venue_date" ON "venue_unavailable_slots" ("venue_id", "slot_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_unavailable_venue_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_unavailable_slots"`);
    await queryRunner.query(
      `ALTER TABLE "venues" DROP COLUMN IF EXISTS "close_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "venues" DROP COLUMN IF EXISTS "open_time"`,
    );
  }
}
