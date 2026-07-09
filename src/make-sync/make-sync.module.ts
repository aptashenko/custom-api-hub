import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AggregationModule } from '../aggregation/aggregation.module';
import { MakeModule } from '../integrations/make/make.module';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { MakeSyncController } from './make-sync.controller';
import { MakeSyncService } from './make-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MakeSyncEvent]),
    AggregationModule,
    MakeModule,
  ],
  controllers: [MakeSyncController],
  providers: [MakeSyncService],
  exports: [MakeSyncService],
})
export class MakeSyncModule {}
