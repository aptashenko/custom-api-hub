import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { normalizePhone } from '../../common/phone-normalizer';
import { Client } from '../../typeorm/entities/client.entity';
import { ContactIdentity } from '../../typeorm/entities/contact-identity.entity';
import { SendPulseContact } from '../../typeorm/entities/sendpulse-contact.entity';

interface UpsertSendPulseProfileOptions {
  client: Client;
  identity?: ContactIdentity;
}

interface SendPulseWebhookProfile {
  exportKey: string;
  botId?: string;
  contactId: string;
  tags?: unknown[] | null;
  variables?: Record<string, unknown> | null;
  rawContact: Record<string, unknown>;
  rawProfile: Record<string, unknown>;
  name?: string;
  phone?: string;
  email?: string;
  username?: string;
}

@Injectable()
export class SendPulseProfilesService {
  private readonly logger = new Logger(SendPulseProfilesService.name);

  constructor(
    @InjectRepository(SendPulseContact)
    private readonly sendPulseContactsRepository: Repository<SendPulseContact>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(ContactIdentity)
    private readonly identitiesRepository: Repository<ContactIdentity>,
  ) {}

  async upsertFromWebhookPayload(
    payload: unknown,
    options: UpsertSendPulseProfileOptions,
  ): Promise<SendPulseContact | undefined> {
    const profile = this.extractWebhookProfile(payload);

    if (!profile) {
      return undefined;
    }

    await this.updateClient(options.client, profile);

    if (options.identity) {
      await this.updateIdentity(options.identity, options.client, profile);
    }

    const existing = await this.sendPulseContactsRepository.findOne({
      where: {
        exportKey: profile.exportKey,
      },
    });
    const sendPulseContact =
      existing ??
      this.sendPulseContactsRepository.create({
        exportKey: profile.exportKey,
        rawDialogs: [],
        dialogIds: [],
      });

    sendPulseContact.clientId = options.client.id;
    sendPulseContact.contactIdentityId = options.identity?.id ?? null;
    sendPulseContact.botId = profile.botId;
    sendPulseContact.contactId = profile.contactId;
    sendPulseContact.tags = profile.tags;
    sendPulseContact.variables = profile.variables;
    sendPulseContact.rawContact = profile.rawContact;
    sendPulseContact.rawProfile = profile.rawProfile;
    sendPulseContact.sourceFile = 'sendpulse-webhook';

    const saved = await this.sendPulseContactsRepository.save(sendPulseContact);

    this.logger.log(
      `Upserted SendPulse profile contactId=${profile.contactId} botId=${profile.botId ?? 'unknown'} tags=${profile.tags?.length ?? 0} variables=${Object.keys(profile.variables ?? {}).length}`,
    );

    return saved;
  }

  private async updateClient(
    client: Client,
    profile: SendPulseWebhookProfile,
  ): Promise<void> {
    let updated = false;
    const phoneNormalized = normalizePhone(profile.phone);

    if (!client.name && profile.name) {
      client.name = profile.name;
      updated = true;
    }

    if (!client.phone && profile.phone) {
      client.phone = profile.phone;
      updated = true;
    }

    if (!client.phoneNormalized && phoneNormalized) {
      client.phoneNormalized = phoneNormalized;
      updated = true;
    }

    if (!client.email && profile.email) {
      client.email = profile.email;
      updated = true;
    }

    if (updated) {
      await this.clientsRepository.save(client);
    }
  }

  private async updateIdentity(
    identity: ContactIdentity,
    client: Client,
    profile: SendPulseWebhookProfile,
  ): Promise<void> {
    let updated = false;
    const phoneNormalized = normalizePhone(profile.phone);

    if (identity.clientId !== client.id) {
      identity.clientId = client.id;
      updated = true;
    }

    if (!identity.username && profile.username) {
      identity.username = profile.username;
      updated = true;
    }

    if (!identity.phone && profile.phone) {
      identity.phone = profile.phone;
      updated = true;
    }

    if (!identity.phoneNormalized && phoneNormalized) {
      identity.phoneNormalized = phoneNormalized;
      updated = true;
    }

    if (!identity.email && profile.email) {
      identity.email = profile.email;
      updated = true;
    }

    if (updated) {
      await this.identitiesRepository.save(identity);
    }
  }

  private extractWebhookProfile(
    payload: unknown,
  ): SendPulseWebhookProfile | undefined {
    const eventPayload = this.selectWebhookPayload(payload);
    const contact = this.getRecord(eventPayload.contact);
    const contactId = this.getString(contact?.id);

    if (!contact || !contactId) {
      return undefined;
    }

    const bot = this.getRecord(eventPayload.bot);
    const botId = this.getString(bot?.id);
    const variables = this.getRecord(contact.variables);
    const tags = this.getUnknownArray(contact.tags);

    return {
      exportKey: this.buildContactKey(botId, contactId),
      botId,
      contactId,
      tags: tags ?? null,
      variables: variables ?? null,
      rawContact: contact,
      rawProfile: eventPayload,
      name: this.firstString([
        this.getString(contact.name),
        this.getString(contact.full_name),
        this.getString(variables?.name),
      ]),
      phone: this.firstString([
        this.getString(contact.phone),
        this.getString(variables?.phone),
        this.getString(variables?.Phone),
      ]),
      email: this.firstString([
        this.getString(contact.email),
        this.getString(variables?.email),
        this.getString(variables?.Email),
      ]),
      username: this.firstString([
        this.getString(contact.username),
        this.getString(contact.telegram_username),
      ]),
    };
  }

  private selectWebhookPayload(payload: unknown): Record<string, unknown> {
    if (Array.isArray(payload)) {
      const eventPayload = payload.find(
        (item): item is Record<string, unknown> =>
          this.isRecord(item) && this.isRecord(item.contact),
      );

      return eventPayload ?? {};
    }

    return this.getRecord(payload) ?? {};
  }

  private buildContactKey(botId: string | undefined, contactId: string): string {
    return botId ? `${botId}:${contactId}` : `contact:${contactId}`;
  }

  private firstString(values: Array<string | undefined>): string | undefined {
    return values.find((value) => value !== undefined);
  }

  private getString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }

  private getUnknownArray(value: unknown): unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
  }

  private getRecord(value: unknown): Record<string, unknown> | undefined {
    return this.isRecord(value) ? value : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
