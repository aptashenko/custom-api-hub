import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoogleAdsTables1784820000000 implements MigrationInterface {
  name = 'CreateGoogleAdsTables1784820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "google_ads_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "googleCustomerId" character varying NOT NULL,
        "googleCampaignId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "status" character varying,
        "advertisingChannelType" character varying,
        "advertisingChannelSubType" character varying,
        "biddingStrategyType" character varying,
        "campaignBudgetId" character varying,
        "campaignBudgetName" character varying,
        "campaignBudgetAmountMicros" bigint,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_ads_campaigns" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_google_ads_campaigns_customer_campaign" ON "google_ads_campaigns" ("googleCustomerId", "googleCampaignId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "google_ads_ad_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "googleCustomerId" character varying NOT NULL,
        "googleCampaignId" character varying NOT NULL,
        "googleAdGroupId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "status" character varying,
        "type" character varying,
        "cpcBidMicros" bigint,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_ads_ad_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_google_ads_ad_groups_customer_ad_group" ON "google_ads_ad_groups" ("googleCustomerId", "googleAdGroupId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_ad_groups_campaign" ON "google_ads_ad_groups" ("googleCustomerId", "googleCampaignId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "google_ads_ads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "googleCustomerId" character varying NOT NULL,
        "googleCampaignId" character varying NOT NULL,
        "googleAdGroupId" character varying NOT NULL,
        "googleAdId" character varying NOT NULL,
        "name" character varying,
        "status" character varying,
        "type" character varying,
        "finalUrls" jsonb,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_ads_ads" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_google_ads_ads_customer_ad" ON "google_ads_ads" ("googleCustomerId", "googleAdId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_ads_ad_group" ON "google_ads_ads" ("googleCustomerId", "googleAdGroupId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_ads_campaign" ON "google_ads_ads" ("googleCustomerId", "googleCampaignId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "google_ads_clicks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "googleCustomerId" character varying NOT NULL,
        "date" date NOT NULL,
        "gclid" character varying,
        "googleCampaignId" character varying,
        "campaignName" character varying,
        "googleAdGroupId" character varying,
        "adGroupName" character varying,
        "googleAdId" character varying,
        "keywordText" text,
        "keywordMatchType" character varying,
        "device" character varying,
        "adNetworkType" character varying,
        "slot" character varying,
        "clickType" character varying,
        "pageNumber" character varying,
        "locationOfPresenceCity" character varying,
        "locationOfPresenceCountry" character varying,
        "locationOfPresenceRegion" character varying,
        "clicks" integer NOT NULL DEFAULT 0,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_ads_clicks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_google_ads_clicks_customer_date_gclid" ON "google_ads_clicks" ("googleCustomerId", "date", "gclid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_clicks_gclid" ON "google_ads_clicks" ("gclid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_clicks_campaign_date" ON "google_ads_clicks" ("googleCustomerId", "googleCampaignId", "date")`,
    );

    await queryRunner.query(`
      CREATE TABLE "google_ads_insights" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "googleCustomerId" character varying NOT NULL,
        "googleCampaignId" character varying,
        "googleAdGroupId" character varying,
        "googleAdId" character varying,
        "level" character varying NOT NULL,
        "dateStart" date NOT NULL,
        "dateStop" date NOT NULL,
        "currencyCode" character varying,
        "impressions" bigint NOT NULL DEFAULT 0,
        "clicks" bigint NOT NULL DEFAULT 0,
        "costMicros" bigint NOT NULL DEFAULT 0,
        "cost" numeric,
        "ctr" numeric,
        "averageCpcMicros" bigint,
        "averageCpc" numeric,
        "averageCpm" numeric,
        "conversions" numeric,
        "conversionsValue" numeric,
        "costPerConversionMicros" bigint,
        "costPerConversion" numeric,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_ads_insights" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_google_ads_insights_identity"
      ON "google_ads_insights" (
        "googleCustomerId",
        "level",
        "dateStart",
        "dateStop",
        COALESCE("googleCampaignId", ''),
        COALESCE("googleAdGroupId", ''),
        COALESCE("googleAdId", '')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_insights_customer_date" ON "google_ads_insights" ("googleCustomerId", "dateStart")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_google_ads_insights_ad_date" ON "google_ads_insights" ("googleAdId", "dateStart")`,
    );

    await queryRunner.query(`
      CREATE TABLE "google_ads_sync_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying NOT NULL,
        "status" character varying NOT NULL,
        "googleCustomerIds" text[] NOT NULL DEFAULT '{}',
        "dateFrom" date,
        "dateTo" date,
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "error" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_google_ads_sync_runs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`ALTER TABLE "lead_source" ADD "gclid" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "gbraid" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "wbraid" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleCustomerId" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleCampaignId" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleAdGroupId" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleAdId" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleKeyword" text`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleMatchType" character varying`);
    await queryRunner.query(`ALTER TABLE "lead_source" ADD "googleDevice" character varying`);
    await queryRunner.query(
      `CREATE INDEX "IDX_lead_source_gclid" ON "lead_source" ("gclid")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_lead_source_gclid"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleDevice"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleMatchType"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleKeyword"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleAdId"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleAdGroupId"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleCampaignId"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "googleCustomerId"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "wbraid"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "gbraid"`);
    await queryRunner.query(`ALTER TABLE "lead_source" DROP COLUMN "gclid"`);
    await queryRunner.query(`DROP TABLE "google_ads_sync_runs"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_insights_ad_date"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_insights_customer_date"`);
    await queryRunner.query(`DROP INDEX "UQ_google_ads_insights_identity"`);
    await queryRunner.query(`DROP TABLE "google_ads_insights"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_clicks_campaign_date"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_clicks_gclid"`);
    await queryRunner.query(`DROP INDEX "UQ_google_ads_clicks_customer_date_gclid"`);
    await queryRunner.query(`DROP TABLE "google_ads_clicks"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_ads_campaign"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_ads_ad_group"`);
    await queryRunner.query(`DROP INDEX "UQ_google_ads_ads_customer_ad"`);
    await queryRunner.query(`DROP TABLE "google_ads_ads"`);
    await queryRunner.query(`DROP INDEX "IDX_google_ads_ad_groups_campaign"`);
    await queryRunner.query(`DROP INDEX "UQ_google_ads_ad_groups_customer_ad_group"`);
    await queryRunner.query(`DROP TABLE "google_ads_ad_groups"`);
    await queryRunner.query(`DROP INDEX "UQ_google_ads_campaigns_customer_campaign"`);
    await queryRunner.query(`DROP TABLE "google_ads_campaigns"`);
  }
}
