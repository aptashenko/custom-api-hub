import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOperator, IsNull, Repository } from 'typeorm';

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

    const leadSourceInput = {
      clientId: params.client.id,
      utmSource: this.cleanValue(params.event.utm?.source),
      utmMedium: this.cleanValue(params.event.utm?.medium),
      utmCampaign: this.cleanValue(params.event.utm?.campaign),
      utmContent: this.cleanValue(params.event.utm?.content),
      utmTerm: this.cleanValue(params.event.utm?.term),
    };
    const existingLeadSource = await this.leadSourcesRepository.findOne({
      where: {
        clientId: leadSourceInput.clientId,
        utmSource: this.toWhereValue(leadSourceInput.utmSource),
        utmMedium: this.toWhereValue(leadSourceInput.utmMedium),
        utmCampaign: this.toWhereValue(leadSourceInput.utmCampaign),
        utmContent: this.toWhereValue(leadSourceInput.utmContent),
        utmTerm: this.toWhereValue(leadSourceInput.utmTerm),
      },
    });

    if (existingLeadSource) {
      return existingLeadSource;
    }

    const leadSource = this.leadSourcesRepository.create({
      ...leadSourceInput,
    });

    return this.leadSourcesRepository.save(leadSource);
  }

  private hasUtm(event: NormalizedEvent): boolean {
    return Object.values(event.utm ?? {}).some((value) =>
      Boolean(this.cleanValue(value)),
    );
  }

  private cleanValue(value: string | undefined): string | null {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  }

  private toWhereValue(value: string | null): string | FindOperator<string> {
    return value ?? IsNull();
  }
}
