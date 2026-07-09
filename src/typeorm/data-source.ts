import { DataSource } from 'typeorm';

import { Client } from './entities/client.entity';
import { ContactIdentity } from './entities/contact-identity.entity';
import { Conversation } from './entities/conversation.entity';
import { LeadSource } from './entities/lead-source.entity';
import { MakeSyncEvent } from './entities/make-sync-event.entity';
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
    LeadSource,
    MakeSyncEvent,
    Message,
    RawEvent,
    SendPulseContact,
  ],
  migrations: ['src/typeorm/migrations/*.ts'],
  synchronize: false,
});
