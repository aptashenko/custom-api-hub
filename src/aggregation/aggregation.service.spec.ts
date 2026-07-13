import {
  Channel,
  MakeSyncStatus,
  MessageDirection,
} from '../typeorm/entities/enums';
import { AggregationService } from './aggregation.service';

describe('AggregationService', () => {
  let makeSyncEventsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let messagesRepository: {
    find: jest.Mock;
  };
  let clientsRepository: {
    findOne: jest.Mock;
  };
  let clientCardService: {
    getCard: jest.Mock;
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
    messagesRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    clientsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'client-id',
        name: 'Alex',
        phone: '+10000000000',
        email: 'alex@example.com',
      }),
    };
    clientCardService = {
      getCard: jest.fn().mockResolvedValue({
        id: 'client-id',
        clientNumber: 1001,
        profile: {
          name: 'Alex',
          phone: '+10000000000',
          email: 'alex@example.com',
          username: 'alex_user',
          avatarUrl: null,
        },
        sendPulse: {
          contactId: 'contact-1',
          botId: 'bot-1',
          botName: 'Main Telegram Bot',
          pipeline: null,
          tags: ['lead'],
          variables: {
            Phone: '+10000000000',
          },
          rawContact: {
            full_name: 'Alex',
          },
        },
        activity: {
          messageCount: 2,
          lastMessageText: 'Second',
          lastMessageAt: '2026-07-03T11:59:00.000Z',
        },
        identities: [
          {
            channel: Channel.TELEGRAM,
            externalId: 'telegram-user-id',
            username: 'alex_user',
            phone: '+10000000000',
            email: null,
          },
        ],
        leadSources: [],
        recentMessages: [],
      }),
    };
    service = new AggregationService(
      makeSyncEventsRepository as never,
      messagesRepository as never,
      clientsRepository as never,
      clientCardService as never,
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
    });

    expect(makeSyncEventsRepository.create).toHaveBeenCalledWith({
      clientId: 'client-id',
      status: MakeSyncStatus.PENDING,
      payload: expect.objectContaining({
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
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
        messageIds: ['message-1'],
      },
    };
    makeSyncEventsRepository.findOne.mockResolvedValue(existingEvent);

    await service.scheduleFromMessage({
      clientId: 'client-id',
      channel: Channel.TELEGRAM,
      messageId: 'message-2',
    });

    expect(makeSyncEventsRepository.create).not.toHaveBeenCalled();
    expect(makeSyncEventsRepository.save).toHaveBeenCalledWith({
      ...existingEvent,
      payload: expect.objectContaining({
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
        debounceUntil: '2026-07-03T12:01:00.000Z',
        messageIds: ['message-1', 'message-2'],
      }),
    });
  });

  it('buildPendingPayload returns selected messages', async () => {
    const firstDate = new Date('2026-07-03T11:58:00.000Z');
    const secondDate = new Date('2026-07-03T11:59:00.000Z');
    messagesRepository.find.mockResolvedValue([
      {
        id: 'message-1',
        text: 'First',
        direction: MessageDirection.IN,
        createdAt: firstDate,
      },
      {
        id: 'message-2',
        text: 'Second',
        direction: MessageDirection.OUT,
        createdAt: secondDate,
      },
    ]);

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
        profile: {
          name: 'Alex',
          phone: '+10000000000',
          email: 'alex@example.com',
          username: 'alex_user',
          avatarUrl: null,
        },
        sendPulse: {
          contactId: 'contact-1',
          botId: 'bot-1',
          botName: 'Main Telegram Bot',
          pipeline: null,
          tags: ['lead'],
          variables: {
            Phone: '+10000000000',
          },
        },
        activity: {
          messageCount: 2,
          lastMessageText: 'Second',
          lastMessageAt: '2026-07-03T11:59:00.000Z',
        },
        identities: [
          {
            channel: Channel.TELEGRAM,
            externalId: 'telegram-user-id',
            username: 'alex_user',
            phone: '+10000000000',
            email: null,
          },
        ],
        leadSources: [],
        recentMessages: [],
      },
      channel: Channel.TELEGRAM,
      botId: 'bot-1',
      botName: 'Main Telegram Bot',
      messages: [
        {
          id: 'message-1',
          text: 'First',
          direction: MessageDirection.IN,
          sender: 'CLIENT',
          createdAt: '2026-07-03T11:58:00.000Z',
        },
        {
          id: 'message-2',
          text: 'Second',
          direction: MessageDirection.OUT,
          sender: 'BOT',
          createdAt: '2026-07-03T11:59:00.000Z',
        },
      ],
      lastMessageAt: '2026-07-03T11:59:00.000Z',
    });
    expect(clientCardService.getCard).toHaveBeenCalledWith('client-id');
    expect(messagesRepository.find).toHaveBeenCalledWith({
      where: {
        id: expect.any(Object),
        clientId: 'client-id',
        channel: Channel.TELEGRAM,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  });
});
