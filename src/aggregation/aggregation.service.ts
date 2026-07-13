import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Raw, Repository } from 'typeorm';

import {
  ClientCard,
  ClientCardService,
} from '../clients/client-card.service';
import { Client } from '../typeorm/entities/client.entity';
import {
  Channel,
  MakeSyncStatus,
  MessageDirection,
} from '../typeorm/entities/enums';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { Message } from '../typeorm/entities/message.entity';

const DEBOUNCE_WINDOW_MS = 60_000;
function quoteRawAlias(alias: string): string {
  return alias
    .split('.')
    .map((part) =>
      part.startsWith('"') && part.endsWith('"')
        ? part
        : `"${part.replace(/"/g, '""')}"`,
    )
    .join('.');
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(
    @InjectRepository(MakeSyncEvent)
    private readonly makeSyncEventsRepository: Repository<MakeSyncEvent>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    private readonly clientCardService: ClientCardService,
  ) {}

  async scheduleFromMessage(params: {
    clientId: string;
    channel: Channel;
    messageId: string;
  }): Promise<void> {
    const debounceUntil = new Date(Date.now() + DEBOUNCE_WINDOW_MS);
    const existingEvent = await this.findPendingEvent(params);
    const messageIds = this.mergeMessageIds(
      this.getMessageIds(existingEvent?.payload),
      params.messageId,
    );
    const pendingPayload = await this.buildPendingPayload({
      ...params,
      messageIds,
    });
    const payload = {
      ...pendingPayload,
      clientId: params.clientId,
      channel: params.channel,
      debounceUntil: debounceUntil.toISOString(),
      messageIds,
    };

    if (existingEvent) {
      existingEvent.payload = payload;
      await this.makeSyncEventsRepository.save(existingEvent);

      this.logger.log(
        `Updated aggregation event clientId=${params.clientId} channel=${params.channel} makeSyncEventId=${existingEvent.id}`,
      );
      return;
    }

    const makeSyncEvent = this.makeSyncEventsRepository.create({
      clientId: params.clientId,
      status: MakeSyncStatus.PENDING,
      payload,
    });
    const savedEvent = await this.makeSyncEventsRepository.save(makeSyncEvent);

    this.logger.log(
      `Created aggregation event clientId=${params.clientId} channel=${params.channel} makeSyncEventId=${savedEvent.id}`,
    );
  }

  async buildPendingPayload(params: {
    clientId: string;
    channel: Channel;
    messageIds?: string[];
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
      this.clientCardService.getCard(params.clientId),
    ]);
    const lastMessage = messages[messages.length - 1];

    return {
      client: {
        id: params.clientId,
        name: client?.name ?? null,
        phone: client?.phone ?? null,
        email: client?.email ?? null,
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

  private findPendingEvent(params: {
    clientId: string;
    channel: Channel;
  }): Promise<MakeSyncEvent | null> {
    return this.makeSyncEventsRepository.findOne({
      where: {
        clientId: params.clientId,
        status: MakeSyncStatus.PENDING,
        sentAt: IsNull(),
        payload: Raw((alias) => `${quoteRawAlias(alias)}->>'channel' = :channel`, {
          channel: params.channel,
        }),
      },
      order: {
        updatedAt: 'DESC',
      },
    });
  }

  private getMessageIds(payload: unknown): string[] {
    if (!this.isRecord(payload) || !Array.isArray(payload.messageIds)) {
      return [];
    }

    return payload.messageIds.filter(
      (messageId): messageId is string => typeof messageId === 'string',
    );
  }

  private mergeMessageIds(
    existingMessageIds: string[],
    messageId: string,
  ): string[] {
    return Array.from(new Set([...existingMessageIds, messageId]));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
