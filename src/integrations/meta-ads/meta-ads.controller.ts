import { Body, Controller, Post } from '@nestjs/common';

import { SyncMetaDictionariesDto } from './dto/sync-meta-dictionaries.dto';
import { SyncMetaInsightsDto } from './dto/sync-meta-insights.dto';
import { MetaAdsSyncService } from './meta-ads-sync.service';

@Controller('integrations/meta-ads')
export class MetaAdsController {
  constructor(private readonly metaAdsSyncService: MetaAdsSyncService) {}

  @Post('sync/dictionaries')
  syncDictionaries(@Body() body: SyncMetaDictionariesDto = {}): Promise<unknown> {
    return this.metaAdsSyncService.syncDictionaries(body.accountIds);
  }

  @Post('sync/insights')
  syncInsights(@Body() body: SyncMetaInsightsDto = {}): Promise<unknown> {
    return this.metaAdsSyncService.syncInsights(body);
  }

  @Post('sync/insights/history')
  syncInsightsHistory(@Body() body: SyncMetaInsightsDto = {}): Promise<unknown> {
    return this.metaAdsSyncService.syncInsightsHistory(body);
  }
}
