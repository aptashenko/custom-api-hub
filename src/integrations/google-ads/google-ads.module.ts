import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GoogleAdsAd } from '../../typeorm/entities/google-ads-ad.entity';
import { GoogleAdsAdGroup } from '../../typeorm/entities/google-ads-ad-group.entity';
import { GoogleAdsCampaign } from '../../typeorm/entities/google-ads-campaign.entity';
import { GoogleAdsClick } from '../../typeorm/entities/google-ads-click.entity';
import { GoogleAdsInsight } from '../../typeorm/entities/google-ads-insight.entity';
import { GoogleAdsSyncRun } from '../../typeorm/entities/google-ads-sync-run.entity';
import { GoogleAdsApiService } from './google-ads-api.service';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsSyncService } from './google-ads-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoogleAdsAd,
      GoogleAdsAdGroup,
      GoogleAdsCampaign,
      GoogleAdsClick,
      GoogleAdsInsight,
      GoogleAdsSyncRun,
    ]),
  ],
  controllers: [GoogleAdsController],
  providers: [GoogleAdsApiService, GoogleAdsSyncService],
  exports: [GoogleAdsSyncService],
})
export class GoogleAdsModule {}
