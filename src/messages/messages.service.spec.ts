import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { Channel, MessageDirection } from '../typeorm/entities/enums';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: MessagesService;

  const client = {
    id: 'client-id',
  } as Client;

  const baseEvent: NormalizedEvent = {
    source: 'sendpulse',
    channel: Channel.TELEGRAM,
    eventType: 'message_received',
    client: {},
    raw: {},
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((input) => input),
      save: jest.fn((input) => Promise.resolve({ id: 'message-id', ...input })),
    };
    service = new MessagesService(repository as never);
  });

  it('creates message when text exists', async () => {
    const result = await service.createFromEvent({
      client,
      event: {
        ...baseEvent,
        externalMessageId: 'external-message-id',
        message: {
          text: ' Hello ',
          direction: MessageDirection.IN,
        },
      },
    });

    expect(result?.id).toBe('message-id');
    expect(repository.create).toHaveBeenCalledWith({
      clientId: 'client-id',
      conversationId: null,
      channel: Channel.TELEGRAM,
      direction: MessageDirection.IN,
      text: 'Hello',
      externalMessageId: 'external-message-id',
    });
  });

  it('does not create message when text is missing', async () => {
    const result = await service.createFromEvent({
      client,
      event: baseEvent,
    });

    expect(result).toBeNull();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
