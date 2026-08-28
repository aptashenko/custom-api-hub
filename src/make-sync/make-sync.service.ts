import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Raw, Repository } from 'typeorm';

import { AggregationService } from '../aggregation/aggregation.service';
import { MakeService } from '../integrations/make/make.service';
import {
  Channel,
  MessageDirection,
  MakeSyncStatus,
  MakeWebhookLogStatus,
} from '../typeorm/entities/enums';
import { MakeSyncEvent } from '../typeorm/entities/make-sync-event.entity';
import { MakeWebhookLog } from '../typeorm/entities/make-webhook-log.entity';

export interface MakeSyncResult {
  processed: number;
  sent: number;
  failed: number;
}

const DEFAULT_AUTO_PROCESS_INTERVAL_MS = 10_000;

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
export class MakeSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MakeSyncService.name);
  private autoProcessTimer?: NodeJS.Timeout;
  private autoProcessRunning = false;

  constructor(
    @InjectRepository(MakeSyncEvent)
    private readonly makeSyncEventsRepository: Repository<MakeSyncEvent>,
    @InjectRepository(MakeWebhookLog)
    private readonly makeWebhookLogsRepository: Repository<MakeWebhookLog>,
    private readonly aggregationService: AggregationService,
    private readonly makeService: MakeService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.getAutoProcessIntervalMs();

    this.autoProcessTimer = setInterval(() => {
      void this.processPendingSafely();
    }, intervalMs);

    this.logger.log(
      `Started make sync auto processor intervalMs=${intervalMs}`,
    );
  }

  onModuleDestroy(): void {
    if (this.autoProcessTimer) {
      clearInterval(this.autoProcessTimer);
      this.autoProcessTimer = undefined;
    }
  }

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

  private async processPendingSafely(): Promise<void> {
    if (this.autoProcessRunning) {
      return;
    }

    this.autoProcessRunning = true;

    try {
      const result = await this.processPending();

      if (result.processed > 0) {
        this.logger.log(
          `Auto processed make sync events processed=${result.processed} sent=${result.sent} failed=${result.failed}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Auto make sync processing failed error=${message}`);
    } finally {
      this.autoProcessRunning = false;
    }
  }

  private getAutoProcessIntervalMs(): number {
    const configuredInterval = Number(
      this.configService.get<string>('MAKE_SYNC_PROCESS_INTERVAL_MS'),
    );

    if (Number.isFinite(configuredInterval) && configuredInterval > 0) {
      return configuredInterval;
    }

    return DEFAULT_AUTO_PROCESS_INTERVAL_MS;
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
    let makeWebhookLog: MakeWebhookLog | undefined;

    try {
      const clientId = this.getClientId(event);
      const channel = this.getChannel(event);
      const messageIds = this.getMessageIds(event.payload);
      const finalPayload = this.applyEventBotContext(
        await this.aggregationService.buildPendingPayload({
          clientId,
          channel,
          messageIds,
        }),
        event.payload,
      );

      if (!this.hasClientReply(finalPayload)) {
        event.status = MakeSyncStatus.SENT;
        event.sentAt = now;
        event.payload = finalPayload;
        event.error = null;
        await this.makeSyncEventsRepository.save(event);

        this.logger.log(
          `Skipped make sync event without client reply makeSyncEventId=${event.id} status=SENT`,
        );
        return result;
      }

      makeWebhookLog = await this.createMakeWebhookLog({
        event,
        payload: finalPayload,
        attemptedAt: now,
        clientId,
        channel,
      });

      await this.makeService.sendPayload(finalPayload);

      makeWebhookLog.status = MakeWebhookLogStatus.SENT;
      makeWebhookLog.completedAt = now;
      makeWebhookLog.error = null;
      await this.makeWebhookLogsRepository.save(makeWebhookLog);

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

      if (makeWebhookLog) {
        makeWebhookLog.status = MakeWebhookLogStatus.FAILED;
        makeWebhookLog.completedAt = now;
        makeWebhookLog.error = message;
        await this.makeWebhookLogsRepository.save(makeWebhookLog);
      }

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

  private hasClientReply(payload: Record<string, unknown>): boolean {
    if (!Array.isArray(payload.messages)) {
      return false;
    }

    return payload.messages.some((message) => {
      if (!this.isRecord(message)) {
        return false;
      }

      return (
        message.direction === MessageDirection.IN || message.sender === 'CLIENT'
      );
    });
  }

  private applyEventBotContext(
    finalPayload: Record<string, unknown>,
    eventPayload: unknown,
  ): Record<string, unknown> {
    if (!this.isRecord(eventPayload)) {
      return finalPayload;
    }

    const botId = this.getPayloadString(eventPayload, 'botId');
    const botName = this.getPayloadString(eventPayload, 'botName');
    const botUrl = this.getPayloadString(eventPayload, 'botUrl');

    if (!botId && !botName && !botUrl) {
      return finalPayload;
    }

    const payload = {
      ...finalPayload,
      botId: botId ?? finalPayload.botId ?? null,
      botName: botName ?? finalPayload.botName ?? null,
      botUrl: botUrl ?? finalPayload.botUrl ?? null,
    };
    const clientCard = this.getRecord(payload, 'clientCard');
    const sendPulse = this.getRecord(clientCard, 'sendPulse');

    if (!clientCard || !sendPulse) {
      return payload;
    }

    return {
      ...payload,
      clientCard: {
        ...clientCard,
        sendPulse: {
          ...sendPulse,
          botId: botId ?? sendPulse.botId ?? null,
          botName: botName ?? sendPulse.botName ?? null,
          botUrl: botUrl ?? sendPulse.botUrl ?? null,
        },
      },
    };
  }

  private async createMakeWebhookLog(params: {
    event: MakeSyncEvent;
    payload: Record<string, unknown>;
    attemptedAt: Date;
    clientId: string;
    channel: Channel;
  }): Promise<MakeWebhookLog> {
    const client = this.getRecord(params.payload, 'client');
    const clientCard = this.getRecord(params.payload, 'clientCard');
    const profile = this.getRecord(clientCard, 'profile');
    const searchableUser = {
      clientNumber: this.getValue(clientCard, 'clientNumber'),
      name: this.getValue(client, 'name') ?? this.getValue(profile, 'name'),
      phone: this.getValue(client, 'phone') ?? this.getValue(profile, 'phone'),
      email: this.getValue(client, 'email') ?? this.getValue(profile, 'email'),
      username: this.getValue(profile, 'username'),
    };

    this.logger.log(
      [
        'Make webhook outbound',
        `makeSyncEventId=${params.event.id}`,
        `attemptedAt=${params.attemptedAt.toISOString()}`,
        `clientId=${params.clientId}`,
        `clientNumber=${this.formatLogValue(searchableUser.clientNumber)}`,
        `name=${this.formatLogValue(searchableUser.name)}`,
        `phone=${this.formatLogValue(searchableUser.phone)}`,
        `email=${this.formatLogValue(searchableUser.email)}`,
        `username=${this.formatLogValue(searchableUser.username)}`,
        `channel=${params.channel}`,
        `payload=${JSON.stringify(params.payload)}`,
      ].join(' '),
    );

    return this.makeWebhookLogsRepository.save(
      this.makeWebhookLogsRepository.create({
        makeSyncEventId: params.event.id,
        clientId: params.clientId,
        clientNumber: this.toNumberOrNull(searchableUser.clientNumber),
        name: this.toStringOrNull(searchableUser.name),
        phone: this.toStringOrNull(searchableUser.phone),
        email: this.toStringOrNull(searchableUser.email),
        username: this.toStringOrNull(searchableUser.username),
        channel: params.channel,
        status: MakeWebhookLogStatus.PENDING,
        payload: params.payload,
        attemptedAt: params.attemptedAt,
        completedAt: null,
        error: null,
      }),
    );
  }

  private getRecord(
    value: Record<string, unknown> | undefined,
    key: string,
  ): Record<string, unknown> | undefined {
    if (!value) {
      return undefined;
    }

    const nested = value[key];

    return this.isRecord(nested) ? nested : undefined;
  }

  private getValue(
    value: Record<string, unknown> | undefined,
    key: string,
  ): string | number | undefined {
    if (!value) {
      return undefined;
    }

    const nested = value[key];

    if (typeof nested === 'string' || typeof nested === 'number') {
      return nested;
    }

    return undefined;
  }

  private formatLogValue(value: string | number | undefined): string {
    if (value === undefined || value === null || value === '') {
      return 'unknown';
    }

    return JSON.stringify(value);
  }

  private toStringOrNull(value: string | number | undefined): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return String(value);
  }

  private toNumberOrNull(value: string | number | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
