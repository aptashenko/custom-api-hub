import { Module } from '@nestjs/common';

import { AggregationModule } from '../aggregation/aggregation.module';
import { ClientsModule } from '../clients/clients.module';
import { EventsModule } from '../events/events.module';
import { SendPulseModule } from '../integrations/sendpulse/sendpulse.module';
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
    SendPulseModule,
  ],
  controllers: [SendpulseWebhookController],
})
export class WebhooksModule {}
