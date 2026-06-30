import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v2.2 匹配引擎重构迁移：新增意向屏蔽字段 + 比赛取消原因字段。
 *
 * 变更摘要：
 * - intentions: 新增 excluded_until 列（场地屏蔽截止时间）
 * - matches: 新增 cancelled_reason 列（比赛关闭/取消原因）
 * - system_params: 新增 pooling_params 参数默认值
 */
export class V22MatchingEngineRefactor1781300000001 implements MigrationInterface {
  name = 'V22MatchingEngineRefactor1781300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Part 1: Intentions — 新增 excluded_until
    // ========================================

    await queryRunner.query(
      `ALTER TABLE "intentions" ADD COLUMN IF NOT EXISTS "excluded_until" TIMESTAMPTZ`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_intentions_excluded_until" ON "intentions" ("excluded_until")`,
    );

    // ========================================
    // Part 2: Matches — 新增 cancelled_reason
    // ========================================

    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "cancelled_reason" VARCHAR(50)`,
    );

    // ========================================
    // Part 3: System Params — 新增 pooling_params
    // ========================================

    await queryRunner.query(
      `INSERT INTO "system_params" ("param_key", "param_value", "description") 
       VALUES ('pooling_params', '{"maxAbilitySpread": 12, "minPoolSize": 6, "timeAlignmentMinutes": 30}', '匹配引擎池化参数（v2.2）')
       ON CONFLICT ("param_key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: remove columns and index
    await queryRunner.query(
      `ALTER TABLE "intentions" DROP COLUMN IF EXISTS "excluded_until"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_intentions_excluded_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "cancelled_reason"`,
    );
    await queryRunner.query(
      `DELETE FROM "system_params" WHERE "param_key" = 'pooling_params'`,
    );
  }
}
