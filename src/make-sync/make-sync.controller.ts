import { Controller, Param, Post } from '@nestjs/common';

import { MakeSyncService } from './make-sync.service';

@Controller('make-sync')
export class MakeSyncController {
  constructor(private readonly makeSyncService: MakeSyncService) {}

  @Post('process-pending')
  processPending() {
    return this.makeSyncService.processPending();
  }

  @Post('retry/:id')
  retry(@Param('id') id: string) {
    return this.makeSyncService.retry(id);
  }
}
