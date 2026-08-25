import { ConfigService } from '@nestjs/config';

import { AggregationService } from '../aggregation/aggregation.service';
import { MakeService } from '../integrations/make/make.service';
import {
  Channel,
  MakeSyncStatus,
  MakeWebhookLogStatus,
} from '../typeorm/entities/enums';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { MakeSyncService } from './make-sync.service';

describe('MakeSyncService', () => {
  let repository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let makeWebhookLogsRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let aggregationService: jest.Mocked<
    Pick<AggregationService, 'buildPendingPayload'>
  >;
  let makeService: jest.Mocked<Pick<MakeService, 'sendPayload'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let service: MakeSyncService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-03T12:00:00.000Z'));

    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((input) => Promise.resolve(input)),
    };
    makeWebhookLogsRepository = {
      create: jest.fn((input) => ({
        id: 'make-webhook-log-id',
        ...input,
      })),
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
    configService = {
      get: jest.fn(),
    };
    service = new MakeSyncService(
      repository as never,
      makeWebhookLogsRepository as never,
      aggregationService as never,
      makeService as never,
      configService as never,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
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
    expect(makeWebhookLogsRepository.create).toHaveBeenCalledWith({
      makeSyncEventId: 'make-sync-event-id',
      clientId: 'client-id',
      clientNumber: null,
      name: null,
      phone: null,
      email: null,
      username: null,
      channel: Channel.TELEGRAM,
      status: MakeWebhookLogStatus.PENDING,
      payload: {
        client: {
          id: 'client-id',
        },
        channel: Channel.TELEGRAM,
        messages: [],
        lastMessageAt: null,
      },
      attemptedAt: new Date('2026-07-03T12:00:00.000Z'),
      completedAt: null,
      error: null,
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
    expect(makeWebhookLogsRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'make-webhook-log-id',
        status: MakeWebhookLogStatus.SENT,
        completedAt: new Date('2026-07-03T12:00:00.000Z'),
        error: null,
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
    expect(makeWebhookLogsRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'make-webhook-log-id',
        status: MakeWebhookLogStatus.FAILED,
        completedAt: new Date('2026-07-03T12:00:00.000Z'),
        error: 'Make is unavailable',
      }),
    );
  });

  it('auto processes due events outside production', async () => {
    const event = makeSyncEvent();

    configService.get.mockImplementation((key: string) => {
      if (key === 'MAKE_SYNC_PROCESS_INTERVAL_MS') {
        return '1000';
      }

      return undefined;
    });
    repository.find.mockResolvedValue([event]);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(1000);

    expect(makeService.sendPayload).toHaveBeenCalledTimes(1);
  });

  it('auto processes due events in production', async () => {
    const event = makeSyncEvent();

    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'production';
      }

      if (key === 'MAKE_SYNC_PROCESS_INTERVAL_MS') {
        return '1000';
      }

      return undefined;
    });
    repository.find.mockResolvedValue([event]);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(1000);

    expect(makeService.sendPayload).toHaveBeenCalledTimes(1);
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
