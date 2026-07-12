import { Test, TestingModule } from '@nestjs/testing';

import { AggregationService } from '../aggregation/aggregation.service';
import { ClientResolverService } from '../clients/client-resolver.service';
import { SendPulseNormalizer } from '../events/normalizers/sendpulse.normalizer';
import { SendPulseProfilesService } from '../integrations/sendpulse/sendpulse-profiles.service';
import { LeadSourcesService } from '../lead-sources/lead-sources.service';
import { MessagesService } from '../messages/messages.service';
import { RawEventsService } from '../raw-events/raw-events.service';
import { RawEvent } from '../typeorm/entities/raw-event.entity';
import { SendpulseWebhookController } from './sendpulse-webhook.controller';

describe('SendpulseWebhookController', () => {
  let controller: SendpulseWebhookController;
  let rawEventsService: jest.Mocked<Pick<RawEventsService, 'create'>>;
  let clientResolverService: jest.Mocked<
    Pick<ClientResolverService, 'resolveFromEvent'>
  >;
  let messagesService: jest.Mocked<Pick<MessagesService, 'createFromEvent'>>;
  let leadSourcesService: jest.Mocked<
    Pick<LeadSourcesService, 'createFromEvent'>
  >;
  let aggregationService: jest.Mocked<
    Pick<AggregationService, 'scheduleFromMessage'>
  >;
  let sendPulseProfilesService: jest.Mocked<
    Pick<SendPulseProfilesService, 'upsertFromWebhookPayload'>
  >;

  beforeEach(async () => {
    rawEventsService = {
      create: jest.fn(),
    };
    clientResolverService = {
      resolveFromEvent: jest.fn(),
    };
    messagesService = {
      createFromEvent: jest.fn(),
    };
    leadSourcesService = {
      createFromEvent: jest.fn(),
    };
    aggregationService = {
      scheduleFromMessage: jest.fn(),
    };
    sendPulseProfilesService = {
      upsertFromWebhookPayload: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SendpulseWebhookController],
      providers: [
        {
          provide: RawEventsService,
          useValue: rawEventsService,
        },
        {
          provide: ClientResolverService,
          useValue: clientResolverService,
        },
        {
          provide: MessagesService,
          useValue: messagesService,
        },
        {
          provide: LeadSourcesService,
          useValue: leadSourcesService,
        },
        {
          provide: AggregationService,
          useValue: aggregationService,
        },
        {
          provide: SendPulseProfilesService,
          useValue: sendPulseProfilesService,
        },
        SendPulseNormalizer,
      ],
    }).compile();

    controller = module.get<SendpulseWebhookController>(
      SendpulseWebhookController,
    );
  });

  it('stores the payload and returns the raw event id', async () => {
    const payload = {
      event_type: 'message_received',
      contact: {
        id: 'external-user-id',
      },
    };
    const rawEvent = {
      id: 'raw-event-id',
    } as RawEvent;

    rawEventsService.create.mockResolvedValue(rawEvent);
    clientResolverService.resolveFromEvent.mockResolvedValue({
      client: {
        id: 'client-id',
      } as never,
      identity: {
        id: 'identity-id',
      } as never,
    });
    messagesService.createFromEvent.mockResolvedValue({
      id: 'message-id',
    } as never);
    leadSourcesService.createFromEvent.mockResolvedValue({
      id: 'lead-source-id',
    } as never);
    sendPulseProfilesService.upsertFromWebhookPayload.mockResolvedValue({
      id: 'sendpulse-profile-id',
    } as never);

    await expect(controller.receive(payload)).resolves.toEqual({
      status: 'received',
      source: 'sendpulse',
      rawEventId: 'raw-event-id',
      eventType: 'message_received',
      channel: 'SENDPULSE',
      clientId: 'client-id',
      identityId: 'identity-id',
      sendPulseProfileId: 'sendpulse-profile-id',
      messageId: 'message-id',
      leadSourceId: 'lead-source-id',
      aggregationScheduled: true,
    });
    expect(rawEventsService.create).toHaveBeenCalledWith({
      source: 'sendpulse',
      eventType: undefined,
      payload,
    });
    expect(aggregationService.scheduleFromMessage).toHaveBeenCalledWith({
      clientId: 'client-id',
      channel: 'SENDPULSE',
      messageId: 'message-id',
    });
    expect(sendPulseProfilesService.upsertFromWebhookPayload).toHaveBeenCalledWith(
      payload,
      {
        client: {
          id: 'client-id',
        },
        identity: {
          id: 'identity-id',
        },
      },
    );
  });
});
