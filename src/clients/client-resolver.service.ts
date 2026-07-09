import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    let identityResolution: 'found' | 'created' | 'none' = 'none';

    if (event.externalUserId) {
      identity = await this.findIdentity(event, event.externalUserId);

      if (identity) {
        client = identity.client;
        identityResolution = 'found';
      }
    }

    if (!client && event.client.phone) {
      client = await this.clientsRepository.findOne({
        where: {
          phone: event.client.phone,
        },
      });
    }

    if (!client && event.client.email) {
      client = await this.clientsRepository.findOne({
        where: {
          email: event.client.email,
        },
      });
    }

    if (!client) {
      client = await this.createClient(event);
      clientResolution = 'created';
    }

    if (event.externalUserId && !identity) {
      identity = await this.createIdentity(event, client, event.externalUserId);
      identityResolution = 'created';
    }

    this.logger.log(
      `Resolved client clientId=${client.id} clientResolution=${clientResolution} identityResolution=${identityResolution} identityId=${identity?.id ?? 'none'}`,
    );

    return {
      client,
      identity: identity ?? undefined,
    };
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

  private createClient(event: NormalizedEvent): Promise<Client> {
    const client = this.clientsRepository.create({
      name: event.client.name,
      phone: event.client.phone,
      email: event.client.email,
    });

    return this.clientsRepository.save(client);
  }

  private createIdentity(
    event: NormalizedEvent,
    client: Client,
    externalUserId: string,
  ): Promise<ContactIdentity> {
    const identity = this.identitiesRepository.create({
      clientId: client.id,
      channel: event.channel,
      externalId: externalUserId,
      username: event.client.username,
      phone: event.client.phone,
      email: event.client.email,
    });

    return this.identitiesRepository.save(identity);
  }
}
