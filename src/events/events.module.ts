import { Module } from '@nestjs/common';

import { SendPulseNormalizer } from './normalizers/sendpulse.normalizer';

@Module({
  providers: [SendPulseNormalizer],
  exports: [SendPulseNormalizer],
})
export class EventsModule {}
