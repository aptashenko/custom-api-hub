import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSendPulseContacts1783618200000 implements MigrationInterface {
  name = 'CreateSendPulseContacts1783618200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sendpulse_contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid,
        "contactIdentityId" uuid,
        "exportKey" character varying NOT NULL,
        "botId" character varying,
        "contactId" character varying,
        "dialogIds" character varying array NOT NULL DEFAULT '{}',
        "tags" jsonb,
        "variables" jsonb,
        "rawContact" jsonb,
        "rawDialogs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rawProfile" jsonb NOT NULL,
        "sourceFile" character varying,
        "exportedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sendpulse_contact_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sendpulse_contact_client" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_sendpulse_contact_identity" FOREIGN KEY ("contactIdentityId") REFERENCES "contact_identity"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_sendpulse_contact_export_key" ON "sendpulse_contacts" ("exportKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sendpulse_contact_bot_contact" ON "sendpulse_contacts" ("botId", "contactId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sendpulse_contact_client_id" ON "sendpulse_contacts" ("clientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sendpulse_contact_identity_id" ON "sendpulse_contacts" ("contactIdentityId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sendpulse_contact_identity_id"`);
    await queryRunner.query(`DROP INDEX "IDX_sendpulse_contact_client_id"`);
    await queryRunner.query(`DROP INDEX "IDX_sendpulse_contact_bot_contact"`);
    await queryRunner.query(`DROP INDEX "IDX_sendpulse_contact_export_key"`);
    await queryRunner.query(`DROP TABLE "sendpulse_contacts"`);
  }
}
