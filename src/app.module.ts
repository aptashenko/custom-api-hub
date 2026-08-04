import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ClientsModule } from './clients/clients.module';
import { HealthModule } from './health/health.module';
import { MetaAdsModule } from './integrations/meta-ads/meta-ads.module';
import { SendPulseModule } from './integrations/sendpulse/sendpulse.module';
import { MakeSyncModule } from './make-sync/make-sync.module';
import { RawEventsModule } from './raw-events/raw-events.module';
import { TypeormModule } from './typeorm/typeorm.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeormModule,
    HealthModule,
    ClientsModule,
    RawEventsModule,
    MakeSyncModule,
    MetaAdsModule,
    SendPulseModule,
    WebhooksModule,
  ],
})
export class AppModule {}
