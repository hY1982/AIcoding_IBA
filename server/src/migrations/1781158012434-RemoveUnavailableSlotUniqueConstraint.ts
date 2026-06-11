import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUnavailableSlotUniqueConstraint1781158012434 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 删除 venue_unavailable_slots 表上的唯一约束
        // 该约束限制了同一 venue + date + start_time 只能有一条记录
        // 删除后允许用户删除并重新添加相同开始时间的时段
        await queryRunner.query(
            `ALTER TABLE "venue_unavailable_slots" DROP CONSTRAINT IF EXISTS "UQ_unavailable_venue_date_start"`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "venue_unavailable_slots" ADD CONSTRAINT "UQ_unavailable_venue_date_start" UNIQUE ("venue_id", "slot_date", "start_time")`,
        );
    }

}
