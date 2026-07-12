import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../../typeorm/entities/client.entity';
import { ContactIdentity } from '../../typeorm/entities/contact-identity.entity';
import { SendPulseContact } from '../../typeorm/entities/sendpulse-contact.entity';
import { SendPulseController } from './sendpulse.controller';
import { SendPulseProfilesService } from './sendpulse-profiles.service';
import { SendPulseService } from './sendpulse.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client, ContactIdentity, SendPulseContact])],
  controllers: [SendPulseController],
  providers: [SendPulseService, SendPulseProfilesService],
  exports: [SendPulseService, SendPulseProfilesService],
})
export class SendPulseModule {}
