import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from './entities/client.entity';
import { ContactIdentity } from './entities/contact-identity.entity';
import { Conversation } from './entities/conversation.entity';
import { GoogleAdsAd } from './entities/google-ads-ad.entity';
import { GoogleAdsAdGroup } from './entities/google-ads-ad-group.entity';
import { GoogleAdsCampaign } from './entities/google-ads-campaign.entity';
import { GoogleAdsClick } from './entities/google-ads-click.entity';
import { GoogleAdsInsight } from './entities/google-ads-insight.entity';
import { GoogleAdsSyncRun } from './entities/google-ads-sync-run.entity';
import { LeadSource } from './entities/lead-source.entity';
import { MakeSyncEvent } from './entities/make-sync-event.entity';
import { MetaAd } from './entities/meta-ad.entity';
import { MetaAdAccount } from './entities/meta-ad-account.entity';
import { MetaAdCreative } from './entities/meta-ad-creative.entity';
import { MetaAdset } from './entities/meta-adset.entity';
import { MetaAdsInsight } from './entities/meta-ads-insight.entity';
import { MetaCampaign } from './entities/meta-campaign.entity';
import { MetaSyncRun } from './entities/meta-sync-run.entity';
import { Message } from './entities/message.entity';
import { RawEvent } from './entities/raw-event.entity';
import { SendPulseContact } from './entities/sendpulse-contact.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [
          Client,
          ContactIdentity,
          Conversation,
          GoogleAdsAd,
          GoogleAdsAdGroup,
          GoogleAdsCampaign,
          GoogleAdsClick,
          GoogleAdsInsight,
          GoogleAdsSyncRun,
          LeadSource,
          MakeSyncEvent,
          MetaAd,
          MetaAdAccount,
          MetaAdCreative,
          MetaAdset,
          MetaAdsInsight,
          MetaCampaign,
          MetaSyncRun,
          Message,
          RawEvent,
          SendPulseContact,
        ],
        synchronize: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class TypeormModule {}
