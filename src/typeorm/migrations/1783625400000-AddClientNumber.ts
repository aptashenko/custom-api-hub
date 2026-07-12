import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientNumber1783625400000 implements MigrationInterface {
  name = 'AddClientNumber1783625400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "client_number_seq" START WITH 1001 INCREMENT BY 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "client" ADD "clientNumber" integer`,
    );
    await queryRunner.query(`
      WITH numbered_clients AS (
        SELECT
          "id",
          nextval('"client_number_seq"') AS "clientNumber"
        FROM "client"
        ORDER BY "createdAt", "id"
      )
      UPDATE "client"
      SET "clientNumber" = numbered_clients."clientNumber"
      FROM numbered_clients
      WHERE "client"."id" = numbered_clients."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "client" ALTER COLUMN "clientNumber" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "client" ALTER COLUMN "clientNumber" SET DEFAULT nextval('"client_number_seq"')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_client_client_number" ON "client" ("clientNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_client_client_number"`);
    await queryRunner.query(
      `ALTER TABLE "client" DROP COLUMN "clientNumber"`,
    );
    await queryRunner.query(`DROP SEQUENCE "client_number_seq"`);
  }
}
