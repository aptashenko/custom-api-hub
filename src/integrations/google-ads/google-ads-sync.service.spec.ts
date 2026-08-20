import { GoogleAdsSyncService } from './google-ads-sync.service';

describe('GoogleAdsSyncService', () => {
  let googleAdsApiService: {
    getConfiguredCustomerIds: jest.Mock;
    search: jest.Mock;
  };
  let campaignsRepository: ReturnType<typeof createRepository>;
  let adGroupsRepository: ReturnType<typeof createRepository>;
  let adsRepository: ReturnType<typeof createRepository>;
  let clicksRepository: ReturnType<typeof createRepository>;
  let insightsRepository: ReturnType<typeof createInsightsRepository>;
  let syncRunsRepository: ReturnType<typeof createRepository>;
  let service: GoogleAdsSyncService;

  beforeEach(() => {
    googleAdsApiService = {
      getConfiguredCustomerIds: jest.fn().mockReturnValue(['3099649891']),
      search: jest.fn(),
    };
    campaignsRepository = createRepository();
    adGroupsRepository = createRepository();
    adsRepository = createRepository();
    clicksRepository = createRepository();
    insightsRepository = createInsightsRepository();
    syncRunsRepository = createRepository();
    syncRunsRepository.save.mockImplementation(async (input) => ({
      id: input.id ?? 'sync-run-id',
      ...input,
    }));

    service = new GoogleAdsSyncService(
      googleAdsApiService as never,
      campaignsRepository as never,
      adGroupsRepository as never,
      adsRepository as never,
      clicksRepository as never,
      insightsRepository as never,
      syncRunsRepository as never,
    );
  });

  it('syncs Google Ads dictionaries into campaign, ad group, and ad tables', async () => {
    googleAdsApiService.search
      .mockResolvedValueOnce([
        {
          customer: { id: '3099649891' },
          campaign: {
            id: '22771338959',
            name: 'Search Campaign',
            status: 'ENABLED',
            advertisingChannelType: 'SEARCH',
          },
          campaignBudget: {
            id: 'budget-1',
            name: 'Main budget',
            amountMicros: '1000000',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          customer: { id: '3099649891' },
          campaign: { id: '22771338959' },
          adGroup: {
            id: '182906412675',
            name: 'Apartment',
            status: 'ENABLED',
            type: 'SEARCH_STANDARD',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          customer: { id: '3099649891' },
          campaign: { id: '22771338959' },
          adGroup: { id: '182906412675' },
          adGroupAd: {
            status: 'ENABLED',
            ad: {
              id: '799871340424',
              type: 'RESPONSIVE_SEARCH_AD',
              finalUrls: ['https://deniz-benidorm.adsquiz.io'],
            },
          },
        },
      ]);

    await expect(service.syncDictionaries()).resolves.toEqual({
      campaigns: 1,
      adGroups: 1,
      ads: 1,
    });
    expect(campaignsRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          googleCustomerId: '3099649891',
          googleCampaignId: '22771338959',
          campaignBudgetAmountMicros: '1000000',
        }),
      ],
      ['googleCustomerId', 'googleCampaignId'],
    );
    expect(adGroupsRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          googleCampaignId: '22771338959',
          googleAdGroupId: '182906412675',
        }),
      ],
      ['googleCustomerId', 'googleAdGroupId'],
    );
    expect(adsRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          googleAdId: '799871340424',
          finalUrls: ['https://deniz-benidorm.adsquiz.io'],
        }),
      ],
      ['googleCustomerId', 'googleAdId'],
    );
  });

  it('syncs click rows and parses ad id from click_view ad group ad resource', async () => {
    googleAdsApiService.search.mockResolvedValue([
      {
        customer: { id: '3099649891' },
        clickView: {
          gclid: 'gclid-1',
          adGroupAd:
            'customers/3099649891/adGroupAds/182906412675~799871340424',
          keywordInfo: {
            text: 'купить квартиру бенидорм',
            matchType: 'PHRASE',
          },
          pageNumber: '1',
          locationOfPresence: {
            city: 'geoTargetConstants/1005545',
            country: 'geoTargetConstants/2724',
            region: 'geoTargetConstants/9197458',
          },
        },
        segments: {
          date: '2026-08-18',
          device: 'DESKTOP',
          adNetworkType: 'SEARCH',
          slot: 'SEARCH_TOP',
          clickType: 'URL_CLICKS',
        },
        campaign: { id: '22771338959', name: 'Search Campaign' },
        adGroup: { id: '182906412675', name: 'Apartment' },
        metrics: { clicks: '1' },
      },
    ]);

    await expect(
      service.syncClicks({
        dateFrom: '2026-08-18',
        dateTo: '2026-08-18',
      }),
    ).resolves.toEqual({
      rows: 1,
      dateFrom: '2026-08-18',
      dateTo: '2026-08-18',
    });
    expect(clicksRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          gclid: 'gclid-1',
          googleAdId: '799871340424',
          keywordText: 'купить квартиру бенидорм',
          keywordMatchType: 'PHRASE',
          locationOfPresenceCity: 'geoTargetConstants/1005545',
        }),
      ],
      ['googleCustomerId', 'date', 'gclid'],
    );
  });

  it('deduplicates click rows by customer, date, and gclid before upsert', async () => {
    googleAdsApiService.search.mockResolvedValue([
      buildClickRow({ gclid: 'gclid-1', clicks: '1' }),
      buildClickRow({ gclid: 'gclid-1', clicks: '2' }),
    ]);

    await service.syncClicks({
      dateFrom: '2026-08-18',
      dateTo: '2026-08-18',
    });

    expect(clicksRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          gclid: 'gclid-1',
          clicks: 3,
          raw: [expect.any(Object), expect.any(Object)],
        }),
      ],
      ['googleCustomerId', 'date', 'gclid'],
    );
  });

  it('does not deduplicate click rows without gclid', async () => {
    googleAdsApiService.search.mockResolvedValue([
      buildClickRow({ gclid: null, clicks: '1' }),
      buildClickRow({ gclid: null, clicks: '1' }),
    ]);

    await service.syncClicks({
      dateFrom: '2026-08-18',
      dateTo: '2026-08-18',
    });

    expect(clicksRepository.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({ gclid: null, clicks: 1 }),
        expect.objectContaining({ gclid: null, clicks: 1 }),
      ],
      ['googleCustomerId', 'date', 'gclid'],
    );
  });

  it('replaces insight rows for the requested range', async () => {
    googleAdsApiService.search.mockResolvedValue([
      {
        customer: { id: '3099649891', currencyCode: 'EUR' },
        segments: { date: '2026-08-18' },
        campaign: { id: '22771338959' },
        adGroup: { id: '182906412675' },
        adGroupAd: { ad: { id: '799871340424' } },
        metrics: {
          impressions: '18',
          clicks: '2',
          costMicros: '1953940',
          ctr: '0.1111111111111111',
          averageCpc: '976970',
          averageCpm: '108552222.22222222',
          conversions: '1',
          conversionsValue: '100',
          costPerConversion: '1953940',
        },
      },
    ]);

    await service.syncInsights({
      dateFrom: '2026-08-18',
      dateTo: '2026-08-18',
    });

    expect(insightsRepository.deleteQuery.execute).toHaveBeenCalled();
    expect(insightsRepository.save).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          googleCustomerId: '3099649891',
          googleAdId: '799871340424',
          costMicros: '1953940',
          cost: '1.95394',
          averageCpc: '0.97697',
          costPerConversion: '1.95394',
        }),
      ],
      { chunk: 500 },
    );
  });
});

function createRepository() {
  return {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
    upsert: jest.fn(async () => undefined),
  };
}

function buildClickRow(params: { gclid: string | null; clicks: string }) {
  return {
    customer: { id: '3099649891' },
    clickView: {
      gclid: params.gclid,
      adGroupAd: 'customers/3099649891/adGroupAds/182906412675~799871340424',
    },
    segments: {
      date: '2026-08-18',
      device: 'DESKTOP',
    },
    campaign: { id: '22771338959' },
    adGroup: { id: '182906412675' },
    metrics: { clicks: params.clicks },
  };
}

function createInsightsRepository() {
  const repository = {
    ...createRepository(),
    deleteQuery: {
      delete: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: jest.fn(async () => undefined),
    },
    createQueryBuilder: jest.fn(),
  };

  repository.deleteQuery.delete.mockReturnValue(repository.deleteQuery);
  repository.deleteQuery.where.mockReturnValue(repository.deleteQuery);
  repository.deleteQuery.andWhere.mockReturnValue(repository.deleteQuery);
  repository.createQueryBuilder.mockReturnValue(repository.deleteQuery);

  return repository;
}
