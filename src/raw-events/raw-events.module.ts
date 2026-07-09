import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RawEvent } from '../typeorm/entities/raw-event.entity';
import { RawEventsService } from './raw-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([RawEvent])],
  providers: [RawEventsService],
  exports: [RawEventsService],
})
export class RawEventsModule {}
