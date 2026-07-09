import { Module } from '@nestjs/common';

import { AggregationModule } from '../aggregation/aggregation.module';
import { ClientsModule } from '../clients/clients.module';
import { EventsModule } from '../events/events.module';
import { LeadSourcesModule } from '../lead-sources/lead-sources.module';
import { MessagesModule } from '../messages/messages.module';
import { RawEventsModule } from '../raw-events/raw-events.module';
import { SendpulseWebhookController } from './sendpulse-webhook.controller';

@Module({
  imports: [
    RawEventsModule,
    EventsModule,
    ClientsModule,
    MessagesModule,
    LeadSourcesModule,
    AggregationModule,
  ],
  controllers: [SendpulseWebhookController],
})
export class WebhooksModule {}
