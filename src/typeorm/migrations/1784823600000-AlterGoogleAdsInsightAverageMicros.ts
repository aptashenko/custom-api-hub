import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterGoogleAdsInsightAverageMicros1784823600000
  implements MigrationInterface
{
  name = 'AlterGoogleAdsInsightAverageMicros1784823600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "google_ads_insights"
      ALTER COLUMN "averageCpcMicros" TYPE numeric
      USING "averageCpcMicros"::numeric
    `);
    await queryRunner.query(`
      ALTER TABLE "google_ads_insights"
      ALTER COLUMN "costPerConversionMicros" TYPE numeric
      USING "costPerConversionMicros"::numeric
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "google_ads_insights"
      ALTER COLUMN "costPerConversionMicros" TYPE bigint
      USING "costPerConversionMicros"::bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "google_ads_insights"
      ALTER COLUMN "averageCpcMicros" TYPE bigint
      USING "averageCpcMicros"::bigint
    `);
  }
}
