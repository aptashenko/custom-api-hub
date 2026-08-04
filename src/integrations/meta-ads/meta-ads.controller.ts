import { Body, Controller, Post } from '@nestjs/common';

import { SyncMetaInsightsDto } from './dto/sync-meta-insights.dto';
import { MetaAdsSyncService } from './meta-ads-sync.service';

@Controller('integrations/meta-ads')
export class MetaAdsController {
  constructor(private readonly metaAdsSyncService: MetaAdsSyncService) {}

  @Post('sync/dictionaries')
  syncDictionaries(): Promise<unknown> {
    return this.metaAdsSyncService.syncDictionaries();
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
