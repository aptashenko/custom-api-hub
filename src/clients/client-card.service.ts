import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Client } from '../typeorm/entities/client.entity';
import { ContactIdentity } from '../typeorm/entities/contact-identity.entity';
import { LeadSource } from '../typeorm/entities/lead-source.entity';
import { Message } from '../typeorm/entities/message.entity';
import { SendPulseContact } from '../typeorm/entities/sendpulse-contact.entity';

export interface ClientCard {
  id: string;
  clientNumber: number;
  profile: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  sendPulse?: {
    contactId?: string | null;
    botId?: string | null;
    botName?: string | null;
    pipeline: number | null;
    tags?: unknown[] | null;
    variables?: Record<string, unknown> | null;
    rawContact?: unknown;
  };
  activity: {
    messageCount: number;
    lastMessageText?: string | null;
    lastMessageAt?: string | null;
  };
  identities: Array<{
    channel: string;
    externalId: string;
    username?: string | null;
    phone?: string | null;
    email?: string | null;
  }>;
  leadSources: Array<{
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
    referrer?: string | null;
    landingPage?: string | null;
    createdAt: string;
  }>;
  recentMessages: Array<{
    id: string;
    channel: string;
    direction: string;
    text?: string | null;
    externalMessageId?: string | null;
    createdAt: string;
  }>;
}

@Injectable()
export class ClientCardService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(ContactIdentity)
    private readonly identitiesRepository: Repository<ContactIdentity>,
    @InjectRepository(SendPulseContact)
    private readonly sendPulseContactsRepository: Repository<SendPulseContact>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(LeadSource)
    private readonly leadSourcesRepository: Repository<LeadSource>,
  ) {}

  async getCard(clientRef: string): Promise<ClientCard> {
    const client = await this.findClient(clientRef);

    if (!client) {
      throw new NotFoundException(`Client ${clientRef} was not found`);
    }

    const [identities, sendPulseContact, recentMessages, messageCount, leadSources] =
      await Promise.all([
        this.identitiesRepository.find({
          where: {
            clientId: client.id,
          },
          order: {
            createdAt: 'DESC',
          },
        }),
        this.sendPulseContactsRepository.findOne({
          where: {
            clientId: client.id,
          },
          order: {
            updatedAt: 'DESC',
          },
        }),
        this.messagesRepository.find({
          where: {
            clientId: client.id,
          },
          order: {
            createdAt: 'DESC',
          },
          take: 10,
        }),
        this.messagesRepository.count({
          where: {
            clientId: client.id,
          },
        }),
        this.leadSourcesRepository.find({
          where: {
            clientId: client.id,
          },
          order: {
            createdAt: 'DESC',
          },
        }),
      ]);
    const primaryIdentity = identities[0];
    const lastMessage = recentMessages[0];

    return {
      id: client.id,
      clientNumber: client.clientNumber,
      profile: {
        name: this.firstString([
          client.name,
          this.getRawContactString(sendPulseContact, 'name'),
          this.getRawContactString(sendPulseContact, 'full_name'),
        ]),
        phone: this.firstString([
          client.phone,
          primaryIdentity?.phone,
          this.getVariableString(sendPulseContact, 'phone'),
          this.getVariableString(sendPulseContact, 'Phone'),
        ]),
        email: this.firstString([
          client.email,
          primaryIdentity?.email,
          this.getVariableString(sendPulseContact, 'email'),
          this.getVariableString(sendPulseContact, 'Email'),
        ]),
        username: this.firstString([
          primaryIdentity?.username,
          this.getRawContactString(sendPulseContact, 'username'),
        ]),
        avatarUrl: this.getRawContactString(sendPulseContact, 'profile_pic'),
      },
      sendPulse: sendPulseContact
        ? {
            contactId: sendPulseContact.contactId,
            botId: sendPulseContact.botId,
            botName: this.resolveBotName(sendPulseContact),
            pipeline: this.resolvePipeline(sendPulseContact.botId),
            tags: sendPulseContact.tags,
            variables: sendPulseContact.variables,
            rawContact: sendPulseContact.rawContact,
          }
        : undefined,
      activity: {
        messageCount,
        lastMessageText: lastMessage?.text,
        lastMessageAt: lastMessage?.createdAt.toISOString(),
      },
      identities: identities.map((identity) => ({
        channel: identity.channel,
        externalId: identity.externalId,
        username: identity.username,
        phone: identity.phone,
        email: identity.email,
      })),
      leadSources: leadSources.map((leadSource) => ({
        utmSource: leadSource.utmSource,
        utmMedium: leadSource.utmMedium,
        utmCampaign: leadSource.utmCampaign,
        utmContent: leadSource.utmContent,
        utmTerm: leadSource.utmTerm,
        referrer: leadSource.referrer,
        landingPage: leadSource.landingPage,
        createdAt: leadSource.createdAt.toISOString(),
      })),
      recentMessages: recentMessages.map((message) => ({
        id: message.id,
        channel: message.channel,
        direction: message.direction,
        text: message.text,
        externalMessageId: message.externalMessageId,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  private findClient(clientRef: string): Promise<Client | null> {
    if (/^\d+$/.test(clientRef)) {
      return this.clientsRepository.findOne({
        where: {
          clientNumber: Number(clientRef),
        },
      });
    }

    return this.clientsRepository.findOne({
      where: {
        id: clientRef,
      },
    });
  }

  private resolvePipeline(botId: string | null | undefined): number | null {
    if (botId === '69df44b16c587fdcb809deb0') {
      return 12403487;
    }

    if (botId === '6a3919e3dbfd2064c50e1c36') {
      return 12403591;
    }

    return null;
  }

  private resolveBotName(
    sendPulseContact: SendPulseContact | null,
  ): string | null {
    if (!this.isRecord(sendPulseContact?.rawProfile)) {
      return null;
    }

    const bot = this.getRecord(sendPulseContact.rawProfile.bot);

    return (
      this.getString(bot?.name) ?? this.getString(bot?.username) ?? null
    );
  }

  private getRawContactString(
    sendPulseContact: SendPulseContact | null,
    key: string,
  ): string | undefined {
    if (!this.isRecord(sendPulseContact?.rawContact)) {
      return undefined;
    }

    return this.getString(sendPulseContact.rawContact[key]);
  }

  private getRecord(value: unknown): Record<string, unknown> | undefined {
    return this.isRecord(value) ? value : undefined;
  }

  private getVariableString(
    sendPulseContact: SendPulseContact | null,
    key: string,
  ): string | undefined {
    if (!sendPulseContact?.variables) {
      return undefined;
    }

    return this.getString(sendPulseContact.variables[key]);
  }

  private firstString(
    values: Array<string | null | undefined>,
  ): string | null {
    return values.find((value) => Boolean(value)) ?? null;
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
