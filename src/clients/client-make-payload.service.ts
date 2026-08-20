import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  ClientCard,
  ClientCardService,
} from './client-card.service';
import { Client } from '../typeorm/entities/client.entity';
import { Channel, MessageDirection } from '../typeorm/entities/enums';
import { Message } from '../typeorm/entities/message.entity';

@Injectable()
export class ClientMakePayloadService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly clientCardService: ClientCardService,
  ) {}

  async buildForClientRef(params: {
    clientRef: string;
    channel: Channel;
    messageIds?: string[];
  }): Promise<Record<string, unknown>> {
    const clientCard = await this.clientCardService.getCard(params.clientRef);

    return this.build({
      clientId: clientCard.id,
      channel: params.channel,
      messageIds: params.messageIds,
      clientCard,
    });
  }

  async build(params: {
    clientId: string;
    channel: Channel;
    messageIds?: string[];
    clientCard?: ClientCard;
  }): Promise<Record<string, unknown>> {
    const [client, messages, clientCard] = await Promise.all([
      this.clientsRepository.findOne({
        where: {
          id: params.clientId,
        },
      }),
      this.messagesRepository.find({
        where: {
          id: In(params.messageIds ?? []),
          clientId: params.clientId,
          channel: params.channel,
        },
        order: {
          createdAt: 'ASC',
        },
      }),
      params.clientCard ?? this.clientCardService.getCard(params.clientId),
    ]);
    const lastMessage = messages[messages.length - 1];

    return {
      client: {
        id: params.clientId,
        name: client?.name ?? null,
        phone: client?.phone ?? null,
        email: client?.email ?? null,
        leadCreatedAt: client?.leadCreatedAt?.toISOString() ?? null,
        createdAt: client?.createdAt?.toISOString() ?? null,
      },
      clientCard: this.toMakeClientCard(clientCard),
      channel: params.channel,
      botId: clientCard.sendPulse?.botId ?? null,
      botName: clientCard.sendPulse?.botName ?? null,
      messages: messages.map((message) => ({
        id: message.id,
        text: message.text,
        direction: message.direction,
        sender: this.resolveMessageSender(message.direction),
        createdAt: message.createdAt.toISOString(),
      })),
      lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
    };
  }

  private resolveMessageSender(direction: MessageDirection): 'CLIENT' | 'BOT' {
    return direction === MessageDirection.OUT ? 'BOT' : 'CLIENT';
  }

  private toMakeClientCard(card: ClientCard) {
    const { sendPulse, ...clientCard } = card;

    if (!sendPulse) {
      return clientCard;
    }

    const { rawContact: _rawContact, ...cleanSendPulse } = sendPulse;

    return {
      ...clientCard,
      sendPulse: cleanSendPulse,
    };
  }
}
