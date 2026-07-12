import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNormalizedPhone1783629000000 implements MigrationInterface {
  name = 'AddNormalizedPhone1783629000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "client" ADD "phoneNormalized" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_identity" ADD "phoneNormalized" character varying`,
    );
    await queryRunner.query(`
      UPDATE "client"
      SET "phoneNormalized" = NULLIF(regexp_replace(COALESCE("phone", ''), '\\D', '', 'g'), '')
    `);
    await queryRunner.query(`
      UPDATE "client"
      SET "phoneNormalized" = substring("phoneNormalized" from 3)
      WHERE "phoneNormalized" LIKE '00%'
    `);
    await queryRunner.query(`
      UPDATE "contact_identity"
      SET "phoneNormalized" = NULLIF(regexp_replace(COALESCE("phone", ''), '\\D', '', 'g'), '')
    `);
    await queryRunner.query(`
      UPDATE "contact_identity"
      SET "phoneNormalized" = substring("phoneNormalized" from 3)
      WHERE "phoneNormalized" LIKE '00%'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_client_phone_normalized" ON "client" ("phoneNormalized")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contact_identity_phone_normalized" ON "contact_identity" ("phoneNormalized")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_contact_identity_phone_normalized"`);
    await queryRunner.query(`DROP INDEX "IDX_client_phone_normalized"`);
    await queryRunner.query(
      `ALTER TABLE "contact_identity" DROP COLUMN "phoneNormalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "client" DROP COLUMN "phoneNormalized"`,
    );
  }
}
