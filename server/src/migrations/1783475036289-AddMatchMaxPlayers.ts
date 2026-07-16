import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMatchMaxPlayers1783475036289 implements MigrationInterface {
    name = 'AddMatchMaxPlayers1783475036289'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" ADD "max_players" integer NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "max_players"`);
    }

}
