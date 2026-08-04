import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MetaAd } from '../../typeorm/entities/meta-ad.entity';
import { MetaAdAccount } from '../../typeorm/entities/meta-ad-account.entity';
import { MetaAdCreative } from '../../typeorm/entities/meta-ad-creative.entity';
import { MetaAdset } from '../../typeorm/entities/meta-adset.entity';
import { MetaAdsInsight } from '../../typeorm/entities/meta-ads-insight.entity';
import { MetaCampaign } from '../../typeorm/entities/meta-campaign.entity';
import { MetaSyncRun } from '../../typeorm/entities/meta-sync-run.entity';
import { MetaAdsApiService } from './meta-ads-api.service';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsSyncService } from './meta-ads-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetaAd,
      MetaAdAccount,
      MetaAdCreative,
      MetaAdset,
      MetaAdsInsight,
      MetaCampaign,
      MetaSyncRun,
    ]),
  ],
  controllers: [MetaAdsController],
  providers: [MetaAdsApiService, MetaAdsSyncService],
  exports: [MetaAdsSyncService],
})
export class MetaAdsModule {}
