import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { Message } from '../typeorm/entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
  ) {}

  async createFromEvent(params: {
    event: NormalizedEvent;
    client: Client;
  }): Promise<Message | null> {
    const text = params.event.message?.text?.trim();

    if (!params.event.message || !text) {
      return null;
    }

    const message = this.messagesRepository.create({
      clientId: params.client.id,
      conversationId: null,
      channel: params.event.channel,
      direction: params.event.message.direction,
      text,
      externalMessageId: params.event.externalMessageId,
    });

    return this.messagesRepository.save(message);
  }
}
