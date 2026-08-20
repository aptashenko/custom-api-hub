import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientLeadCreatedAt1784827200000 implements MigrationInterface {
  name = 'AddClientLeadCreatedAt1784827200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "client" ADD "leadCreatedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "client" SET "leadCreatedAt" = "createdAt" WHERE "leadCreatedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "client" ALTER COLUMN "leadCreatedAt" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "client" ALTER COLUMN "leadCreatedAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_client_lead_created_at" ON "client" ("leadCreatedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_client_lead_created_at"`);
    await queryRunner.query(`ALTER TABLE "client" DROP COLUMN "leadCreatedAt"`);
  }
}
