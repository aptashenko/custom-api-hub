import { Body, Controller, Post } from '@nestjs/common';

import {
  SyncGoogleAdsDateRangeDto,
  SyncGoogleAdsDictionariesDto,
} from './dto/sync-google-ads.dto';
import { GoogleAdsSyncService } from './google-ads-sync.service';

@Controller('integrations/google-ads')
export class GoogleAdsController {
  constructor(private readonly googleAdsSyncService: GoogleAdsSyncService) {}

  @Post('sync/dictionaries')
  syncDictionaries(@Body() body: SyncGoogleAdsDictionariesDto = {}) {
    return this.googleAdsSyncService.syncDictionaries(body.customerIds);
  }

  @Post('sync/clicks')
  syncClicks(@Body() body: SyncGoogleAdsDateRangeDto = {}) {
    return this.googleAdsSyncService.syncClicks(body);
  }

  @Post('sync/insights')
  syncInsights(@Body() body: SyncGoogleAdsDateRangeDto = {}) {
    return this.googleAdsSyncService.syncInsights(body);
  }

  @Post('sync/history')
  syncHistory(@Body() body: SyncGoogleAdsDateRangeDto = {}) {
    return this.googleAdsSyncService.syncHistory(body);
  }
}
