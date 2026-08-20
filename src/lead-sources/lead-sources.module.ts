import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GoogleAdsClick } from '../typeorm/entities/google-ads-click.entity';
import { LeadSource } from '../typeorm/entities/lead-source.entity';
import { LeadSourcesService } from './lead-sources.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeadSource, GoogleAdsClick])],
  providers: [LeadSourcesService],
  exports: [LeadSourcesService],
})
export class LeadSourcesModule {}
