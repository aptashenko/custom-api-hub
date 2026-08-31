import { Injectable } from '@nestjs/common';

import { Channel, MessageDirection } from '../../typeorm/entities/enums';
import { NormalizedEvent } from '../types/normalized-event.type';

@Injectable()
export class SendPulseNormalizer {
  normalize(payload: unknown, rawEventId?: string): NormalizedEvent {
    const eventPayload = this.selectEventPayload(payload);
    const eventType =
      this.getString(eventPayload, ['event']) ??
      this.getString(eventPayload, ['event_type']) ??
      this.getString(eventPayload, ['type']) ??
      this.getString(eventPayload, ['action']) ??
      this.getString(eventPayload, ['title']) ??
      'unknown';
    const normalizedEventType = eventType.toLowerCase();
    const isIncomingEvent = normalizedEventType === 'incoming_message';
    const isOutgoingEvent = normalizedEventType === 'outgoing_message';

    const externalUserId =
      this.getString(eventPayload, ['contact', 'telegram_id']) ??
      this.getString(eventPayload, ['contact', 'id']) ??
      this.getString(eventPayload, ['contact_id']) ??
      this.getString(eventPayload, ['subscriber', 'id']) ??
      this.getString(eventPayload, ['user', 'id']) ??
      this.getString(eventPayload, ['telegram_id']) ??
      this.getString(eventPayload, ['telegramId']);

    const externalMessageId =
      this.getString(eventPayload, ['message', 'id']) ??
      this.getString(eventPayload, ['message_id']) ??
      this.getString(eventPayload, [
        'info',
        'message',
        'channel_data',
        'message_id',
      ]) ??
      this.getString(eventPayload, [
        'contact',
        'last_message_data',
        'message_id',
      ]);

    const directMessageText =
      this.getString(eventPayload, ['message', 'text']) ??
      this.getString(eventPayload, [
        'info',
        'message',
        'channel_data',
        'message',
        'text',
      ]);
    const incomingLastMessageText = isIncomingEvent
      ? this.getString(eventPayload, [
          'contact',
          'last_message_data',
          'message',
          'text',
        ]) ??
        this.getString(eventPayload, ['contact', 'last_message'])
      : undefined;
    const messageText =
      directMessageText ??
      incomingLastMessageText ??
      this.getString(eventPayload, ['message']) ??
      this.getString(eventPayload, ['text']);

    const direction =
      isOutgoingEvent ||
      this.getString(eventPayload, ['direction'])?.toLowerCase() === 'out'
        ? MessageDirection.OUT
        : MessageDirection.IN;

    return {
      source: 'sendpulse',
      channel: this.detectChannel(eventPayload),
      eventType,
      externalUserId,
      externalMessageId,
      sourceBot: this.extractBot(eventPayload),
      client: {
        name:
          this.getString(eventPayload, ['contact', 'name']) ??
          this.getString(eventPayload, ['contact', 'variables', 'name']) ??
          this.getString(eventPayload, ['name']) ??
          this.getString(eventPayload, ['user', 'name']),
        phone:
          this.getString(eventPayload, ['contact', 'phone']) ??
          this.getString(eventPayload, ['contact', 'variables', 'phone']) ??
          this.getString(eventPayload, ['contact', 'variables', 'Phone']) ??
          this.getString(eventPayload, ['phone']),
        email:
          this.getString(eventPayload, ['contact', 'email']) ??
          this.getString(eventPayload, ['contact', 'variables', 'email']) ??
          this.getString(eventPayload, ['contact', 'variables', 'Email']) ??
          this.getString(eventPayload, ['email']),
        username:
          this.getString(eventPayload, ['contact', 'username']) ??
          this.getString(eventPayload, ['username']) ??
          this.getString(eventPayload, ['user', 'username']),
      },
      message: messageText
        ? {
            text: messageText,
            direction,
          }
        : undefined,
      utm: this.extractUtm(eventPayload),
      rawEventId,
      raw: payload,
    };
  }

  private selectEventPayload(payload: unknown): unknown {
    if (!Array.isArray(payload)) {
      return payload;
    }

    return (
      payload.find(
        (item) => this.getString(item, ['title']) === 'incoming_message',
      ) ??
      payload.find(
        (item) =>
          this.getString(item, [
            'info',
            'message',
            'channel_data',
            'message',
            'text',
          ]) !== undefined,
      ) ??
      payload[0] ??
      payload
    );
  }

  private detectChannel(payload: unknown): Channel {
    const channel = (
      this.getString(payload, ['channel']) ??
      this.getString(payload, ['bot', 'channel']) ??
      this.getString(payload, ['service'])
    )?.toLowerCase();

    if (channel?.includes('telegram')) {
      return Channel.TELEGRAM;
    }

    if (channel?.includes('whatsapp')) {
      return Channel.WHATSAPP;
    }

    if (channel?.includes('instagram')) {
      return Channel.INSTAGRAM;
    }

    return Channel.SENDPULSE;
  }

  private extractBot(payload: unknown): NormalizedEvent['sourceBot'] {
    const bot = {
      id: this.getString(payload, ['bot', 'id']),
      name:
        this.getString(payload, ['bot', 'name']) ??
        this.getString(payload, ['bot', 'username']),
      url: this.getString(payload, ['bot', 'url']),
    };

    if (!bot.id && !bot.name && !bot.url) {
      return undefined;
    }

    return bot;
  }

  private extractUtm(payload: unknown): NormalizedEvent['utm'] {
    const utm = {
      source:
        this.getString(payload, ['utm_source']) ??
        this.getString(payload, ['variables', 'utm_source']) ??
        this.getString(payload, ['contact', 'variables', 'utm_source']) ??
        this.getVariableString(payload, 'utm_source') ??
        this.getVariableString(this.getValue(payload, ['contact']), 'utm_source'),
      medium:
        this.getString(payload, ['utm_medium']) ??
        this.getString(payload, ['variables', 'utm_medium']) ??
        this.getString(payload, ['contact', 'variables', 'utm_medium']) ??
        this.getVariableString(payload, 'utm_medium') ??
        this.getVariableString(this.getValue(payload, ['contact']), 'utm_medium'),
      campaign:
        this.getString(payload, ['utm_campaign']) ??
        this.getString(payload, ['variables', 'utm_campaign']) ??
        this.getString(payload, ['contact', 'variables', 'utm_campaign']) ??
        this.getVariableString(payload, 'utm_campaign') ??
        this.getVariableString(
          this.getValue(payload, ['contact']),
          'utm_campaign',
        ),
      content:
        this.getString(payload, ['utm_content']) ??
        this.getString(payload, ['variables', 'utm_content']) ??
        this.getString(payload, ['contact', 'variables', 'utm_content']) ??
        this.getVariableString(payload, 'utm_content') ??
        this.getVariableString(
          this.getValue(payload, ['contact']),
          'utm_content',
        ),
      term:
        this.getString(payload, ['utm_term']) ??
        this.getString(payload, ['variables', 'utm_term']) ??
        this.getString(payload, ['contact', 'variables', 'utm_term']) ??
        this.getVariableString(payload, 'utm_term') ??
        this.getVariableString(this.getValue(payload, ['contact']), 'utm_term'),
    };

    return Object.values(utm).some((value) => value !== undefined)
      ? utm
      : undefined;
  }

  private getVariableString(payload: unknown, name: string): string | undefined {
    const variables = this.getValue(payload, ['variables']);

    if (!Array.isArray(variables)) {
      return undefined;
    }

    for (const variable of variables) {
      const variableName =
        this.getString(variable, ['name']) ??
        this.getString(variable, ['key']) ??
        this.getString(variable, ['variable']);

      if (variableName !== name) {
        continue;
      }

      const value =
        this.getString(variable, ['value']) ??
        this.getString(variable, ['val']) ??
        this.getString(variable, ['text']);

      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private getValue(payload: unknown, path: string[]): unknown {
    let current = payload;

    for (const key of path) {
      if (!this.isRecord(current)) {
        return undefined;
      }

      current = current[key];
    }

    return current;
  }

  private getString(payload: unknown, path: string[]): string | undefined {
    const current = this.getValue(payload, path);

    if (typeof current === 'string' && current.length > 0) {
      return current;
    }

    if (typeof current === 'number' || typeof current === 'boolean') {
      return String(current);
    }

    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
