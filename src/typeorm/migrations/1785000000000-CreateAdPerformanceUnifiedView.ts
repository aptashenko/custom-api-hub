import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdPerformanceUnifiedView1785000000000
  implements MigrationInterface
{
  name = 'CreateAdPerformanceUnifiedView1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.ad_performance_unified AS
      SELECT
        'META'::text AS platform,
        i."dateStart" AS date_start,
        i."dateStop" AS date_stop,
        i.level AS level,
        i."metaAdAccountId" AS account_id,
        account.name AS account_name,
        COALESCE(i."accountCurrency", account.currency) AS currency,
        i."metaCampaignId" AS campaign_id,
        campaign.name AS campaign_name,
        campaign.status AS campaign_status,
        campaign."effectiveStatus" AS campaign_effective_status,
        campaign.objective AS campaign_objective,
        i."metaAdsetId" AS adset_or_adgroup_id,
        adset.name AS adset_or_adgroup_name,
        adset.status AS adset_or_adgroup_status,
        adset."effectiveStatus" AS adset_or_adgroup_effective_status,
        adset."optimizationGoal" AS adset_or_adgroup_type,
        i."metaAdId" AS ad_id,
        ad.name AS ad_name,
        ad.status AS ad_status,
        ad."effectiveStatus" AS ad_effective_status,
        ad."metaCreativeId" AS creative_id,
        creative.name AS creative_name,
        creative.title AS creative_title,
        creative.body AS creative_body,
        creative."objectType" AS creative_type,
        creative.status AS creative_status,
        creative."imageUrl" AS creative_image_url,
        creative."thumbnailUrl" AS creative_thumbnail_url,
        creative."videoId" AS creative_video_id,
        creative."instagramPermalinkUrl" AS creative_url,
        COALESCE(
          creative."callToActionType",
          creative."callToAction"->>'type'
        ) AS creative_cta,
        i."breakdownKey" AS breakdown_key,
        i.age AS age,
        i.gender AS gender,
        i.country AS country,
        i.region AS region,
        i."publisherPlatform" AS publisher_platform,
        i."platformPosition" AS platform_position,
        i."devicePlatform" AS device_platform,
        i."impressionDevice" AS impression_device,
        i.spend::numeric AS spend,
        i.impressions::bigint AS impressions,
        i.reach::bigint AS reach,
        i.clicks::bigint AS clicks,
        i."uniqueClicks"::bigint AS unique_clicks,
        i."inlineLinkClicks"::bigint AS link_clicks,
        i.cpc::numeric AS cpc,
        i.cpm::numeric AS cpm,
        i.ctr::numeric AS ctr,
        NULL::numeric AS conversions,
        NULL::numeric AS conversion_value,
        NULL::numeric AS cost_per_conversion,
        i."syncedAt" AS synced_at
      FROM public.meta_ads_insights i
      LEFT JOIN public.meta_ad_accounts account
        ON account."metaAdAccountId" = i."metaAdAccountId"
      LEFT JOIN public.meta_campaigns campaign
        ON campaign."metaCampaignId" = i."metaCampaignId"
      LEFT JOIN public.meta_adsets adset
        ON adset."metaAdsetId" = i."metaAdsetId"
      LEFT JOIN public.meta_ads ad
        ON ad."metaAdId" = i."metaAdId"
      LEFT JOIN public.meta_ad_creatives creative
        ON creative."metaCreativeId" = ad."metaCreativeId"

      UNION ALL

      SELECT
        'GOOGLE'::text AS platform,
        i."dateStart" AS date_start,
        i."dateStop" AS date_stop,
        i.level AS level,
        i."googleCustomerId" AS account_id,
        NULL::text AS account_name,
        i."currencyCode" AS currency,
        i."googleCampaignId" AS campaign_id,
        campaign.name AS campaign_name,
        campaign.status AS campaign_status,
        NULL::text AS campaign_effective_status,
        campaign."advertisingChannelType" AS campaign_objective,
        i."googleAdGroupId" AS adset_or_adgroup_id,
        ad_group.name AS adset_or_adgroup_name,
        ad_group.status AS adset_or_adgroup_status,
        NULL::text AS adset_or_adgroup_effective_status,
        ad_group.type AS adset_or_adgroup_type,
        i."googleAdId" AS ad_id,
        ad.name AS ad_name,
        ad.status AS ad_status,
        NULL::text AS ad_effective_status,
        i."googleAdId" AS creative_id,
        ad.name AS creative_name,
        NULL::text AS creative_title,
        NULL::text AS creative_body,
        ad.type AS creative_type,
        ad.status AS creative_status,
        NULL::text AS creative_image_url,
        NULL::text AS creative_thumbnail_url,
        NULL::text AS creative_video_id,
        ad."finalUrls"::text AS creative_url,
        NULL::text AS creative_cta,
        NULL::text AS breakdown_key,
        NULL::text AS age,
        NULL::text AS gender,
        NULL::text AS country,
        NULL::text AS region,
        NULL::text AS publisher_platform,
        NULL::text AS platform_position,
        NULL::text AS device_platform,
        NULL::text AS impression_device,
        i.cost::numeric AS spend,
        i.impressions::bigint AS impressions,
        NULL::bigint AS reach,
        i.clicks::bigint AS clicks,
        NULL::bigint AS unique_clicks,
        i.clicks::bigint AS link_clicks,
        i."averageCpc"::numeric AS cpc,
        i."averageCpm"::numeric AS cpm,
        i.ctr::numeric AS ctr,
        i.conversions::numeric AS conversions,
        i."conversionsValue"::numeric AS conversion_value,
        i."costPerConversion"::numeric AS cost_per_conversion,
        i."syncedAt" AS synced_at
      FROM public.google_ads_insights i
      LEFT JOIN public.google_ads_campaigns campaign
        ON campaign."googleCustomerId" = i."googleCustomerId"
       AND campaign."googleCampaignId" = i."googleCampaignId"
      LEFT JOIN public.google_ads_ad_groups ad_group
        ON ad_group."googleCustomerId" = i."googleCustomerId"
       AND ad_group."googleAdGroupId" = i."googleAdGroupId"
      LEFT JOIN public.google_ads_ads ad
        ON ad."googleCustomerId" = i."googleCustomerId"
       AND ad."googleAdId" = i."googleAdId"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_readonly') THEN
          GRANT SELECT ON public.ad_performance_unified TO looker_readonly;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS public.ad_performance_unified`);
  }
}
