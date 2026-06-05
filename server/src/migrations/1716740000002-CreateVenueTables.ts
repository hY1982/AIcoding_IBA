import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVenueTables1716740000002 implements MigrationInterface {
  name = 'CreateVenueTables1716740000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ENUM types (idempotent: skip if already exists from synchronize)
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."venues_floor_material_enum" AS ENUM('wood','pu','silicone','cement','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."venues_court_type_enum" AS ENUM('indoor','outdoor','semi'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."venues_status_enum" AS ENUM('active','inactive'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );

    // 2. Create venues table
    await queryRunner.query(
      `CREATE TABLE "venues" (
        "id" BIGSERIAL NOT NULL,
        "manager_id" bigint NOT NULL,
        "name" character varying(100) NOT NULL,
        "address" character varying(255) NOT NULL,
        "price_per_hour" numeric(10,2) NOT NULL,
        "court_count" integer NOT NULL DEFAULT '1',
        "latitude" numeric(10,8),
        "longitude" numeric(11,8),
        "floor_material" "public"."venues_floor_material_enum",
        "lighting" character varying(50),
        "court_type" "public"."venues_court_type_enum",
        "ventilation" boolean DEFAULT false,
        "big_fan" boolean DEFAULT false,
        "air_condition" boolean DEFAULT false,
        "turnover_time" integer,
        "parking" boolean DEFAULT false,
        "restroom" boolean DEFAULT false,
        "shower" boolean DEFAULT false,
        "locker_room" boolean DEFAULT false,
        "video_record" boolean DEFAULT false,
        "rating_avg" numeric(3,2) DEFAULT null,
        "rating_count" integer DEFAULT '0',
        "status" "public"."venues_status_enum" NOT NULL DEFAULT 'active',
        "region_code" character varying(20),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venues" PRIMARY KEY ("id")
      )`,
    );

    // 3. Create indexes on venues
    await queryRunner.query(
      `CREATE INDEX "IDX_venues_manager" ON "venues" ("manager_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_venues_region" ON "venues" ("region_code")`,
    );
    // GIST spatial index on point(longitude, latitude) — WGS84 (SRID 4326)
    await queryRunner.query(
      `CREATE INDEX "IDX_venues_location" ON "venues" USING GIST (point("longitude", "latitude"))`,
    );

    // 4. Create venue_time_slots table
    await queryRunner.query(
      `CREATE TABLE "venue_time_slots" (
        "id" BIGSERIAL NOT NULL,
        "venue_id" bigint NOT NULL,
        "slot_date" date NOT NULL,
        "start_time" time without time zone NOT NULL,
        "end_time" time without time zone NOT NULL,
        "is_booked" boolean DEFAULT false,
        "match_id" bigint,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_venue_time_slots" PRIMARY KEY ("id")
      )`,
    );

    // 5. Create composite index on venue_time_slots
    await queryRunner.query(
      `CREATE INDEX "IDX_slots_venue_date" ON "venue_time_slots" ("venue_id", "slot_date")`,
    );

    // 6. Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "venues" ADD CONSTRAINT "FK_venues_manager" FOREIGN KEY ("manager_id") REFERENCES "venue_managers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "venue_time_slots" ADD CONSTRAINT "FK_slots_venue" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Strict reverse order with IF EXISTS for idempotency
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "venue_time_slots" DROP CONSTRAINT IF EXISTS "FK_slots_venue"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "venues" DROP CONSTRAINT IF EXISTS "FK_venues_manager"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_slots_venue_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_time_slots"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_venues_location"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_venues_region"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_venues_manager"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "venues"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."venues_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."venues_court_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."venues_floor_material_enum"`,
    );
  }
}
