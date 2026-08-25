import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMakeWebhookLogs1785000100000 implements MigrationInterface {
  name = 'CreateMakeWebhookLogs1785000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "make_webhook_log_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "make_webhook_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "makeSyncEventId" uuid NOT NULL,
        "clientId" uuid,
        "clientNumber" integer,
        "name" text,
        "phone" text,
        "email" text,
        "username" text,
        "channel" "channel_enum" NOT NULL,
        "status" "make_webhook_log_status_enum" NOT NULL,
        "payload" jsonb NOT NULL,
        "attemptedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "error" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_make_webhook_log_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_make_webhook_log_make_sync_event" FOREIGN KEY ("makeSyncEventId") REFERENCES "make_sync_event"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_attempted_at" ON "make_webhook_log" ("attemptedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_client_id" ON "make_webhook_log" ("clientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_client_number" ON "make_webhook_log" ("clientNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_phone" ON "make_webhook_log" ("phone")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_email" ON "make_webhook_log" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_username" ON "make_webhook_log" ("username")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_make_webhook_log_status" ON "make_webhook_log" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_status"`);
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_username"`);
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_email"`);
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_phone"`);
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_client_number"`);
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_client_id"`);
    await queryRunner.query(`DROP INDEX "IDX_make_webhook_log_attempted_at"`);
    await queryRunner.query(`DROP TABLE "make_webhook_log"`);
    await queryRunner.query(`DROP TYPE "make_webhook_log_status_enum"`);
  }
}
