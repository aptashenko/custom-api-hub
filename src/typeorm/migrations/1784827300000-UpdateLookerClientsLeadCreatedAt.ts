import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateLookerClientsLeadCreatedAt1784827300000
  implements MigrationInterface
{
  name = 'UpdateLookerClientsLeadCreatedAt1784827300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.looker_clients AS
      SELECT
        c.id,
        c."clientNumber" AS client_number,
        c.name,
        c.phone,
        c."phoneNormalized" AS phone_normalized,
        c.email,
        c."createdAt" AS created_at,
        c."updatedAt" AS updated_at,
        c."leadCreatedAt" AS lead_created_at
      FROM public.client c
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.looker_clients AS
      SELECT
        c.id,
        c."clientNumber" AS client_number,
        c.name,
        c.phone,
        c."phoneNormalized" AS phone_normalized,
        c.email,
        c."createdAt" AS created_at,
        c."updatedAt" AS updated_at
      FROM public.client c
    `);
  }
}
