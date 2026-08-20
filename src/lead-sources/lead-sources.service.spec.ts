import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { Channel } from '../typeorm/entities/enums';
import { LeadSourcesService } from './lead-sources.service';

describe('LeadSourcesService', () => {
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let googleAdsClicksRepository: {
    findOne: jest.Mock;
  };
  let service: LeadSourcesService;

  const client = {
    id: 'client-id',
  } as Client;

  const baseEvent: NormalizedEvent = {
    source: 'sendpulse',
    channel: Channel.SENDPULSE,
    eventType: 'message_received',
    client: {},
    raw: {},
  };

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn((input) =>
        Promise.resolve({ id: 'lead-source-id', ...input }),
      ),
    };
    googleAdsClicksRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    service = new LeadSourcesService(
      repository as never,
      googleAdsClicksRepository as never,
    );
  });

  it('saves UTM source', async () => {
    const result = await service.createFromEvent({
      client,
      event: {
        ...baseEvent,
        utm: {
          source: 'google',
          medium: 'cpc',
        },
      },
    });

    expect(result?.id).toBe('lead-source-id');
    expect(repository.create).toHaveBeenCalledWith({
      clientId: 'client-id',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      landingPage: null,
      referrer: null,
      gclid: null,
      gbraid: null,
      wbraid: null,
      googleCustomerId: null,
      googleCampaignId: null,
      googleAdGroupId: null,
      googleAdId: null,
      googleKeyword: null,
      googleMatchType: null,
      googleDevice: null,
    });
  });

  it('enriches Google UTM data from click by gclid', async () => {
    googleAdsClicksRepository.findOne.mockResolvedValue({
      googleCustomerId: '3099649891',
      googleCampaignId: '22771338959',
      googleAdGroupId: '182906412675',
      googleAdId: '799871340424',
      keywordText: 'купить квартиру бенидорм',
      keywordMatchType: 'PHRASE',
      device: 'DESKTOP',
    });

    await service.createFromEvent({
      client,
      event: {
        ...baseEvent,
        utm: {
          source: 'google',
          medium: 'cpc',
          campaign: '22771338959',
          content: '799871340424',
          gclid: 'gclid-1',
        },
      },
    });

    expect(googleAdsClicksRepository.findOne).toHaveBeenCalledWith({
      where: { gclid: 'gclid-1' },
      order: { date: 'DESC' },
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gclid: 'gclid-1',
        googleCustomerId: '3099649891',
        googleCampaignId: '22771338959',
        googleAdGroupId: '182906412675',
        googleAdId: '799871340424',
        googleKeyword: 'купить квартиру бенидорм',
        googleMatchType: 'PHRASE',
        googleDevice: 'DESKTOP',
      }),
    );
  });

  it('returns existing lead source for duplicate UTM data', async () => {
    repository.findOne.mockResolvedValue({
      id: 'existing-lead-source-id',
      clientId: 'client-id',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
    });

    const result = await service.createFromEvent({
      client,
      event: {
        ...baseEvent,
        utm: {
          source: ' google ',
          medium: 'cpc',
        },
      },
    });

    expect(result?.id).toBe('existing-lead-source-id');
    expect(repository.findOne).toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not create lead source when UTM is empty', async () => {
    const result = await service.createFromEvent({
      client,
      event: {
        ...baseEvent,
        utm: {},
      },
    });

    expect(result).toBeNull();
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
