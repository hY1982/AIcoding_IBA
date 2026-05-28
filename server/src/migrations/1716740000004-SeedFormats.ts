import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedFormats1716740000004 implements MigrationInterface {
  name = 'SeedFormats1716740000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "formats" (
        "name",
        "format_type",
        "team_size",
        "team_count_min",
        "team_count_max",
        "win_condition",
        "duration_hours",
        "description"
      ) VALUES
        ('3v3短赛','short',3,3,4,'先进5球或11分',1.5,'3对3短赛，先进5球或先得11分者胜'),
        ('4v4短赛','short',4,3,4,'先进5球或11分',2.0,'4对4短赛，先进5球或先得11分者胜'),
        ('5v5短赛','short',5,3,4,'先进5球或11分',2.5,'5对5短赛，先进5球或先得11分者胜')
      ON CONFLICT ("name") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "formats" WHERE "name" IN ('3v3短赛','4v4短赛','5v5短赛')`,
    );
  }
}
