import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { normalizePhone } from '../common/phone-normalizer';
import { NormalizedEvent } from '../events/types/normalized-event.type';
import { Client } from '../typeorm/entities/client.entity';
import { ContactIdentity } from '../typeorm/entities/contact-identity.entity';

@Injectable()
export class ClientResolverService {
  private readonly logger = new Logger(ClientResolverService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(ContactIdentity)
    private readonly identitiesRepository: Repository<ContactIdentity>,
  ) {}

  async resolveFromEvent(event: NormalizedEvent): Promise<{
    client: Client;
    identity?: ContactIdentity;
  }> {
    let identity: ContactIdentity | null = null;
    let client: Client | null = null;
    let clientResolution: 'found' | 'created' = 'found';
    let identityResolution: 'found' | 'created' | 'moved' | 'none' = 'none';
    const phoneNormalized = normalizePhone(event.client.phone);

    if (event.externalUserId) {
      identity = await this.findIdentity(event, event.externalUserId);

      if (identity) {
        client = identity.client;
        identityResolution = 'found';

        if (phoneNormalized) {
          const phoneClient = await this.findClientByPhoneNormalized(
            phoneNormalized,
          );

          if (phoneClient && phoneClient.id !== client.id) {
            client = phoneClient;
            identity.clientId = phoneClient.id;
            identity.client = phoneClient;
            this.applyIdentityFields(identity, event, phoneNormalized);
            identity = await this.identitiesRepository.save(identity);
            identityResolution = 'moved';
          }
        }
      }
    }

    if (!client && phoneNormalized) {
      client = await this.findClientByPhoneNormalized(phoneNormalized);
    }

    if (!client && event.client.phone) {
      client = await this.findClientByPhone(event.client.phone);
    }

    if (!client && event.client.email) {
      client = await this.clientsRepository.findOne({
        where: {
          email: event.client.email,
        },
      });
    }

    if (!client) {
      client = await this.createClient(event, phoneNormalized);
      clientResolution = 'created';
    } else {
      client = await this.applyClientFields(client, event, phoneNormalized);
    }

    if (event.externalUserId && !identity) {
      identity = await this.createIdentity(
        event,
        client,
        event.externalUserId,
        phoneNormalized,
      );
      identityResolution = 'created';
    } else if (identity && identityResolution !== 'moved') {
      if (this.applyIdentityFields(identity, event, phoneNormalized)) {
        identity = await this.identitiesRepository.save(identity);
      }
    }

    this.logger.log(
      `Resolved client clientId=${client.id} clientResolution=${clientResolution} identityResolution=${identityResolution} identityId=${identity?.id ?? 'none'}`,
    );

    return {
      client,
      identity: identity ?? undefined,
    };
  }

  private findClientByPhoneNormalized(
    phoneNormalized: string,
  ): Promise<Client | null> {
    return this.clientsRepository.findOne({
      where: {
        phoneNormalized,
      },
    });
  }

  private findClientByPhone(phone: string): Promise<Client | null> {
    return this.clientsRepository.findOne({
      where: {
        phone,
      },
    });
  }

  private findIdentity(
    event: NormalizedEvent,
    externalUserId: string,
  ): Promise<ContactIdentity | null> {
    return this.identitiesRepository.findOne({
      where: {
        channel: event.channel,
        externalId: externalUserId,
      },
      relations: {
        client: true,
      },
    });
  }

  private createClient(
    event: NormalizedEvent,
    phoneNormalized: string | undefined,
  ): Promise<Client> {
    const client = this.clientsRepository.create({
      name: event.client.name,
      phone: event.client.phone,
      phoneNormalized,
      email: event.client.email,
    });

    return this.clientsRepository.save(client);
  }

  private createIdentity(
    event: NormalizedEvent,
    client: Client,
    externalUserId: string,
    phoneNormalized: string | undefined,
  ): Promise<ContactIdentity> {
    const identity = this.identitiesRepository.create({
      clientId: client.id,
      channel: event.channel,
      externalId: externalUserId,
      username: event.client.username,
      phone: event.client.phone,
      phoneNormalized,
      email: event.client.email,
    });

    return this.identitiesRepository.save(identity);
  }

  private async applyClientFields(
    client: Client,
    event: NormalizedEvent,
    phoneNormalized: string | undefined,
  ): Promise<Client> {
    let updated = false;

    if (!client.name && event.client.name) {
      client.name = event.client.name;
      updated = true;
    }

    if (!client.phone && event.client.phone) {
      client.phone = event.client.phone;
      updated = true;
    }

    if (!client.phoneNormalized && phoneNormalized) {
      client.phoneNormalized = phoneNormalized;
      updated = true;
    }

    if (!client.email && event.client.email) {
      client.email = event.client.email;
      updated = true;
    }

    return updated ? this.clientsRepository.save(client) : client;
  }

  private applyIdentityFields(
    identity: ContactIdentity,
    event: NormalizedEvent,
    phoneNormalized: string | undefined,
  ): boolean {
    let updated = false;

    if (!identity.username && event.client.username) {
      identity.username = event.client.username;
      updated = true;
    }

    if (!identity.phone && event.client.phone) {
      identity.phone = event.client.phone;
      updated = true;
    }

    if (!identity.phoneNormalized && phoneNormalized) {
      identity.phoneNormalized = phoneNormalized;
      updated = true;
    }

    if (!identity.email && event.client.email) {
      identity.email = event.client.email;
      updated = true;
    }

    return updated;
  }
}
