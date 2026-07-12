import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../typeorm/entities/client.entity';
import { ContactIdentity } from '../typeorm/entities/contact-identity.entity';
import { LeadSource } from '../typeorm/entities/lead-source.entity';
import { Message } from '../typeorm/entities/message.entity';
import { SendPulseContact } from '../typeorm/entities/sendpulse-contact.entity';
import { ClientCardService } from './client-card.service';
import { ClientResolverService } from './client-resolver.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ContactIdentity,
      SendPulseContact,
      Message,
      LeadSource,
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientResolverService, ClientCardService],
  exports: [ClientResolverService, ClientCardService],
})
export class ClientsModule {}
