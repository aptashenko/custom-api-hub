import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Raw, Repository } from 'typeorm';

import { ClientMakePayloadService } from '../clients/client-make-payload.service';
import { Channel, MakeSyncStatus } from '../typeorm/entities/enums';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';

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
    private readonly clientMakePayloadService: ClientMakePayloadService,
  ) {}

  async scheduleFromMessage(params: {
    clientId: string;
    channel: Channel;
    messageId: string;
    botId?: string;
    botName?: string;
    botUrl?: string;
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
      botId: params.botId,
      botName: params.botName,
      botUrl: params.botUrl,
      debounceUntil: debounceUntil.toISOString(),
      messageIds,
    };

    if (existingEvent) {
      existingEvent.payload = payload;
      await this.makeSyncEventsRepository.save(existingEvent);

      this.logger.log(
        `Updated aggregation event clientId=${params.clientId} channel=${params.channel} botId=${params.botId ?? 'none'} makeSyncEventId=${existingEvent.id}`,
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
      `Created aggregation event clientId=${params.clientId} channel=${params.channel} botId=${params.botId ?? 'none'} makeSyncEventId=${savedEvent.id}`,
    );
  }

  async buildPendingPayload(params: {
    clientId: string;
    channel: Channel;
    messageIds?: string[];
  }): Promise<Record<string, unknown>> {
    return this.clientMakePayloadService.build(params);
  }

  private findPendingEvent(params: {
    clientId: string;
    channel: Channel;
    botId?: string;
  }): Promise<MakeSyncEvent | null> {
    return this.makeSyncEventsRepository.findOne({
      where: {
        clientId: params.clientId,
        status: MakeSyncStatus.PENDING,
        sentAt: IsNull(),
        payload: Raw(
          (alias) =>
            [
              `${quoteRawAlias(alias)}->>'channel' = :channel`,
              `COALESCE(${quoteRawAlias(alias)}->>'botId', '') = :botId`,
            ].join(' AND '),
          {
            channel: params.channel,
            botId: params.botId ?? '',
          },
        ),
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
}
