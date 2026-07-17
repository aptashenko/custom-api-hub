import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import { Channel } from '../typeorm/entities/enums';
import { ClientCard, ClientCardService } from './client-card.service';
import { ClientMakePayloadService } from './client-make-payload.service';

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientCardService: ClientCardService,
    private readonly clientMakePayloadService: ClientMakePayloadService,
  ) {}

  @Get(':clientRef/card')
  getCard(@Param('clientRef') clientRef: string): Promise<ClientCard> {
    return this.clientCardService.getCard(clientRef);
  }

  @Get(':clientRef/make-payload')
  getMakePayload(
    @Param('clientRef') clientRef: string,
    @Query('channel') channel?: string,
    @Query('messageIds') messageIds?: string,
  ): Promise<Record<string, unknown>> {
    return this.clientMakePayloadService.buildForClientRef({
      clientRef,
      channel: this.parseChannel(channel),
      messageIds: this.parseMessageIds(messageIds),
    });
  }

  private parseChannel(channel?: string): Channel {
    if (!channel) {
      return Channel.TELEGRAM;
    }

    if (Object.values(Channel).includes(channel as Channel)) {
      return channel as Channel;
    }

    throw new BadRequestException(`Unsupported channel: ${channel}`);
  }

  private parseMessageIds(messageIds?: string): string[] | undefined {
    if (!messageIds) {
      return undefined;
    }

    return messageIds
      .split(',')
      .map((messageId) => messageId.trim())
      .filter(Boolean);
  }
}
