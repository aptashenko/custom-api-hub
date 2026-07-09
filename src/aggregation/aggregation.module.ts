import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../typeorm/entities/client.entity';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { Message } from '../typeorm/entities/message.entity';
import { AggregationService } from './aggregation.service';

@Module({
  imports: [TypeOrmModule.forFeature([MakeSyncEvent, Message, Client])],
  providers: [AggregationService],
  exports: [AggregationService],
})
export class AggregationModule {}
