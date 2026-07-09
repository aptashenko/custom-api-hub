import { Channel, MessageDirection } from '../typeorm/entities/enums';
import { ClientResolverService } from './client-resolver.service';

describe('ClientResolverService', () => {
  const baseEvent = {
    source: 'sendpulse',
    channel: Channel.TELEGRAM,
    eventType: 'message_received',
    client: {},
    message: {
      text: 'Hello',
      direction: MessageDirection.IN,
    },
    raw: {},
  };

  let clientsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let identitiesRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: ClientResolverService;

  beforeEach(() => {
    clientsRepository = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve({ id: 'client-created', ...input })),
    };
    identitiesRepository = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn((input) =>
        Promise.resolve({ id: 'identity-created', ...input }),
      ),
    };
    service = new ClientResolverService(
      clientsRepository as never,
      identitiesRepository as never,
    );
  });

  it('creates client when no match exists', async () => {
    clientsRepository.findOne.mockResolvedValue(null);
    identitiesRepository.findOne.mockResolvedValue(null);

    const result = await service.resolveFromEvent({
      ...baseEvent,
      client: {
        name: 'Alex',
        phone: '+10000000000',
        email: 'alex@example.com',
      },
    });

    expect(result.client.id).toBe('client-created');
    expect(clientsRepository.create).toHaveBeenCalledWith({
      name: 'Alex',
      phone: '+10000000000',
      email: 'alex@example.com',
    });
  });

  it('finds client by existing identity', async () => {
    const client = { id: 'client-from-identity' };
    const identity = {
      id: 'identity-existing',
      client,
    };
    identitiesRepository.findOne.mockResolvedValue(identity);

    const result = await service.resolveFromEvent({
      ...baseEvent,
      externalUserId: 'telegram-user-id',
      client: {
        phone: '+10000000000',
      },
    });

    expect(result).toEqual({
      client,
      identity,
    });
    expect(clientsRepository.findOne).not.toHaveBeenCalled();
    expect(identitiesRepository.save).not.toHaveBeenCalled();
  });

  it('finds client by phone', async () => {
    const client = { id: 'client-by-phone', phone: '+10000000000' };
    clientsRepository.findOne.mockResolvedValueOnce(client);

    const result = await service.resolveFromEvent({
      ...baseEvent,
      client: {
        phone: '+10000000000',
      },
    });

    expect(result.client).toBe(client);
    expect(clientsRepository.findOne).toHaveBeenCalledWith({
      where: {
        phone: '+10000000000',
      },
    });
  });

  it('finds client by email', async () => {
    const client = { id: 'client-by-email', email: 'alex@example.com' };
    clientsRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(client);

    const result = await service.resolveFromEvent({
      ...baseEvent,
      client: {
        phone: '+10000000000',
        email: 'alex@example.com',
      },
    });

    expect(result.client).toBe(client);
    expect(clientsRepository.findOne).toHaveBeenLastCalledWith({
      where: {
        email: 'alex@example.com',
      },
    });
  });

  it('creates identity for externalUserId', async () => {
    const client = { id: 'client-by-phone', phone: '+10000000000' };
    identitiesRepository.findOne.mockResolvedValue(null);
    clientsRepository.findOne.mockResolvedValue(client);

    const result = await service.resolveFromEvent({
      ...baseEvent,
      externalUserId: 'telegram-user-id',
      client: {
        username: 'alex',
        phone: '+10000000000',
        email: 'alex@example.com',
      },
    });

    expect(result.identity?.id).toBe('identity-created');
    expect(identitiesRepository.create).toHaveBeenCalledWith({
      clientId: 'client-by-phone',
      channel: Channel.TELEGRAM,
      externalId: 'telegram-user-id',
      username: 'alex',
      phone: '+10000000000',
      email: 'alex@example.com',
    });
  });

  it('does not create duplicate identity', async () => {
    const client = { id: 'client-existing' };
    const identity = {
      id: 'identity-existing',
      client,
    };
    identitiesRepository.findOne.mockResolvedValue(identity);

    const result = await service.resolveFromEvent({
      ...baseEvent,
      externalUserId: 'telegram-user-id',
      client: {},
    });

    expect(result.identity).toBe(identity);
    expect(identitiesRepository.create).not.toHaveBeenCalled();
    expect(identitiesRepository.save).not.toHaveBeenCalled();
  });
});
