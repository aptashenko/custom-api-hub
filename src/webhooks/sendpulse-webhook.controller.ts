import { Body, Controller, Logger, Post } from '@nestjs/common';

import { AggregationService } from '../aggregation/aggregation.service';
import { ClientResolverService } from '../clients/client-resolver.service';
import { SendPulseNormalizer } from '../events/normalizers/sendpulse.normalizer';
import { LeadSourcesService } from '../lead-sources/lead-sources.service';
import { MessagesService } from '../messages/messages.service';
import { RawEventsService } from '../raw-events/raw-events.service';
import { RawWebhookPayloadDto } from './dto/raw-webhook-payload.dto';

const SENDPULSE_SOURCE = 'sendpulse';

@Controller('webhooks/sendpulse')
export class SendpulseWebhookController {
  private readonly logger = new Logger(SendpulseWebhookController.name);

  constructor(
    private readonly rawEventsService: RawEventsService,
    private readonly sendPulseNormalizer: SendPulseNormalizer,
    private readonly clientResolverService: ClientResolverService,
    private readonly messagesService: MessagesService,
    private readonly leadSourcesService: LeadSourcesService,
    private readonly aggregationService: AggregationService,
  ) {}

  @Post()
  async receive(@Body() body: RawWebhookPayloadDto) {
    this.logger.log(`Received webhook source=${SENDPULSE_SOURCE}`);

    const rawEvent = await this.rawEventsService.create({
      source: SENDPULSE_SOURCE,
      eventType: undefined,
      payload: body,
    });
    const normalized = this.sendPulseNormalizer.normalize(body, rawEvent.id);

    this.logger.log(
      `Normalized webhook rawEventId=${rawEvent.id} eventType=${normalized.eventType} channel=${normalized.channel} externalUserId=${normalized.externalUserId ?? 'unknown'}`,
    );

    const { client, identity } =
      await this.clientResolverService.resolveFromEvent(normalized);
    const message = await this.messagesService.createFromEvent({
      event: normalized,
      client,
    });
    const leadSource = await this.leadSourcesService.createFromEvent({
      event: normalized,
      client,
    });
    const aggregationScheduled = Boolean(message);

    if (message) {
      await this.aggregationService.scheduleFromMessage({
        clientId: client.id,
        channel: normalized.channel,
        messageId: message.id,
      });
    }

    this.logger.log(
      `Persisted event data rawEventId=${rawEvent.id} messageId=${message?.id ?? 'none'} leadSourceId=${leadSource?.id ?? 'none'}`,
    );

    return {
      status: 'received',
      source: SENDPULSE_SOURCE,
      rawEventId: rawEvent.id,
      eventType: normalized.eventType,
      channel: normalized.channel,
      clientId: client.id,
      identityId: identity?.id,
      messageId: message?.id,
      leadSourceId: leadSource?.id,
      aggregationScheduled,
    };
  }
}
