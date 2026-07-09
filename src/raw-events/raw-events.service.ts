import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RawEvent } from '../typeorm/entities/raw-event.entity';

@Injectable()
export class RawEventsService {
  constructor(
    @InjectRepository(RawEvent)
    private readonly rawEventsRepository: Repository<RawEvent>,
  ) {}

  async create(params: {
    source: string;
    eventType?: string;
    payload: unknown;
  }): Promise<RawEvent> {
    const rawEvent = this.rawEventsRepository.create({
      source: params.source,
      eventType: params.eventType,
      payload: params.payload,
      processed: false,
    });

    return this.rawEventsRepository.save(rawEvent);
  }
}
