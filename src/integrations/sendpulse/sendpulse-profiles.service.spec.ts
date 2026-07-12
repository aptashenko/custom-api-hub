import { Channel } from '../../typeorm/entities/enums';
import { SendPulseProfilesService } from './sendpulse-profiles.service';

describe('SendPulseProfilesService', () => {
  let sendPulseContactsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clientsRepository: {
    save: jest.Mock;
  };
  let identitiesRepository: {
    save: jest.Mock;
  };
  let service: SendPulseProfilesService;

  beforeEach(() => {
    sendPulseContactsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn((input) =>
        Promise.resolve({
          id: 'sendpulse-profile-id',
          ...input,
        }),
      ),
    };
    clientsRepository = {
      save: jest.fn((input) => Promise.resolve(input)),
    };
    identitiesRepository = {
      save: jest.fn((input) => Promise.resolve(input)),
    };
    service = new SendPulseProfilesService(
      sendPulseContactsRepository as never,
      clientsRepository as never,
      identitiesRepository as never,
    );
  });

  it('upserts tags and variables from SendPulse webhook payload', async () => {
    const payload = [
      {
        title: 'export_contact_data',
        bot: {
          id: 'bot-1',
          name: 'Bot',
        },
        contact: {
          id: 'contact-1',
          name: 'Alex',
          username: 'alex_user',
          tags: ['hot', 'paid'],
          variables: {
            Phone: '+10000000000',
            Email: 'alex@example.com',
            plan: 'pro',
          },
        },
      },
    ];
    const client = {
      id: 'client-id',
      name: null,
      phone: null,
      email: null,
    };
    const identity = {
      id: 'identity-id',
      clientId: 'client-id',
      channel: Channel.SENDPULSE,
      externalId: 'contact-1',
      username: null,
      phone: null,
      email: null,
    };

    await expect(
      service.upsertFromWebhookPayload(payload, {
        client: client as never,
        identity: identity as never,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'sendpulse-profile-id',
        exportKey: 'bot-1:contact-1',
        botId: 'bot-1',
        contactId: 'contact-1',
        tags: ['hot', 'paid'],
        variables: {
          Phone: '+10000000000',
          Email: 'alex@example.com',
          plan: 'pro',
        },
        clientId: 'client-id',
        contactIdentityId: 'identity-id',
      }),
    );
    expect(clientsRepository.save).toHaveBeenCalledWith({
      id: 'client-id',
      name: 'Alex',
      phone: '+10000000000',
      phoneNormalized: '10000000000',
      email: 'alex@example.com',
    });
    expect(identitiesRepository.save).toHaveBeenCalledWith({
      id: 'identity-id',
      clientId: 'client-id',
      channel: Channel.SENDPULSE,
      externalId: 'contact-1',
      username: 'alex_user',
      phone: '+10000000000',
      phoneNormalized: '10000000000',
      email: 'alex@example.com',
    });
    expect(sendPulseContactsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        rawContact: payload[0].contact,
        rawProfile: payload[0],
        sourceFile: 'sendpulse-webhook',
      }),
    );
  });
});
