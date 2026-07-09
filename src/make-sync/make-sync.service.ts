import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Raw, Repository } from 'typeorm';

import { AggregationService } from '../aggregation/aggregation.service';
import { MakeService } from '../integrations/make/make.service';
import { Channel, MakeSyncStatus } from '../typeorm/entities/enums';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';

export interface MakeSyncResult {
  processed: number;
  sent: number;
  failed: number;
}

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
export class MakeSyncService {
  private readonly logger = new Logger(MakeSyncService.name);

  constructor(
    @InjectRepository(MakeSyncEvent)
    private readonly makeSyncEventsRepository: Repository<MakeSyncEvent>,
    private readonly aggregationService: AggregationService,
    private readonly makeService: MakeService,
  ) {}

  async processPending(): Promise<MakeSyncResult> {
    const now = new Date();
    const events = await this.makeSyncEventsRepository.find({
      where: {
        status: MakeSyncStatus.PENDING,
        sentAt: IsNull(),
        payload: Raw(
          (alias) =>
            `(${quoteRawAlias(alias)}->>'debounceUntil')::timestamptz <= :now`,
          {
            now: now.toISOString(),
          },
        ),
      },
      order: {
        updatedAt: 'ASC',
      },
    });
    const result: MakeSyncResult = {
      processed: 0,
      sent: 0,
      failed: 0,
    };

    for (const event of events) {
      if (!this.isDue(event, now)) {
        continue;
      }

      const eventResult = await this.processEvent(event, now);

      result.processed += eventResult.processed;
      result.sent += eventResult.sent;
      result.failed += eventResult.failed;
    }

    return result;
  }

  async retry(id: string): Promise<MakeSyncResult> {
    const event = await this.makeSyncEventsRepository.findOne({
      where: {
        id,
      },
    });

    if (!event) {
      throw new NotFoundException(`MakeSyncEvent ${id} was not found`);
    }

    event.status = MakeSyncStatus.PENDING;
    event.error = null;
    await this.makeSyncEventsRepository.save(event);

    this.logger.log(`Reset make sync event makeSyncEventId=${event.id} status=PENDING`);

    const now = new Date();

    if (!this.isDue(event, now)) {
      return {
        processed: 0,
        sent: 0,
        failed: 0,
      };
    }

    return this.processEvent(event, now);
  }

  private async processEvent(
    event: MakeSyncEvent,
    now: Date,
  ): Promise<MakeSyncResult> {
    const result: MakeSyncResult = {
      processed: 1,
      sent: 0,
      failed: 0,
    };

    try {
      const clientId = this.getClientId(event);
      const channel = this.getChannel(event);
      const messageIds = this.getMessageIds(event.payload);
      const finalPayload = await this.aggregationService.buildPendingPayload({
        clientId,
        channel,
        messageIds,
      });

      await this.makeService.sendPayload(finalPayload);

      event.status = MakeSyncStatus.SENT;
      event.sentAt = now;
      event.payload = finalPayload;
      event.error = null;
      await this.makeSyncEventsRepository.save(event);

      this.logger.log(
        `Delivered make sync event makeSyncEventId=${event.id} status=SENT`,
      );
      result.sent = 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      event.status = MakeSyncStatus.FAILED;
      event.error = message;
      await this.makeSyncEventsRepository.save(event);

      this.logger.error(
        `Failed make sync event makeSyncEventId=${event.id} status=FAILED error=${message}`,
      );
      result.failed = 1;
    }

    return result;
  }

  private isDue(event: MakeSyncEvent, now: Date): boolean {
    const debounceUntil = this.getPayloadString(event.payload, 'debounceUntil');

    if (!debounceUntil) {
      return false;
    }

    const debounceUntilTime = new Date(debounceUntil).getTime();

    return Number.isFinite(debounceUntilTime) && debounceUntilTime <= now.getTime();
  }

  private getClientId(event: MakeSyncEvent): string {
    if (event.clientId) {
      return event.clientId;
    }

    const clientId = this.getPayloadString(event.payload, 'clientId');

    if (!clientId) {
      throw new Error('MakeSyncEvent is missing clientId');
    }

    return clientId;
  }

  private getChannel(event: MakeSyncEvent): Channel {
    const channel = this.getPayloadString(event.payload, 'channel');

    if (this.isChannel(channel)) {
      return channel;
    }

    throw new Error('MakeSyncEvent is missing valid channel');
  }

  private getPayloadString(payload: unknown, key: string): string | undefined {
    if (!this.isRecord(payload)) {
      return undefined;
    }

    const value = payload[key];

    return typeof value === 'string' ? value : undefined;
  }

  private getMessageIds(payload: unknown): string[] {
    if (!this.isRecord(payload) || !Array.isArray(payload.messageIds)) {
      return [];
    }

    return payload.messageIds.filter(
      (messageId): messageId is string => typeof messageId === 'string',
    );
  }

  private isChannel(value: unknown): value is Channel {
    return (
      typeof value === 'string' &&
      Object.values(Channel).includes(value as Channel)
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
