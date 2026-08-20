import { Channel, MessageDirection } from '../../typeorm/entities/enums';

export interface NormalizedEvent {
  source: string;
  channel: Channel;
  eventType: string;

  externalUserId?: string;
  externalMessageId?: string;

  client: {
    name?: string;
    phone?: string;
    email?: string;
    username?: string;
  };

  message?: {
    text?: string;
    direction: MessageDirection;
  };

  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    landingPage?: string;
    referrer?: string;
    googleCustomerId?: string;
    googleCampaignId?: string;
    googleAdGroupId?: string;
    googleAdId?: string;
    googleKeyword?: string;
    googleMatchType?: string;
    googleDevice?: string;
  };

  rawEventId?: string;
  raw: unknown;
}
