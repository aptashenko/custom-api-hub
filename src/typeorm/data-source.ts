import 'dotenv/config';

import { DataSource } from 'typeorm';

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
import { MakeWebhookLog } from './entities/make-webhook-log.entity';
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

export default new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/customer_hub?schema=public',
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
    MakeWebhookLog,
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
  migrations: ['src/typeorm/migrations/*.ts'],
  synchronize: false,
});
