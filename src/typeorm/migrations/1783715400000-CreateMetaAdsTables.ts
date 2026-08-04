import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetaAdsTables1783715400000 implements MigrationInterface {
  name = 'CreateMetaAdsTables1783715400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "meta_ad_accounts" (
        "metaAdAccountId" character varying NOT NULL,
        "accountId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "accountStatus" integer,
        "currency" character varying,
        "timezoneName" character varying,
        "businessId" character varying,
        "businessName" character varying,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_ad_accounts" PRIMARY KEY ("metaAdAccountId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "meta_campaigns" (
        "metaCampaignId" character varying NOT NULL,
        "metaAdAccountId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "objective" character varying,
        "status" character varying,
        "effectiveStatus" character varying,
        "buyingType" character varying,
        "dailyBudget" numeric,
        "lifetimeBudget" numeric,
        "budgetRemaining" numeric,
        "spendCap" numeric,
        "startTime" TIMESTAMP WITH TIME ZONE,
        "stopTime" TIMESTAMP WITH TIME ZONE,
        "createdTime" TIMESTAMP WITH TIME ZONE,
        "updatedTime" TIMESTAMP WITH TIME ZONE,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_campaigns" PRIMARY KEY ("metaCampaignId"),
        CONSTRAINT "FK_meta_campaigns_account" FOREIGN KEY ("metaAdAccountId") REFERENCES "meta_ad_accounts"("metaAdAccountId") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_campaigns_account" ON "meta_campaigns" ("metaAdAccountId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "meta_adsets" (
        "metaAdsetId" character varying NOT NULL,
        "metaAdAccountId" character varying NOT NULL,
        "metaCampaignId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "status" character varying,
        "effectiveStatus" character varying,
        "optimizationGoal" character varying,
        "billingEvent" character varying,
        "bidStrategy" character varying,
        "dailyBudget" numeric,
        "lifetimeBudget" numeric,
        "budgetRemaining" numeric,
        "targeting" jsonb,
        "promotedObject" jsonb,
        "attributionSpec" jsonb,
        "startTime" TIMESTAMP WITH TIME ZONE,
        "endTime" TIMESTAMP WITH TIME ZONE,
        "createdTime" TIMESTAMP WITH TIME ZONE,
        "updatedTime" TIMESTAMP WITH TIME ZONE,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_adsets" PRIMARY KEY ("metaAdsetId"),
        CONSTRAINT "FK_meta_adsets_account" FOREIGN KEY ("metaAdAccountId") REFERENCES "meta_ad_accounts"("metaAdAccountId") ON DELETE CASCADE,
        CONSTRAINT "FK_meta_adsets_campaign" FOREIGN KEY ("metaCampaignId") REFERENCES "meta_campaigns"("metaCampaignId") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_adsets_account" ON "meta_adsets" ("metaAdAccountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_adsets_campaign" ON "meta_adsets" ("metaCampaignId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "meta_ad_creatives" (
        "metaCreativeId" character varying NOT NULL,
        "metaAdAccountId" character varying NOT NULL,
        "name" character varying,
        "title" text,
        "body" text,
        "objectType" character varying,
        "status" character varying,
        "imageHash" character varying,
        "imageUrl" text,
        "thumbnailUrl" text,
        "videoId" character varying,
        "instagramUserId" character varying,
        "instagramPermalinkUrl" text,
        "callToActionType" character varying,
        "leadGenFormId" character varying,
        "objectStorySpec" jsonb,
        "assetFeedSpec" jsonb,
        "callToAction" jsonb,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_ad_creatives" PRIMARY KEY ("metaCreativeId"),
        CONSTRAINT "FK_meta_ad_creatives_account" FOREIGN KEY ("metaAdAccountId") REFERENCES "meta_ad_accounts"("metaAdAccountId") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ad_creatives_account" ON "meta_ad_creatives" ("metaAdAccountId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "meta_ads" (
        "metaAdId" character varying NOT NULL,
        "metaAdAccountId" character varying NOT NULL,
        "metaCampaignId" character varying NOT NULL,
        "metaAdsetId" character varying NOT NULL,
        "metaCreativeId" character varying,
        "name" character varying NOT NULL,
        "status" character varying,
        "effectiveStatus" character varying,
        "conversionDomain" character varying,
        "trackingSpecs" jsonb,
        "createdTime" TIMESTAMP WITH TIME ZONE,
        "updatedTime" TIMESTAMP WITH TIME ZONE,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_ads" PRIMARY KEY ("metaAdId"),
        CONSTRAINT "FK_meta_ads_account" FOREIGN KEY ("metaAdAccountId") REFERENCES "meta_ad_accounts"("metaAdAccountId") ON DELETE CASCADE,
        CONSTRAINT "FK_meta_ads_campaign" FOREIGN KEY ("metaCampaignId") REFERENCES "meta_campaigns"("metaCampaignId") ON DELETE CASCADE,
        CONSTRAINT "FK_meta_ads_adset" FOREIGN KEY ("metaAdsetId") REFERENCES "meta_adsets"("metaAdsetId") ON DELETE CASCADE,
        CONSTRAINT "FK_meta_ads_creative" FOREIGN KEY ("metaCreativeId") REFERENCES "meta_ad_creatives"("metaCreativeId") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ads_account" ON "meta_ads" ("metaAdAccountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ads_campaign" ON "meta_ads" ("metaCampaignId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ads_adset" ON "meta_ads" ("metaAdsetId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ads_creative" ON "meta_ads" ("metaCreativeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "meta_ads_insights" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "metaAdAccountId" character varying NOT NULL,
        "metaCampaignId" character varying,
        "metaAdsetId" character varying,
        "metaAdId" character varying,
        "level" character varying NOT NULL,
        "dateStart" date NOT NULL,
        "dateStop" date NOT NULL,
        "breakdownKey" character varying,
        "age" character varying,
        "gender" character varying,
        "country" character varying,
        "region" character varying,
        "publisherPlatform" character varying,
        "platformPosition" character varying,
        "devicePlatform" character varying,
        "impressionDevice" character varying,
        "accountCurrency" character varying,
        "spend" numeric,
        "impressions" bigint,
        "reach" bigint,
        "frequency" numeric,
        "clicks" bigint,
        "uniqueClicks" bigint,
        "inlineLinkClicks" bigint,
        "uniqueInlineLinkClicks" bigint,
        "outboundClicks" bigint,
        "cpc" numeric,
        "cpm" numeric,
        "cpp" numeric,
        "ctr" numeric,
        "actions" jsonb,
        "actionValues" jsonb,
        "conversions" jsonb,
        "costPerActionType" jsonb,
        "costPerConversion" jsonb,
        "raw" jsonb NOT NULL,
        "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_ads_insights" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meta_ads_insights_account" FOREIGN KEY ("metaAdAccountId") REFERENCES "meta_ad_accounts"("metaAdAccountId") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ads_insights_account_date" ON "meta_ads_insights" ("metaAdAccountId", "dateStart")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meta_ads_insights_ad_date" ON "meta_ads_insights" ("metaAdId", "dateStart")`,
    );
    await queryRunner.query(`
      CREATE TABLE "meta_sync_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source" character varying NOT NULL,
        "syncType" character varying NOT NULL,
        "metaAdAccountId" character varying,
        "status" character varying NOT NULL,
        "dateFrom" date,
        "dateTo" date,
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "fetchedCount" integer NOT NULL DEFAULT 0,
        "createdCount" integer NOT NULL DEFAULT 0,
        "updatedCount" integer NOT NULL DEFAULT 0,
        "errorMessage" text,
        "raw" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_sync_runs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "meta_sync_runs"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ads_insights_ad_date"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ads_insights_account_date"`);
    await queryRunner.query(`DROP TABLE "meta_ads_insights"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ads_creative"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ads_adset"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ads_campaign"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ads_account"`);
    await queryRunner.query(`DROP TABLE "meta_ads"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_ad_creatives_account"`);
    await queryRunner.query(`DROP TABLE "meta_ad_creatives"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_adsets_campaign"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_adsets_account"`);
    await queryRunner.query(`DROP TABLE "meta_adsets"`);
    await queryRunner.query(`DROP INDEX "IDX_meta_campaigns_account"`);
    await queryRunner.query(`DROP TABLE "meta_campaigns"`);
    await queryRunner.query(`DROP TABLE "meta_ad_accounts"`);
  }
}
