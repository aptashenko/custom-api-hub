import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../typeorm/entities/client.entity';
import { ContactIdentity } from '../typeorm/entities/contact-identity.entity';
import { ClientResolverService } from './client-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client, ContactIdentity])],
  providers: [ClientResolverService],
  exports: [ClientResolverService],
})
export class ClientsModule {}
