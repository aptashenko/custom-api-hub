import { Module } from '@nestjs/common';

import { MakeService } from './make.service';

@Module({
  providers: [MakeService],
  exports: [MakeService],
})
export class MakeModule {}
