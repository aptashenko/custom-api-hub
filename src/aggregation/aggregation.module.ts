import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientsModule } from '../clients/clients.module';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { AggregationService } from './aggregation.service';

@Module({
  imports: [TypeOrmModule.forFeature([MakeSyncEvent]), ClientsModule],
  providers: [AggregationService],
  exports: [AggregationService],
})
export class AggregationModule {}
