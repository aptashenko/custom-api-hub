import { Body, Controller, Post } from '@nestjs/common';

import { ExportSendPulseAudienceDto } from './dto/export-sendpulse-audience.dto';
import { SendPulseService } from './sendpulse.service';

@Controller('integrations/sendpulse')
export class SendPulseController {
  constructor(private readonly sendPulseService: SendPulseService) {}

  @Post('audience/export')
  exportAudience(@Body() body: ExportSendPulseAudienceDto = {}) {
    return this.sendPulseService.exportAudienceToFile({
      botId: body?.botId,
      fileName: body?.fileName,
      pageSize: body?.pageSize,
    });
  }
}
