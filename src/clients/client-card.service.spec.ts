import { Channel, MessageDirection } from '../typeorm/entities/enums';
import { ClientCardService } from './client-card.service';

describe('ClientCardService', () => {
  let clientsRepository: {
    findOne: jest.Mock;
  };
  let identitiesRepository: {
    find: jest.Mock;
  };
  let sendPulseContactsRepository: {
    findOne: jest.Mock;
  };
  let messagesRepository: {
    find: jest.Mock;
    count: jest.Mock;
  };
  let leadSourcesRepository: {
    find: jest.Mock;
  };
  let service: ClientCardService;

  beforeEach(() => {
    clientsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'client-id',
        clientNumber: 1001,
        name: null,
        phone: null,
        email: 'alex@example.com',
      }),
    };
    identitiesRepository = {
      find: jest.fn().mockResolvedValue([
        {
          channel: Channel.SENDPULSE,
          externalId: 'contact-1',
          username: 'alex_user',
          phone: null,
          email: null,
        },
      ]),
    };
    sendPulseContactsRepository = {
      findOne: jest.fn().mockResolvedValue({
        contactId: 'contact-1',
        botId: 'bot-1',
        tags: ['lead'],
        variables: {
          Phone: '+10000000000',
        },
        rawContact: {
          full_name: 'Alex',
          profile_pic: 'https://example.com/avatar.jpg',
        },
      }),
    };
    messagesRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'message-id',
          channel: Channel.SENDPULSE,
          direction: MessageDirection.IN,
          text: 'Hello',
          externalMessageId: 'external-message-id',
          createdAt: new Date('2026-07-09T12:00:00.000Z'),
        },
      ]),
      count: jest.fn().mockResolvedValue(3),
    };
    leadSourcesRepository = {
      find: jest.fn().mockResolvedValue([
        {
          utmSource: 'telegram',
          utmMedium: 'bot',
          utmCampaign: 'summer',
          utmContent: null,
          utmTerm: null,
          referrer: null,
          landingPage: null,
          createdAt: new Date('2026-07-08T12:00:00.000Z'),
        },
      ]),
    };
    service = new ClientCardService(
      clientsRepository as never,
      identitiesRepository as never,
      sendPulseContactsRepository as never,
      messagesRepository as never,
      leadSourcesRepository as never,
    );
  });

  it('builds a client card by client number', async () => {
    await expect(service.getCard('1001')).resolves.toEqual({
      id: 'client-id',
      clientNumber: 1001,
      profile: {
        name: 'Alex',
        phone: '+10000000000',
        email: 'alex@example.com',
        username: 'alex_user',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      sendPulse: {
        contactId: 'contact-1',
        botId: 'bot-1',
        tags: ['lead'],
        variables: {
          Phone: '+10000000000',
        },
        rawContact: {
          full_name: 'Alex',
          profile_pic: 'https://example.com/avatar.jpg',
        },
      },
      activity: {
        messageCount: 3,
        lastMessageText: 'Hello',
        lastMessageAt: '2026-07-09T12:00:00.000Z',
      },
      identities: [
        {
          channel: Channel.SENDPULSE,
          externalId: 'contact-1',
          username: 'alex_user',
          phone: null,
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
          createdAt: '2026-07-08T12:00:00.000Z',
        },
      ],
      recentMessages: [
        {
          id: 'message-id',
          channel: Channel.SENDPULSE,
          direction: MessageDirection.IN,
          text: 'Hello',
          externalMessageId: 'external-message-id',
          createdAt: '2026-07-09T12:00:00.000Z',
        },
      ],
    });
    expect(clientsRepository.findOne).toHaveBeenCalledWith({
      where: {
        clientNumber: 1001,
      },
    });
  });
});
