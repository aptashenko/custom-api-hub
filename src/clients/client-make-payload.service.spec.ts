import { Channel, MessageDirection } from '../typeorm/entities/enums';
import { ClientMakePayloadService } from './client-make-payload.service';

describe('ClientMakePayloadService', () => {
  let clientsRepository: {
    findOne: jest.Mock;
  };
  let messagesRepository: {
    find: jest.Mock;
  };
  let clientCardService: {
    getCard: jest.Mock;
  };
  let service: ClientMakePayloadService;

  beforeEach(() => {
    clientsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'client-id',
        name: 'Alex',
        phone: '+10000000000',
        email: 'alex@example.com',
      }),
    };
    messagesRepository = {
      find: jest.fn().mockResolvedValue([]),
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
        leadSources: [
          {
            utmSource: 'telegram',
            utmMedium: 'bot',
            utmCampaign: 'summer',
            utmContent: null,
            utmTerm: null,
            referrer: null,
            landingPage: null,
            createdAt: '2026-07-03T11:57:00.000Z',
          },
        ],
        recentMessages: [],
      }),
    };
    service = new ClientMakePayloadService(
      clientsRepository as never,
      messagesRepository as never,
      clientCardService as never,
    );
  });

  it('builds the same payload shape sent to Make', async () => {
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
      service.build({
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
        leadSources: [
          {
            utmSource: 'telegram',
            utmMedium: 'bot',
            utmCampaign: 'summer',
            utmContent: null,
            utmTerm: null,
            referrer: null,
            landingPage: null,
            createdAt: '2026-07-03T11:57:00.000Z',
          },
        ],
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

  it('builds payload by client number or id reference', async () => {
    await service.buildForClientRef({
      clientRef: '1001',
      channel: Channel.TELEGRAM,
    });

    expect(clientCardService.getCard).toHaveBeenCalledWith('1001');
    expect(clientsRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'client-id',
      },
    });
  });
});
