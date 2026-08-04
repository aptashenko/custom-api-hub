import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { MetaAd } from '../../typeorm/entities/meta-ad.entity';
import { MetaAdAccount } from '../../typeorm/entities/meta-ad-account.entity';
import { MetaAdCreative } from '../../typeorm/entities/meta-ad-creative.entity';
import { MetaAdset } from '../../typeorm/entities/meta-adset.entity';
import { MetaAdsInsight } from '../../typeorm/entities/meta-ads-insight.entity';
import { MetaCampaign } from '../../typeorm/entities/meta-campaign.entity';
import { MetaSyncRun } from '../../typeorm/entities/meta-sync-run.entity';
import { MetaAdsApiService } from './meta-ads-api.service';

interface SyncSummary {
  accounts: number;
  campaigns: number;
  adsets: number;
  creatives: number;
  ads: number;
}

interface InsightsSyncOptions {
  since?: string;
  until?: string;
  accountIds?: string[];
  breakdowns?: string[];
  chunkDays?: number;
}

@Injectable()
export class MetaAdsSyncService {
  private readonly logger = new Logger(MetaAdsSyncService.name);

  constructor(
    private readonly metaAdsApiService: MetaAdsApiService,
    @InjectRepository(MetaAdAccount)
    private readonly accountsRepository: Repository<MetaAdAccount>,
    @InjectRepository(MetaCampaign)
    private readonly campaignsRepository: Repository<MetaCampaign>,
    @InjectRepository(MetaAdset)
    private readonly adsetsRepository: Repository<MetaAdset>,
    @InjectRepository(MetaAdCreative)
    private readonly creativesRepository: Repository<MetaAdCreative>,
    @InjectRepository(MetaAd)
    private readonly adsRepository: Repository<MetaAd>,
    @InjectRepository(MetaAdsInsight)
    private readonly insightsRepository: Repository<MetaAdsInsight>,
    @InjectRepository(MetaSyncRun)
    private readonly syncRunsRepository: Repository<MetaSyncRun>,
  ) {}

  async syncDictionaries(accountIds = this.metaAdsApiService.getConfiguredAccountIds()) {
    const syncRun = await this.startSyncRun('dictionaries');
    const summary: SyncSummary = {
      accounts: 0,
      campaigns: 0,
      adsets: 0,
      creatives: 0,
      ads: 0,
    };

    try {
      for (const accountId of accountIds) {
        summary.accounts += await this.syncAccount(accountId);
        summary.campaigns += await this.syncCampaigns(accountId);
        summary.adsets += await this.syncAdsets(accountId);
        summary.creatives += await this.syncCreatives(accountId);
        summary.ads += await this.syncAds(accountId);
      }

      await this.finishSyncRun(syncRun, 'success', {
        fetchedCount: Object.values(summary).reduce((sum, count) => sum + count, 0),
        raw: summary,
      });

      return summary;
    } catch (error) {
      await this.finishSyncRun(syncRun, 'failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
        raw: summary,
      });
      throw error;
    }
  }

  async syncInsights(options: InsightsSyncOptions = {}) {
    const accountIds = options.accountIds?.length
      ? options.accountIds
      : this.metaAdsApiService.getConfiguredAccountIds();
    const since = options.since ?? this.daysAgoIsoDate(30);
    const until = options.until ?? this.todayIsoDate();
    const breakdowns = options.breakdowns ?? [];
    const breakdownKey = breakdowns.length > 0 ? breakdowns.join('_') : null;
    const syncRun = await this.startSyncRun('insights', {
      dateFrom: since,
      dateTo: until,
    });
    let count = 0;

    try {
      for (const accountId of accountIds) {
        const rows = await this.metaAdsApiService.list<Record<string, unknown>>(
          `/${accountId}/insights`,
          {
            fields: [
              'date_start',
              'date_stop',
              'account_id',
              'account_currency',
              'campaign_id',
              'adset_id',
              'ad_id',
              'spend',
              'impressions',
              'reach',
              'frequency',
              'clicks',
              'unique_clicks',
              'inline_link_clicks',
              'unique_inline_link_clicks',
              'outbound_clicks',
              'cpc',
              'cpm',
              'cpp',
              'ctr',
              'actions',
              'action_values',
              'conversions',
              'cost_per_action_type',
              'cost_per_conversion',
            ].join(','),
            level: 'ad',
            time_increment: '1',
            time_range: JSON.stringify({ since, until }),
            breakdowns: breakdowns.length > 0 ? breakdowns.join(',') : undefined,
            limit: '500',
          },
        );

        const syncedAt = new Date();
        const entities = rows.map((row) =>
          this.insightsRepository.create({
            metaAdAccountId: accountId,
            metaCampaignId: this.stringValue(row.campaign_id),
            metaAdsetId: this.stringValue(row.adset_id),
            metaAdId: this.stringValue(row.ad_id),
            level: 'ad',
            dateStart: this.stringValue(row.date_start) ?? since,
            dateStop: this.stringValue(row.date_stop) ?? until,
            breakdownKey,
            age: this.stringValue(row.age),
            gender: this.stringValue(row.gender),
            country: this.stringValue(row.country),
            region: this.stringValue(row.region),
            publisherPlatform: this.stringValue(row.publisher_platform),
            platformPosition: this.stringValue(row.platform_position),
            devicePlatform: this.stringValue(row.device_platform),
            impressionDevice: this.stringValue(row.impression_device),
            accountCurrency: this.stringValue(row.account_currency),
            spend: this.stringValue(row.spend),
            impressions: this.stringValue(row.impressions),
            reach: this.stringValue(row.reach),
            frequency: this.stringValue(row.frequency),
            clicks: this.stringValue(row.clicks),
            uniqueClicks: this.stringValue(row.unique_clicks),
            inlineLinkClicks: this.stringValue(row.inline_link_clicks),
            uniqueInlineLinkClicks: this.stringValue(row.unique_inline_link_clicks),
            outboundClicks: this.actionValue(row.outbound_clicks),
            cpc: this.stringValue(row.cpc),
            cpm: this.stringValue(row.cpm),
            cpp: this.stringValue(row.cpp),
            ctr: this.stringValue(row.ctr),
            actions: row.actions ?? null,
            actionValues: row.action_values ?? null,
            conversions: row.conversions ?? null,
            costPerActionType: row.cost_per_action_type ?? null,
            costPerConversion: row.cost_per_conversion ?? null,
            raw: row,
            syncedAt,
          }),
        );

        if (entities.length > 0) {
          await this.insightsRepository
            .createQueryBuilder()
            .delete()
            .where('"metaAdAccountId" = :accountId', { accountId })
            .andWhere('"level" = :level', { level: 'ad' })
            .andWhere('"dateStart" >= :since', { since })
            .andWhere('"dateStart" <= :until', { until })
            .andWhere(
              breakdownKey
                ? '"breakdownKey" = :breakdownKey'
                : '"breakdownKey" IS NULL',
              { breakdownKey },
            )
            .execute();

          await this.insightsRepository.save(entities, { chunk: 500 });
        }

        count += entities.length;
        this.logger.log(
          `Synced Meta insights account=${accountId} rows=${entities.length} since=${since} until=${until}`,
        );
      }

      await this.finishSyncRun(syncRun, 'success', {
        fetchedCount: count,
      });

      return {
        rows: count,
        since,
        until,
        breakdowns,
      };
    } catch (error) {
      await this.finishSyncRun(syncRun, 'failed', {
        fetchedCount: count,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async syncInsightsHistory(options: InsightsSyncOptions = {}) {
    const since = options.since ?? this.monthsAgoIsoDate(37);
    const until = options.until ?? this.todayIsoDate();
    const chunkDays = options.chunkDays && options.chunkDays > 0
      ? options.chunkDays
      : 30;
    const chunks = this.buildDateChunks(since, until, chunkDays);
    let rows = 0;

    for (const chunk of chunks) {
      const result = await this.syncInsights({
        ...options,
        since: chunk.since,
        until: chunk.until,
      });
      rows += result.rows;
    }

    return {
      since,
      until,
      chunkDays,
      chunks: chunks.length,
      rows,
    };
  }

  private async syncAccount(accountId: string): Promise<number> {
    const row = await this.metaAdsApiService.get<Record<string, unknown>>(`/${accountId}`, {
      fields: 'id,account_id,name,account_status,currency,timezone_name,business{name,id}',
    });
    const business = this.recordValue(row.business);

    await this.accountsRepository.upsert(
      this.accountsRepository.create({
        metaAdAccountId: this.stringValue(row.id) ?? accountId,
        accountId: this.stringValue(row.account_id) ?? accountId.replace(/^act_/, ''),
        name: this.stringValue(row.name) ?? accountId,
        accountStatus: this.numberValue(row.account_status),
        currency: this.stringValue(row.currency),
        timezoneName: this.stringValue(row.timezone_name),
        businessId: this.stringValue(business?.id),
        businessName: this.stringValue(business?.name),
        raw: row,
        syncedAt: new Date(),
      }) as any,
      ['metaAdAccountId'],
    );

    return 1;
  }

  private async syncCampaigns(accountId: string): Promise<number> {
    const rows = await this.metaAdsApiService.list<Record<string, unknown>>(
      `/${accountId}/campaigns`,
      {
        fields:
          'id,name,objective,status,effective_status,buying_type,daily_budget,lifetime_budget,budget_remaining,spend_cap,start_time,stop_time,created_time,updated_time',
        limit: '500',
      },
    );
    const syncedAt = new Date();
    const entities = rows.map((row) =>
      this.campaignsRepository.create({
        metaCampaignId: this.stringValue(row.id) ?? '',
        metaAdAccountId: accountId,
        name: this.stringValue(row.name) ?? '',
        objective: this.stringValue(row.objective),
        status: this.stringValue(row.status),
        effectiveStatus: this.stringValue(row.effective_status),
        buyingType: this.stringValue(row.buying_type),
        dailyBudget: this.stringValue(row.daily_budget),
        lifetimeBudget: this.stringValue(row.lifetime_budget),
        budgetRemaining: this.stringValue(row.budget_remaining),
        spendCap: this.stringValue(row.spend_cap),
        startTime: this.dateValue(row.start_time),
        stopTime: this.dateValue(row.stop_time),
        createdTime: this.dateValue(row.created_time),
        updatedTime: this.dateValue(row.updated_time),
        raw: row,
        syncedAt,
      }),
    );

    if (entities.length > 0) {
      await this.upsertChunked(this.campaignsRepository, entities, ['metaCampaignId']);
    }

    return entities.length;
  }

  private async syncAdsets(accountId: string): Promise<number> {
    const rows = await this.listWithFallback(
      accountId,
      `/${accountId}/adsets`,
      'adsets',
      'id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,budget_remaining,targeting,promoted_object,attribution_spec,start_time,end_time,created_time,updated_time',
      'id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,budget_remaining,start_time,end_time,created_time,updated_time',
    );
    const syncedAt = new Date();
    const entities = rows.map((row) =>
      this.adsetsRepository.create({
        metaAdsetId: this.stringValue(row.id) ?? '',
        metaAdAccountId: accountId,
        metaCampaignId: this.stringValue(row.campaign_id) ?? '',
        name: this.stringValue(row.name) ?? '',
        status: this.stringValue(row.status),
        effectiveStatus: this.stringValue(row.effective_status),
        optimizationGoal: this.stringValue(row.optimization_goal),
        billingEvent: this.stringValue(row.billing_event),
        bidStrategy: this.stringValue(row.bid_strategy),
        dailyBudget: this.stringValue(row.daily_budget),
        lifetimeBudget: this.stringValue(row.lifetime_budget),
        budgetRemaining: this.stringValue(row.budget_remaining),
        targeting: row.targeting ?? null,
        promotedObject: row.promoted_object ?? null,
        attributionSpec: row.attribution_spec ?? null,
        startTime: this.dateValue(row.start_time),
        endTime: this.dateValue(row.end_time),
        createdTime: this.dateValue(row.created_time),
        updatedTime: this.dateValue(row.updated_time),
        raw: row,
        syncedAt,
      }),
    );

    if (entities.length > 0) {
      await this.upsertChunked(this.adsetsRepository, entities, ['metaAdsetId']);
    }

    return entities.length;
  }

  private async syncCreatives(accountId: string): Promise<number> {
    const rows = await this.listWithFallback(
      accountId,
      `/${accountId}/adcreatives`,
      'adcreatives',
      'id,name,title,body,object_type,status,image_hash,thumbnail_url,video_id,instagram_user_id,instagram_permalink_url,call_to_action_type,call_to_action',
      'id,name,object_type,status',
    );
    const syncedAt = new Date();
    const entities = rows.map((row) => {
      const callToAction = this.recordValue(row.call_to_action);
      const callToActionValue = this.recordValue(callToAction?.value);

      return this.creativesRepository.create({
        metaCreativeId: this.stringValue(row.id) ?? '',
        metaAdAccountId: accountId,
        name: this.stringValue(row.name),
        title: this.stringValue(row.title),
        body: this.stringValue(row.body),
        objectType: this.stringValue(row.object_type),
        status: this.stringValue(row.status),
        imageHash: this.stringValue(row.image_hash),
        imageUrl: this.stringValue(row.image_url),
        thumbnailUrl: this.stringValue(row.thumbnail_url),
        videoId: this.stringValue(row.video_id),
        instagramUserId: this.stringValue(row.instagram_user_id),
        instagramPermalinkUrl: this.stringValue(row.instagram_permalink_url),
        callToActionType: this.stringValue(row.call_to_action_type),
        leadGenFormId: this.stringValue(callToActionValue?.lead_gen_form_id),
        objectStorySpec: row.object_story_spec ?? null,
        assetFeedSpec: row.asset_feed_spec ?? null,
        callToAction: row.call_to_action ?? null,
        raw: row,
        syncedAt,
      });
    });

    if (entities.length > 0) {
      await this.upsertChunked(this.creativesRepository, entities, [
        'metaCreativeId',
      ]);
    }

    return entities.length;
  }

  private async syncAds(accountId: string): Promise<number> {
    const rows = await this.metaAdsApiService.list<Record<string, unknown>>(
      `/${accountId}/ads`,
      {
        fields:
          'id,name,campaign_id,adset_id,creative{id,name},status,effective_status,conversion_domain,tracking_specs,created_time,updated_time',
        limit: '500',
      },
    );
    const syncedAt = new Date();
    const entities = rows.map((row) => {
      const creative = this.recordValue(row.creative);

      return this.adsRepository.create({
        metaAdId: this.stringValue(row.id) ?? '',
        metaAdAccountId: accountId,
        metaCampaignId: this.stringValue(row.campaign_id) ?? '',
        metaAdsetId: this.stringValue(row.adset_id) ?? '',
        metaCreativeId: this.stringValue(creative?.id),
        name: this.stringValue(row.name) ?? '',
        status: this.stringValue(row.status),
        effectiveStatus: this.stringValue(row.effective_status),
        conversionDomain: this.stringValue(row.conversion_domain),
        trackingSpecs: row.tracking_specs ?? null,
        createdTime: this.dateValue(row.created_time),
        updatedTime: this.dateValue(row.updated_time),
        raw: row,
        syncedAt,
      });
    });

    if (entities.length > 0) {
      await this.upsertChunked(this.adsRepository, entities, ['metaAdId']);
    }

    return entities.length;
  }

  private async listWithFallback(
    accountId: string,
    path: string,
    objectName: string,
    fields: string,
    fallbackFields: string,
  ): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.metaAdsApiService.list<Record<string, unknown>>(path, {
        fields,
        limit: '50',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('reduce the amount of data')) {
        throw error;
      }

      this.logger.warn(
        `Retrying Meta ${objectName} sync with fallback fields account=${accountId}`,
      );

      return this.metaAdsApiService.list<Record<string, unknown>>(path, {
        fields: fallbackFields,
        limit: '50',
      });
    }
  }

  private async upsertChunked<T extends ObjectLiteral>(
    repository: Repository<T>,
    entities: T[],
    conflictPaths: string[],
  ): Promise<void> {
    const chunkSize = 100;

    for (let index = 0; index < entities.length; index += chunkSize) {
      await repository.upsert(
        entities.slice(index, index + chunkSize) as any,
        conflictPaths,
      );
    }
  }

  private async startSyncRun(
    syncType: string,
    values: Partial<MetaSyncRun> = {},
  ): Promise<MetaSyncRun> {
    return this.syncRunsRepository.save(
      this.syncRunsRepository.create({
        source: 'meta_ads',
        syncType,
        status: 'running',
        startedAt: new Date(),
        fetchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        ...values,
      }),
    );
  }

  private async finishSyncRun(
    syncRun: MetaSyncRun,
    status: string,
    values: Partial<MetaSyncRun> = {},
  ): Promise<void> {
    await this.syncRunsRepository.update(syncRun.id, {
      status,
      finishedAt: new Date(),
      ...values,
    } as any);
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private numberValue(value: unknown): number | null {
    return typeof value === 'number' ? value : null;
  }

  private dateValue(value: unknown): Date | null {
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }

    return new Date(value);
  }

  private recordValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private actionValue(value: unknown): string | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const first = this.recordValue(value[0]);

    return this.stringValue(first?.value);
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private daysAgoIsoDate(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);

    return date.toISOString().slice(0, 10);
  }

  private monthsAgoIsoDate(months: number): string {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - months);

    return date.toISOString().slice(0, 10);
  }

  private buildDateChunks(
    since: string,
    until: string,
    chunkDays: number,
  ): Array<{ since: string; until: string }> {
    const chunks: Array<{ since: string; until: string }> = [];
    const endDate = new Date(`${until}T00:00:00.000Z`);
    let cursor = new Date(`${since}T00:00:00.000Z`);

    while (cursor <= endDate) {
      const chunkStart = new Date(cursor);
      const chunkEnd = new Date(cursor);
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);

      if (chunkEnd > endDate) {
        chunkEnd.setTime(endDate.getTime());
      }

      chunks.push({
        since: chunkStart.toISOString().slice(0, 10),
        until: chunkEnd.toISOString().slice(0, 10),
      });

      cursor = new Date(chunkEnd);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return chunks;
  }
}
