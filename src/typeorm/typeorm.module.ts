import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from './entities/client.entity';
import { ContactIdentity } from './entities/contact-identity.entity';
import { Conversation } from './entities/conversation.entity';
import { LeadSource } from './entities/lead-source.entity';
import { MakeSyncEvent } from './entities/make-sync-event.entity';
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
          LeadSource,
          MakeSyncEvent,
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
