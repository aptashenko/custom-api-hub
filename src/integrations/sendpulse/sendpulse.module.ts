import { Module } from '@nestjs/common';

import { SendPulseController } from './sendpulse.controller';
import { SendPulseService } from './sendpulse.service';

@Module({
  controllers: [SendPulseController],
  providers: [SendPulseService],
  exports: [SendPulseService],
})
export class SendPulseModule {}
