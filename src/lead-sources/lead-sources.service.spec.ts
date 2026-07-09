import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { Channel } from '../typeorm/entities/enums';
import { LeadSourcesService } from './lead-sources.service';

describe('LeadSourcesService', () => {
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
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
      create: jest.fn((input) => input),
      save: jest.fn((input) =>
        Promise.resolve({ id: 'lead-source-id', ...input }),
      ),
    };
    service = new LeadSourcesService(repository as never);
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
      utmCampaign: undefined,
      utmContent: undefined,
      utmTerm: undefined,
    });
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
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
