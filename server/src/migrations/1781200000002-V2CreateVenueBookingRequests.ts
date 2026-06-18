import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v2.0 新增表：venue_booking_requests。
 *
 * 记录场地预订请求的全生命周期：
 * - 满员后创建请求（status=pending，deadline=requestedAt+30min）
 * - 场地方手动确认 / 超时自动确认 / 拒绝 / 取消
 *
 * 索引设计：
 * - (match_id): 按比赛查询预订请求
 * - (venue_id, slot_date): 按场地+日期查询当日请求
 * - (status, response_deadline): 超时调度器高频查询
 */
export class V2CreateVenueBookingRequests1781200000002 implements MigrationInterface {
  name = 'V2CreateVenueBookingRequests1781200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM type (idempotent)
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."venue_booking_requests_status_enum" AS ENUM('pending','confirmed','auto_confirmed','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 2. Create venue_booking_requests table
    await queryRunner.query(
      `CREATE TABLE "venue_booking_requests" (
        "id" BIGSERIAL NOT NULL,
        "match_id" bigint NOT NULL,
        "venue_id" bigint NOT NULL,
        "slot_date" date NOT NULL,
        "start_time" character varying(8) NOT NULL,
        "end_time" character varying(8) NOT NULL,
        "status" "public"."venue_booking_requests_status_enum" NOT NULL DEFAULT 'pending',
        "requested_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "responded_at" TIMESTAMPTZ,
        "response_deadline" TIMESTAMPTZ NOT NULL,
        "rejection_reason" character varying(500),
        CONSTRAINT "PK_venue_booking_requests" PRIMARY KEY ("id")
      )`,
    );

    // 3. Foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "venue_booking_requests" ADD CONSTRAINT "FK_vbr_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "venue_booking_requests" ADD CONSTRAINT "FK_vbr_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // 4. Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_vbr_match" ON "venue_booking_requests" ("match_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vbr_venue_date" ON "venue_booking_requests" ("venue_id", "slot_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vbr_status_deadline" ON "venue_booking_requests" ("status", "response_deadline")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_vbr_status_deadline"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_vbr_venue_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_vbr_match"`,
    );

    // 2. Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "venue_booking_requests" DROP CONSTRAINT IF EXISTS "FK_vbr_venue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "venue_booking_requests" DROP CONSTRAINT IF EXISTS "FK_vbr_match"`,
    );

    // 3. Drop table
    await queryRunner.query(
      `DROP TABLE IF EXISTS "venue_booking_requests"`,
    );

    // 4. Drop ENUM type
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."venue_booking_requests_status_enum"`,
    );
  }
}
