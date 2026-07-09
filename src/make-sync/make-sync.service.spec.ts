import { AggregationService } from '../aggregation/aggregation.service';
import { MakeService } from '../integrations/make/make.service';
import { Channel, MakeSyncStatus } from '../typeorm/entities/enums';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { MakeSyncService } from './make-sync.service';

describe('MakeSyncService', () => {
  let repository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let aggregationService: jest.Mocked<
    Pick<AggregationService, 'buildPendingPayload'>
  >;
  let makeService: jest.Mocked<Pick<MakeService, 'sendPayload'>>;
  let service: MakeSyncService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-03T12:00:00.000Z'));

    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((input) => Promise.resolve(input)),
    };
    aggregationService = {
      buildPendingPayload: jest.fn().mockResolvedValue({
        client: {
          id: 'client-id',
        },
        channel: Channel.TELEGRAM,
        messages: [],
        lastMessageAt: null,
      }),
    };
    makeService = {
      sendPayload: jest.fn().mockResolvedValue(undefined),
    };
    service = new MakeSyncService(
      repository as never,
      aggregationService as never,
      makeService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores events whose debounceUntil is in the future', async () => {
    repository.find.mockResolvedValue([
      makeSyncEvent({
        payload: {
          clientId: 'client-id',
          channel: Channel.TELEGRAM,
          debounceUntil: '2026-07-03T12:01:00.000Z',
        },
      }),
    ]);

    await expect(service.processPending()).resolves.toEqual({
      processed: 0,
      sent: 0,
      failed: 0,
    });
    expect(makeService.sendPayload).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('sends due pending event', async () => {
    const event = makeSyncEvent();

    repository.find.mockResolvedValue([event]);

    await expect(service.processPending()).resolves.toEqual({
      processed: 1,
      sent: 1,
      failed: 0,
    });
    expect(aggregationService.buildPendingPayload).toHaveBeenCalledWith({
      clientId: 'client-id',
      channel: Channel.TELEGRAM,
      messageIds: ['message-1'],
    });
    expect(makeService.sendPayload).toHaveBeenCalledWith({
      client: {
        id: 'client-id',
      },
      channel: Channel.TELEGRAM,
      messages: [],
      lastMessageAt: null,
    });
  });

  it('marks sent on success', async () => {
    const event = makeSyncEvent();

    repository.find.mockResolvedValue([event]);

    await service.processPending();

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'make-sync-event-id',
        status: MakeSyncStatus.SENT,
        sentAt: new Date('2026-07-03T12:00:00.000Z'),
        error: null,
        payload: {
          client: {
            id: 'client-id',
          },
          channel: Channel.TELEGRAM,
          messages: [],
          lastMessageAt: null,
        },
      }),
    );
  });

  it('marks failed on error', async () => {
    const event = makeSyncEvent();

    repository.find.mockResolvedValue([event]);
    makeService.sendPayload.mockRejectedValue(new Error('Make is unavailable'));

    await expect(service.processPending()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'make-sync-event-id',
        status: MakeSyncStatus.FAILED,
        error: 'Make is unavailable',
      }),
    );
  });

  function makeSyncEvent(
    overrides: Partial<MakeSyncEvent> = {},
  ): MakeSyncEvent {
    return {
      id: 'make-sync-event-id',
      clientId: 'client-id',
      status: MakeSyncStatus.PENDING,
      sentAt: null,
      payload: {
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
        debounceUntil: '2026-07-03T11:59:00.000Z',
        messageIds: ['message-1'],
      },
      ...overrides,
    } as MakeSyncEvent;
  }
});
