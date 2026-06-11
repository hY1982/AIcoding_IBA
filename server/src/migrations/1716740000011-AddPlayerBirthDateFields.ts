import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerBirthDateFields1716740000011 implements MigrationInterface {
  name = 'AddPlayerBirthDateFields1716740000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加 birth_date 和 start_playing_date 字段
    await queryRunner.query(
      `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "birth_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "start_playing_date" date`,
    );

    // 为现有数据生成估算值：根据现有 age/basketball_age 反推
    // birth_date = 当前日期 - age 年
    // start_playing_date = 当前日期 - basketball_age 年，固定为该月1号
    await queryRunner.query(
      `UPDATE "players" SET "birth_date" = CURRENT_DATE - INTERVAL '1 year' * "age"`,
    );
    await queryRunner.query(
      `UPDATE "players" SET "start_playing_date" = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year' * "basketball_age")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "players" DROP COLUMN IF EXISTS "start_playing_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" DROP COLUMN IF EXISTS "birth_date"`,
    );
  }
}
