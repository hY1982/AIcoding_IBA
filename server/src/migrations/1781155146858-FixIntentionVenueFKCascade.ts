import { MigrationInterface, QueryRunner } from "typeorm";

export class FixIntentionVenueFKCascade1781155146858 implements MigrationInterface {
    name = 'FixIntentionVenueFKCascade1781155146858'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "intention_venues" DROP CONSTRAINT IF EXISTS "FK_b02ef9a76c32e09311b9eb16474"`);
        await queryRunner.query(`ALTER TABLE "intention_venues" ADD CONSTRAINT "FK_b02ef9a76c32e09311b9eb16474" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "intention_venues" DROP CONSTRAINT IF EXISTS "FK_b02ef9a76c32e09311b9eb16474"`);
        await queryRunner.query(`ALTER TABLE "intention_venues" ADD CONSTRAINT "FK_b02ef9a76c32e09311b9eb16474" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
