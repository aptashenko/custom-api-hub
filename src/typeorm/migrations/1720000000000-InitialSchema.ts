import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1720000000000 implements MigrationInterface {
  name = 'InitialSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      `CREATE TYPE "channel_enum" AS ENUM ('TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'SENDPULSE', 'CUSTOM')`,
    );
    await queryRunner.query(
      `CREATE TYPE "conversation_status_enum" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "message_direction_enum" AS ENUM ('IN', 'OUT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "make_sync_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "client" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying,
        "phone" character varying,
        "email" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_client_phone" ON "client" ("phone")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_client_email" ON "client" ("email")`,
    );

    await queryRunner.query(`
      CREATE TABLE "raw_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source" character varying NOT NULL,
        "eventType" character varying,
        "payload" jsonb NOT NULL,
        "processed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_raw_event_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_raw_event_processed" ON "raw_events" ("processed")`,
    );

    await queryRunner.query(`
      CREATE TABLE "contact_identity" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "channel" "channel_enum" NOT NULL,
        "externalId" character varying NOT NULL,
        "username" character varying,
        "phone" character varying,
        "email" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_identity_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_contact_identity_client" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_contact_identity_external_id" ON "contact_identity" ("externalId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_contact_identity_channel_external_id" ON "contact_identity" ("channel", "externalId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "conversation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "channel" "channel_enum" NOT NULL,
        "status" "conversation_status_enum" NOT NULL,
        "source" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_client" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lead_source" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "utmSource" character varying,
        "utmMedium" character varying,
        "utmCampaign" character varying,
        "utmContent" character varying,
        "utmTerm" character varying,
        "referrer" character varying,
        "landingPage" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lead_source_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_source_client" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "message" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "conversationId" uuid,
        "channel" "channel_enum" NOT NULL,
        "direction" "message_direction_enum" NOT NULL,
        "text" text,
        "externalMessageId" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_message_client" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_message_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_message_client_id" ON "message" ("clientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_conversation_id" ON "message" ("conversationId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "make_sync_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid,
        "conversationId" uuid,
        "status" "make_sync_status_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "sentAt" TIMESTAMP WITH TIME ZONE,
        "error" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_make_sync_event_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_make_sync_event_client" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_make_sync_event_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "make_sync_event"`);
    await queryRunner.query(`DROP INDEX "IDX_message_conversation_id"`);
    await queryRunner.query(`DROP INDEX "IDX_message_client_id"`);
    await queryRunner.query(`DROP TABLE "message"`);
    await queryRunner.query(`DROP TABLE "lead_source"`);
    await queryRunner.query(`DROP TABLE "conversation"`);
    await queryRunner.query(
      `DROP INDEX "IDX_contact_identity_channel_external_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_contact_identity_external_id"`);
    await queryRunner.query(`DROP TABLE "contact_identity"`);
    await queryRunner.query(`DROP INDEX "IDX_raw_event_processed"`);
    await queryRunner.query(`DROP TABLE "raw_events"`);
    await queryRunner.query(`DROP INDEX "IDX_client_email"`);
    await queryRunner.query(`DROP INDEX "IDX_client_phone"`);
    await queryRunner.query(`DROP TABLE "client"`);
    await queryRunner.query(`DROP TYPE "make_sync_status_enum"`);
    await queryRunner.query(`DROP TYPE "message_direction_enum"`);
    await queryRunner.query(`DROP TYPE "conversation_status_enum"`);
    await queryRunner.query(`DROP TYPE "channel_enum"`);
  }
}
