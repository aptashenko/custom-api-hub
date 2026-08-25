import { Channel, MakeSyncStatus } from '../typeorm/entities/enums';
import { AggregationService } from './aggregation.service';

describe('AggregationService', () => {
  let makeSyncEventsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clientMakePayloadService: {
    build: jest.Mock;
  };
  let service: AggregationService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-03T12:00:00.000Z'));

    makeSyncEventsRepository = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn((input) =>
        Promise.resolve({
          id: input.id ?? 'make-sync-event-id',
          ...input,
        }),
      ),
    };
    clientMakePayloadService = {
      build: jest.fn().mockResolvedValue({
        client: {
          id: 'client-id',
          name: 'Alex',
          phone: '+10000000000',
          email: 'alex@example.com',
        },
        clientCard: {
          id: 'client-id',
          clientNumber: 1001,
        },
        channel: Channel.TELEGRAM,
        botId: 'bot-1',
        botName: 'Main Telegram Bot',
        messages: [],
        lastMessageAt: null,
      }),
    };
    service = new AggregationService(
      makeSyncEventsRepository as never,
      clientMakePayloadService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates pending MakeSyncEvent when none exists', async () => {
    makeSyncEventsRepository.findOne.mockResolvedValue(null);

    await service.scheduleFromMessage({
      clientId: 'client-id',
      channel: Channel.TELEGRAM,
      messageId: 'message-1',
      botId: 'bot-1',
      botName: 'Main Telegram Bot',
      botUrl: 'https://t.me/main_bot',
    });

    expect(makeSyncEventsRepository.create).toHaveBeenCalledWith({
      clientId: 'client-id',
      status: MakeSyncStatus.PENDING,
      payload: expect.objectContaining({
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
        botId: 'bot-1',
        botName: 'Main Telegram Bot',
        botUrl: 'https://t.me/main_bot',
        debounceUntil: '2026-07-03T12:01:00.000Z',
        messageIds: ['message-1'],
      }),
    });
    expect(makeSyncEventsRepository.save).toHaveBeenCalledTimes(1);
  });

  it('updates existing pending MakeSyncEvent for same client and channel', async () => {
    const existingEvent = {
      id: 'existing-event-id',
      clientId: 'client-id',
      status: MakeSyncStatus.PENDING,
      payload: {
        channel: Channel.TELEGRAM,
        botId: 'bot-1',
        messageIds: ['message-1'],
      },
    };
    makeSyncEventsRepository.findOne.mockResolvedValue(existingEvent);

    await service.scheduleFromMessage({
      clientId: 'client-id',
      channel: Channel.TELEGRAM,
      messageId: 'message-2',
      botId: 'bot-1',
    });

    expect(makeSyncEventsRepository.create).not.toHaveBeenCalled();
    expect(makeSyncEventsRepository.save).toHaveBeenCalledWith({
      ...existingEvent,
      payload: expect.objectContaining({
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
        botId: 'bot-1',
        debounceUntil: '2026-07-03T12:01:00.000Z',
        messageIds: ['message-1', 'message-2'],
      }),
    });
  });

  it('does not reuse pending event from a different bot', async () => {
    makeSyncEventsRepository.findOne.mockResolvedValue(null);

    await service.scheduleFromMessage({
      clientId: 'client-id',
      channel: Channel.TELEGRAM,
      messageId: 'message-2',
      botId: 'bot-2',
    });

    expect(makeSyncEventsRepository.create).toHaveBeenCalledWith({
      clientId: 'client-id',
      status: MakeSyncStatus.PENDING,
      payload: expect.objectContaining({
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
        botId: 'bot-2',
        messageIds: ['message-2'],
      }),
    });
  });

  it('buildPendingPayload delegates to client make payload service', async () => {
    await expect(
      service.buildPendingPayload({
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
        messageIds: ['message-1', 'message-2'],
      }),
    ).resolves.toEqual({
      client: {
        id: 'client-id',
        name: 'Alex',
        phone: '+10000000000',
        email: 'alex@example.com',
      },
      clientCard: {
        id: 'client-id',
        clientNumber: 1001,
      },
      channel: Channel.TELEGRAM,
      botId: 'bot-1',
      botName: 'Main Telegram Bot',
      messages: [],
      lastMessageAt: null,
    });
    expect(clientMakePayloadService.build).toHaveBeenCalledWith({
      clientId: 'client-id',
      channel: Channel.TELEGRAM,
      messageIds: ['message-1', 'message-2'],
    });
  });
});
