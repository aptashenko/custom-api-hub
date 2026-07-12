import { Controller, Get, Param } from '@nestjs/common';

import { ClientCard, ClientCardService } from './client-card.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientCardService: ClientCardService) {}

  @Get(':clientRef/card')
  getCard(@Param('clientRef') clientRef: string): Promise<ClientCard> {
    return this.clientCardService.getCard(clientRef);
  }
}
