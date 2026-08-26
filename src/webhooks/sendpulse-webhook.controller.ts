import { Body, Controller, Logger, Post } from '@nestjs/common';

import { AggregationService } from '../aggregation/aggregation.service';
import { ClientResolverService } from '../clients/client-resolver.service';
import { SendPulseNormalizer } from '../events/normalizers/sendpulse.normalizer';
import { SendPulseProfilesService } from '../integrations/sendpulse/sendpulse-profiles.service';
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
    private readonly sendPulseProfilesService: SendPulseProfilesService,
  ) {}

  @Post()
  async receive(@Body() body: RawWebhookPayloadDto) {
    this.logger.log(`Received webhook source=${SENDPULSE_SOURCE}`);

    const rawEvent = await this.rawEventsService.create({
      source: SENDPULSE_SOURCE,
      eventType: undefined,
      payload: body,
    });
    const payloadItems = this.getPayloadItems(body);
    const results = [];

    for (const payloadItem of payloadItems) {
      const normalized = this.sendPulseNormalizer.normalize(
        payloadItem,
        rawEvent.id,
      );

      if (!this.isProcessableEvent(normalized)) {
        this.logger.log(
          `Skipped webhook item rawEventId=${rawEvent.id} eventType=${normalized.eventType} channel=${normalized.channel}`,
        );
        continue;
      }

      this.logger.log(
        `Normalized webhook rawEventId=${rawEvent.id} eventType=${normalized.eventType} channel=${normalized.channel} externalUserId=${normalized.externalUserId ?? 'unknown'}`,
      );

      const { client, identity } =
        await this.clientResolverService.resolveFromEvent(normalized);
      const sendPulseProfile =
        await this.sendPulseProfilesService.upsertFromWebhookPayload(payloadItem, {
          client,
          identity,
        });
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
          botId: normalized.sourceBot?.id,
          botName: normalized.sourceBot?.name,
          botUrl: normalized.sourceBot?.url,
        });
      }

      this.logger.log(
        `Persisted event data rawEventId=${rawEvent.id} messageId=${message?.id ?? 'none'} leadSourceId=${leadSource?.id ?? 'none'}`,
      );

      results.push({
        eventType: normalized.eventType,
        channel: normalized.channel,
        clientId: client.id,
        identityId: identity?.id,
        sendPulseProfileId: sendPulseProfile?.id,
        messageId: message?.id,
        leadSourceId: leadSource?.id,
        aggregationScheduled,
      });
    }

    const firstResult = results[0];

    return {
      status: 'received',
      source: SENDPULSE_SOURCE,
      rawEventId: rawEvent.id,
      eventType: firstResult?.eventType,
      channel: firstResult?.channel,
      clientId: firstResult?.clientId,
      identityId: firstResult?.identityId,
      sendPulseProfileId: firstResult?.sendPulseProfileId,
      messageId: firstResult?.messageId,
      leadSourceId: firstResult?.leadSourceId,
      aggregationScheduled: firstResult?.aggregationScheduled ?? false,
      processedCount: results.length,
      results,
    };
  }

  private getPayloadItems(body: RawWebhookPayloadDto): unknown[] {
    return Array.isArray(body) ? body : [body];
  }

  private isProcessableEvent(
    event: ReturnType<SendPulseNormalizer['normalize']>,
  ): boolean {
    return Boolean(
      event.externalUserId ||
        event.client.name ||
        event.client.phone ||
        event.client.email ||
        event.client.username ||
        event.message ||
        event.utm,
    );
  }
}
