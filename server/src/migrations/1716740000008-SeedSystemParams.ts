import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 系统参数种子数据迁移
 *
 * 插入平台运行所需的初始系统参数配置。
 * 数据与 basketball-match-platform-blueprint.md 中 system_params 初始 INSERT 完全一致。
 *
 * 版本管理策略：
 * - 本迁移仅负责初始化，使用 ON CONFLICT DO NOTHING 保证幂等性
 * - 后续对已有参数的变更必须创建新的迁移文件（如 1716740000009-UpdateAbilityWeights.ts）
 * - 禁止直接修改本迁移文件
 */
export class SeedSystemParams1716740000008 implements MigrationInterface {
  name = 'SeedSystemParams1716740000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "system_params" ("param_key", "param_value", "description")
       VALUES
         ('ability_adjust_weights', '{"level_match":{"unclear":0,"lower":-1,"equal":0,"higher":1},"sportsmanship":{"good":1,"average":0,"poor":-1},"action_cleanliness":{"clean":1,"average":0,"dirty":-2},"punctuality":{"true":1,"false":-1}}'::jsonb, '能力匹配调节值计算权重'),
         ('match_threshold_params', '{"base_threshold":20.0,"min_threshold":5.0,"intention_count_factor":0.5}'::jsonb, '匹配能力值差距动态阈值参数'),
         ('base_ability_weights', '{"height":0.15,"weight":0.05,"wingspan":0.10,"standing_reach":0.10,"jumping_reach":0.15,"basketball_age":0.20,"age":0.05,"position_fit":0.20}'::jsonb, '基础能力值计算权重')
       ON CONFLICT ("param_key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "system_params" WHERE "param_key" IN ('ability_adjust_weights', 'match_threshold_params', 'base_ability_weights')`,
    );
  }
}
