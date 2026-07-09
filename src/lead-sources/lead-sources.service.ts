import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { LeadSource } from '../typeorm/entities/lead-source.entity';

@Injectable()
export class LeadSourcesService {
  constructor(
    @InjectRepository(LeadSource)
    private readonly leadSourcesRepository: Repository<LeadSource>,
  ) {}

  async createFromEvent(params: {
    event: NormalizedEvent;
    client: Client;
  }): Promise<LeadSource | null> {
    if (!this.hasUtm(params.event)) {
      return null;
    }

    const leadSource = this.leadSourcesRepository.create({
      clientId: params.client.id,
      utmSource: params.event.utm?.source,
      utmMedium: params.event.utm?.medium,
      utmCampaign: params.event.utm?.campaign,
      utmContent: params.event.utm?.content,
      utmTerm: params.event.utm?.term,
    });

    return this.leadSourcesRepository.save(leadSource);
  }

  private hasUtm(event: NormalizedEvent): boolean {
    return Object.values(event.utm ?? {}).some((value) => Boolean(value));
  }
}
