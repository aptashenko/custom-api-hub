import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOperator, IsNull, Repository } from 'typeorm';

import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { GoogleAdsClick } from '../typeorm/entities/google-ads-click.entity';
import { LeadSource } from '../typeorm/entities/lead-source.entity';

@Injectable()
export class LeadSourcesService {
  constructor(
    @InjectRepository(LeadSource)
    private readonly leadSourcesRepository: Repository<LeadSource>,
    @InjectRepository(GoogleAdsClick)
    private readonly googleAdsClicksRepository: Repository<GoogleAdsClick>,
  ) {}

  async createFromEvent(params: {
    event: NormalizedEvent;
    client: Client;
  }): Promise<LeadSource | null> {
    if (!this.hasUtm(params.event)) {
      return null;
    }

    const googleAdsClick = await this.findGoogleAdsClick(params.event);
    const leadSourceInput = {
      clientId: params.client.id,
      utmSource: this.cleanValue(params.event.utm?.source),
      utmMedium: this.cleanValue(params.event.utm?.medium),
      utmCampaign: this.cleanValue(params.event.utm?.campaign),
      utmContent: this.cleanValue(params.event.utm?.content),
      utmTerm: this.cleanValue(params.event.utm?.term),
      landingPage: this.cleanValue(params.event.utm?.landingPage),
      referrer: this.cleanValue(params.event.utm?.referrer),
      gclid: this.cleanValue(params.event.utm?.gclid),
      gbraid: this.cleanValue(params.event.utm?.gbraid),
      wbraid: this.cleanValue(params.event.utm?.wbraid),
      googleCustomerId: this.firstValue([
        params.event.utm?.googleCustomerId,
        googleAdsClick?.googleCustomerId,
      ]),
      googleCampaignId: this.firstValue([
        params.event.utm?.googleCampaignId,
        googleAdsClick?.googleCampaignId,
        params.event.utm?.campaign,
      ]),
      googleAdGroupId: this.firstValue([
        params.event.utm?.googleAdGroupId,
        googleAdsClick?.googleAdGroupId,
      ]),
      googleAdId: this.firstValue([
        params.event.utm?.googleAdId,
        googleAdsClick?.googleAdId,
        params.event.utm?.content,
      ]),
      googleKeyword: this.firstValue([
        params.event.utm?.googleKeyword,
        googleAdsClick?.keywordText,
        params.event.utm?.term,
      ]),
      googleMatchType: this.firstValue([
        params.event.utm?.googleMatchType,
        googleAdsClick?.keywordMatchType,
      ]),
      googleDevice: this.firstValue([
        params.event.utm?.googleDevice,
        googleAdsClick?.device,
      ]),
    };
    const existingLeadSource = await this.leadSourcesRepository.findOne({
      where: {
        clientId: leadSourceInput.clientId,
        utmSource: this.toWhereValue(leadSourceInput.utmSource),
        utmMedium: this.toWhereValue(leadSourceInput.utmMedium),
        utmCampaign: this.toWhereValue(leadSourceInput.utmCampaign),
        utmContent: this.toWhereValue(leadSourceInput.utmContent),
        utmTerm: this.toWhereValue(leadSourceInput.utmTerm),
        gclid: this.toWhereValue(leadSourceInput.gclid),
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

  private async findGoogleAdsClick(
    event: NormalizedEvent,
  ): Promise<GoogleAdsClick | null> {
    const gclid = this.cleanValue(event.utm?.gclid);

    if (!gclid) {
      return null;
    }

    return this.googleAdsClicksRepository.findOne({
      where: { gclid },
      order: { date: 'DESC' },
    });
  }

  private firstValue(values: Array<string | null | undefined>): string | null {
    for (const value of values) {
      const cleaned = this.cleanValue(value ?? undefined);

      if (cleaned) {
        return cleaned;
      }
    }

    return null;
  }

  private cleanValue(value: string | undefined): string | null {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  }

  private toWhereValue(value: string | null): string | FindOperator<string> {
    return value ?? IsNull();
  }
}
