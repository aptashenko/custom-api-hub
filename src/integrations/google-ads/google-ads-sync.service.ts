import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { GoogleAdsAd } from '../../typeorm/entities/google-ads-ad.entity';
import { GoogleAdsAdGroup } from '../../typeorm/entities/google-ads-ad-group.entity';
import { GoogleAdsCampaign } from '../../typeorm/entities/google-ads-campaign.entity';
import { GoogleAdsClick } from '../../typeorm/entities/google-ads-click.entity';
import { GoogleAdsInsight } from '../../typeorm/entities/google-ads-insight.entity';
import { GoogleAdsSyncRun } from '../../typeorm/entities/google-ads-sync-run.entity';
import { SyncGoogleAdsDateRangeDto } from './dto/sync-google-ads.dto';
import { GoogleAdsApiService } from './google-ads-api.service';

export interface DictionarySyncSummary {
  campaigns: number;
  adGroups: number;
  ads: number;
}

@Injectable()
export class GoogleAdsSyncService {
  private readonly logger = new Logger(GoogleAdsSyncService.name);

  constructor(
    private readonly googleAdsApiService: GoogleAdsApiService,
    @InjectRepository(GoogleAdsCampaign)
    private readonly campaignsRepository: Repository<GoogleAdsCampaign>,
    @InjectRepository(GoogleAdsAdGroup)
    private readonly adGroupsRepository: Repository<GoogleAdsAdGroup>,
    @InjectRepository(GoogleAdsAd)
    private readonly adsRepository: Repository<GoogleAdsAd>,
    @InjectRepository(GoogleAdsClick)
    private readonly clicksRepository: Repository<GoogleAdsClick>,
    @InjectRepository(GoogleAdsInsight)
    private readonly insightsRepository: Repository<GoogleAdsInsight>,
    @InjectRepository(GoogleAdsSyncRun)
    private readonly syncRunsRepository: Repository<GoogleAdsSyncRun>,
  ) {}

  async syncDictionaries(customerIds = this.getConfiguredCustomerIds()) {
    const syncRun = await this.startSyncRun('dictionaries', { customerIds });
    const summary: DictionarySyncSummary = {
      campaigns: 0,
      adGroups: 0,
      ads: 0,
    };

    try {
      for (const customerId of customerIds) {
        summary.campaigns += await this.syncCampaigns(customerId);
        summary.adGroups += await this.syncAdGroups(customerId);
        summary.ads += await this.syncAds(customerId);
      }

      await this.finishSyncRun(syncRun, 'success', {
        metadata: {
          rowsFetched: summary.campaigns + summary.adGroups + summary.ads,
          raw: summary,
        },
      });

      return summary;
    } catch (error) {
      await this.finishSyncRun(syncRun, 'failed', {
        error: this.errorMessage(error),
        metadata: { raw: summary },
      });
      throw error;
    }
  }

  async syncClicks(options: SyncGoogleAdsDateRangeDto = {}) {
    const customerIds = this.resolveCustomerIds(options.customerIds);
    const dateFrom = options.dateFrom ?? this.daysAgoIsoDate(30);
    const dateTo = options.dateTo ?? this.yesterdayIsoDate();
    const syncRun = await this.startSyncRun('clicks', {
      customerIds,
      dateFrom,
      dateTo,
    });
    let rows = 0;

    try {
      for (const customerId of customerIds) {
        const entities: GoogleAdsClick[] = [];

        for (const date of this.buildDateRange(dateFrom, dateTo)) {
          entities.push(...(await this.fetchClickEntities(customerId, date)));
        }

        const uniqueEntities = this.deduplicateClicks(entities);

        if (uniqueEntities.length > 0) {
          await this.upsertChunked(this.clicksRepository, uniqueEntities, [
            'googleCustomerId',
            'date',
            'gclid',
          ]);
        }

        rows += uniqueEntities.length;
        this.logger.log(
          `Synced Google Ads clicks customer=${customerId} rows=${uniqueEntities.length} fetchedRows=${entities.length} dateFrom=${dateFrom} dateTo=${dateTo}`,
        );
      }

      await this.finishSyncRun(syncRun, 'success', {
        metadata: { rowsFetched: rows },
      });

      return { rows, dateFrom, dateTo };
    } catch (error) {
      await this.finishSyncRun(syncRun, 'failed', {
        error: this.errorMessage(error),
        metadata: { rowsFetched: rows },
      });
      throw error;
    }
  }

  async syncInsights(options: SyncGoogleAdsDateRangeDto = {}) {
    const customerIds = this.resolveCustomerIds(options.customerIds);
    const dateFrom = options.dateFrom ?? this.daysAgoIsoDate(7);
    const dateTo = options.dateTo ?? this.yesterdayIsoDate();
    const syncRun = await this.startSyncRun('insights', {
      customerIds,
      dateFrom,
      dateTo,
    });
    let rows = 0;

    try {
      for (const customerId of customerIds) {
        const entities = await this.fetchInsightEntities(customerId, dateFrom, dateTo);

        await this.insightsRepository
          .createQueryBuilder()
          .delete()
          .where('"googleCustomerId" = :customerId', { customerId })
          .andWhere('"level" = :level', { level: 'ad' })
          .andWhere('"dateStart" >= :dateFrom', { dateFrom })
          .andWhere('"dateStart" <= :dateTo', { dateTo })
          .execute();

        if (entities.length > 0) {
          await this.insightsRepository.save(entities, { chunk: 500 });
        }

        rows += entities.length;
        this.logger.log(
          `Synced Google Ads insights customer=${customerId} rows=${entities.length} dateFrom=${dateFrom} dateTo=${dateTo}`,
        );
      }

      await this.finishSyncRun(syncRun, 'success', {
        metadata: { rowsFetched: rows },
      });

      return { rows, dateFrom, dateTo };
    } catch (error) {
      await this.finishSyncRun(syncRun, 'failed', {
        error: this.errorMessage(error),
        metadata: { rowsFetched: rows },
      });
      throw error;
    }
  }

  async syncHistory(options: SyncGoogleAdsDateRangeDto = {}) {
    const dateFrom = options.dateFrom ?? this.daysAgoIsoDate(180);
    const dateTo = options.dateTo ?? this.yesterdayIsoDate();
    const [insights, clicks] = await Promise.all([
      this.syncInsights({ ...options, dateFrom, dateTo }),
      this.syncClicks({ ...options, dateFrom, dateTo }),
    ]);

    return {
      dateFrom,
      dateTo,
      insights,
      clicks,
    };
  }

  private async syncCampaigns(customerId: string): Promise<number> {
    const rows = await this.googleAdsApiService.search(
      customerId,
      `
        SELECT
          customer.id,
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.advertising_channel_sub_type,
          campaign.bidding_strategy_type,
          campaign_budget.id,
          campaign_budget.name,
          campaign_budget.amount_micros
        FROM campaign
      `,
    );
    const syncedAt = new Date();
    const entities = rows.map((row) => {
      const customer = this.recordValue(row.customer);
      const campaign = this.recordValue(row.campaign);
      const budget = this.recordValue(row.campaignBudget);

      return this.campaignsRepository.create({
        googleCustomerId: this.stringValue(customer?.id) ?? customerId,
        googleCampaignId: this.stringValue(campaign?.id) ?? '',
        name: this.stringValue(campaign?.name) ?? '',
        status: this.stringValue(campaign?.status),
        advertisingChannelType: this.stringValue(campaign?.advertisingChannelType),
        advertisingChannelSubType: this.stringValue(
          campaign?.advertisingChannelSubType,
        ),
        biddingStrategyType: this.stringValue(campaign?.biddingStrategyType),
        campaignBudgetId: this.stringValue(budget?.id),
        campaignBudgetName: this.stringValue(budget?.name),
        campaignBudgetAmountMicros: this.stringValue(budget?.amountMicros),
        raw: row,
        syncedAt,
      });
    });

    if (entities.length > 0) {
      await this.upsertChunked(this.campaignsRepository, entities, [
        'googleCustomerId',
        'googleCampaignId',
      ]);
    }

    return entities.length;
  }

  private async syncAdGroups(customerId: string): Promise<number> {
    const rows = await this.googleAdsApiService.search(
      customerId,
      `
        SELECT
          customer.id,
          campaign.id,
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.type,
          ad_group.cpc_bid_micros
        FROM ad_group
      `,
    );
    const syncedAt = new Date();
    const entities = rows.map((row) => {
      const customer = this.recordValue(row.customer);
      const campaign = this.recordValue(row.campaign);
      const adGroup = this.recordValue(row.adGroup);

      return this.adGroupsRepository.create({
        googleCustomerId: this.stringValue(customer?.id) ?? customerId,
        googleCampaignId: this.stringValue(campaign?.id) ?? '',
        googleAdGroupId: this.stringValue(adGroup?.id) ?? '',
        name: this.stringValue(adGroup?.name) ?? '',
        status: this.stringValue(adGroup?.status),
        type: this.stringValue(adGroup?.type),
        cpcBidMicros: this.stringValue(adGroup?.cpcBidMicros),
        raw: row,
        syncedAt,
      });
    });

    if (entities.length > 0) {
      await this.upsertChunked(this.adGroupsRepository, entities, [
        'googleCustomerId',
        'googleAdGroupId',
      ]);
    }

    return entities.length;
  }

  private async syncAds(customerId: string): Promise<number> {
    const rows = await this.googleAdsApiService.search(
      customerId,
      `
        SELECT
          customer.id,
          campaign.id,
          ad_group.id,
          ad_group_ad.status,
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.ad.type,
          ad_group_ad.ad.final_urls
        FROM ad_group_ad
      `,
    );
    const syncedAt = new Date();
    const entities = rows.map((row) => {
      const customer = this.recordValue(row.customer);
      const campaign = this.recordValue(row.campaign);
      const adGroup = this.recordValue(row.adGroup);
      const adGroupAd = this.recordValue(row.adGroupAd);
      const ad = this.recordValue(adGroupAd?.ad);

      return this.adsRepository.create({
        googleCustomerId: this.stringValue(customer?.id) ?? customerId,
        googleCampaignId: this.stringValue(campaign?.id) ?? '',
        googleAdGroupId: this.stringValue(adGroup?.id) ?? '',
        googleAdId: this.stringValue(ad?.id) ?? '',
        name: this.stringValue(ad?.name),
        status: this.stringValue(adGroupAd?.status),
        type: this.stringValue(ad?.type),
        finalUrls: ad?.finalUrls ?? null,
        raw: row,
        syncedAt,
      });
    });

    if (entities.length > 0) {
      await this.upsertChunked(this.adsRepository, entities, [
        'googleCustomerId',
        'googleAdId',
      ]);
    }

    return entities.length;
  }

  private async fetchClickEntities(
    customerId: string,
    date: string,
  ): Promise<GoogleAdsClick[]> {
    const rows = await this.googleAdsApiService.search(
      customerId,
      `
        SELECT
          customer.id,
          click_view.gclid,
          click_view.keyword_info.text,
          click_view.keyword_info.match_type,
          click_view.page_number,
          click_view.location_of_presence.city,
          click_view.location_of_presence.country,
          click_view.location_of_presence.region,
          click_view.ad_group_ad,
          segments.date,
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          segments.device,
          segments.ad_network_type,
          segments.slot,
          segments.click_type,
          metrics.clicks
        FROM click_view
        WHERE segments.date = '${date}'
      `,
    );
    const syncedAt = new Date();

    return rows.map((row) => {
      const customer = this.recordValue(row.customer);
      const clickView = this.recordValue(row.clickView);
      const keywordInfo = this.recordValue(clickView?.keywordInfo);
      const locationOfPresence = this.recordValue(clickView?.locationOfPresence);
      const segments = this.recordValue(row.segments);
      const campaign = this.recordValue(row.campaign);
      const adGroup = this.recordValue(row.adGroup);
      const metrics = this.recordValue(row.metrics);

      return this.clicksRepository.create({
        googleCustomerId: this.stringValue(customer?.id) ?? customerId,
        date: this.stringValue(segments?.date) ?? date,
        gclid: this.stringValue(clickView?.gclid),
        googleCampaignId: this.stringValue(campaign?.id),
        campaignName: this.stringValue(campaign?.name),
        googleAdGroupId: this.stringValue(adGroup?.id),
        adGroupName: this.stringValue(adGroup?.name),
        googleAdId: this.parseAdIdFromAdGroupAdResourceName(
          this.stringValue(clickView?.adGroupAd),
        ),
        keywordText: this.stringValue(keywordInfo?.text),
        keywordMatchType: this.stringValue(keywordInfo?.matchType),
        device: this.stringValue(segments?.device),
        adNetworkType: this.stringValue(segments?.adNetworkType),
        slot: this.stringValue(segments?.slot),
        clickType: this.stringValue(segments?.clickType),
        pageNumber: this.stringValue(clickView?.pageNumber),
        locationOfPresenceCity: this.stringValue(locationOfPresence?.city),
        locationOfPresenceCountry: this.stringValue(locationOfPresence?.country),
        locationOfPresenceRegion: this.stringValue(locationOfPresence?.region),
        clicks: this.numberValue(metrics?.clicks) ?? 0,
        raw: row,
        syncedAt,
      });
    });
  }

  private async fetchInsightEntities(
    customerId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<GoogleAdsInsight[]> {
    const rows = await this.googleAdsApiService.search(
      customerId,
      `
        SELECT
          customer.id,
          customer.currency_code,
          segments.date,
          campaign.id,
          ad_group.id,
          ad_group_ad.ad.id,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_cpm,
          metrics.conversions,
          metrics.conversions_value,
          metrics.cost_per_conversion
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      `,
    );
    const syncedAt = new Date();

    return rows.map((row) => {
      const customer = this.recordValue(row.customer);
      const segments = this.recordValue(row.segments);
      const campaign = this.recordValue(row.campaign);
      const adGroup = this.recordValue(row.adGroup);
      const adGroupAd = this.recordValue(row.adGroupAd);
      const ad = this.recordValue(adGroupAd?.ad);
      const metrics = this.recordValue(row.metrics);
      const costMicros = this.stringValue(metrics?.costMicros) ?? '0';
      const averageCpcMicros = this.stringValue(metrics?.averageCpc);
      const costPerConversionMicros = this.stringValue(metrics?.costPerConversion);

      return this.insightsRepository.create({
        googleCustomerId: this.stringValue(customer?.id) ?? customerId,
        googleCampaignId: this.stringValue(campaign?.id),
        googleAdGroupId: this.stringValue(adGroup?.id),
        googleAdId: this.stringValue(ad?.id),
        level: 'ad',
        dateStart: this.stringValue(segments?.date) ?? dateFrom,
        dateStop: this.stringValue(segments?.date) ?? dateTo,
        currencyCode: this.stringValue(customer?.currencyCode),
        impressions: this.stringValue(metrics?.impressions) ?? '0',
        clicks: this.stringValue(metrics?.clicks) ?? '0',
        costMicros,
        cost: this.microsToDecimal(costMicros),
        ctr: this.stringValue(metrics?.ctr),
        averageCpcMicros,
        averageCpc: this.microsToDecimal(averageCpcMicros),
        averageCpm: this.stringValue(metrics?.averageCpm),
        conversions: this.stringValue(metrics?.conversions),
        conversionsValue: this.stringValue(metrics?.conversionsValue),
        costPerConversionMicros,
        costPerConversion: this.microsToDecimal(costPerConversionMicros),
        raw: row,
        syncedAt,
      });
    });
  }

  private async startSyncRun(
    type: string,
    options: {
      customerIds?: string[];
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ): Promise<GoogleAdsSyncRun> {
    return this.syncRunsRepository.save(
      this.syncRunsRepository.create({
        type,
        status: 'started',
        googleCustomerIds: options.customerIds ?? [],
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        startedAt: new Date(),
      }),
    );
  }

  private async finishSyncRun(
    syncRun: GoogleAdsSyncRun,
    status: 'success' | 'failed',
    options: {
      error?: string;
      metadata?: unknown;
    } = {},
  ): Promise<void> {
    await this.syncRunsRepository.save({
      ...syncRun,
      status,
      finishedAt: new Date(),
      error: options.error,
      metadata: options.metadata,
    });
  }

  private getConfiguredCustomerIds(): string[] {
    const customerIds = this.googleAdsApiService.getConfiguredCustomerIds();

    if (customerIds.length === 0) {
      throw new Error('GOOGLE_ADS_CUSTOMER_ID or GOOGLE_ADS_CUSTOMER_IDS is required');
    }

    return customerIds;
  }

  private resolveCustomerIds(customerIds?: string[]): string[] {
    const resolved = customerIds?.length
      ? customerIds.map((value) => value.replaceAll('-', ''))
      : this.getConfiguredCustomerIds();

    if (resolved.length === 0) {
      throw new Error('At least one Google Ads customer ID is required');
    }

    return resolved;
  }

  private async upsertChunked<T extends ObjectLiteral>(
    repository: Repository<T>,
    entities: T[],
    conflictPaths: string[],
  ): Promise<void> {
    for (let index = 0; index < entities.length; index += 500) {
      await repository.upsert(entities.slice(index, index + 500), conflictPaths);
    }
  }

  private deduplicateClicks(entities: GoogleAdsClick[]): GoogleAdsClick[] {
    const byIdentity = new Map<string, GoogleAdsClick>();
    const withoutGclid: GoogleAdsClick[] = [];

    for (const entity of entities) {
      if (!entity.gclid) {
        withoutGclid.push(entity);
        continue;
      }

      const key = [entity.googleCustomerId, entity.date, entity.gclid].join('|');
      const existing = byIdentity.get(key);

      if (!existing) {
        byIdentity.set(key, entity);
        continue;
      }

      existing.clicks += entity.clicks;
      existing.raw = [existing.raw, entity.raw];
    }

    return [...Array.from(byIdentity.values()), ...withoutGclid];
  }

  private recordValue(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private stringValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const stringValue = String(value).trim();

    return stringValue ? stringValue : null;
  }

  private numberValue(value: unknown): number | null {
    const stringValue = this.stringValue(value);

    if (!stringValue) {
      return null;
    }

    const numberValue = Number(stringValue);

    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private microsToDecimal(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return null;
    }

    return String(numberValue / 1_000_000);
  }

  private parseAdIdFromAdGroupAdResourceName(
    resourceName: string | null,
  ): string | null {
    return resourceName?.split('~').pop() ?? null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private yesterdayIsoDate(): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
  }

  private daysAgoIsoDate(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);

    return date.toISOString().slice(0, 10);
  }

  private buildDateRange(dateFrom: string, dateTo: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${dateFrom}T00:00:00.000Z`);
    const end = new Date(`${dateTo}T00:00:00.000Z`);

    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }
}
