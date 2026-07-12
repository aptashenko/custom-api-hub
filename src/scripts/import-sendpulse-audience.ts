import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { Repository } from 'typeorm';

import { normalizePhone } from '../common/phone-normalizer';
import AppDataSource from '../typeorm/data-source';
import { Client } from '../typeorm/entities/client.entity';
import { ContactIdentity } from '../typeorm/entities/contact-identity.entity';
import { Channel } from '../typeorm/entities/enums';
import { SendPulseContact } from '../typeorm/entities/sendpulse-contact.entity';

interface SendPulseAudienceFile {
  exportedAt?: string;
  contacts?: SendPulseAudienceFileContact[];
}

interface SendPulseAudienceFileContact {
  key?: string;
  botId?: string;
  contactId?: string;
  dialogIds?: unknown[];
  tags?: unknown;
  variables?: unknown;
  rawContact?: unknown;
  rawDialogs?: unknown[];
  [key: string]: unknown;
}

interface ContactImportData {
  exportKey: string;
  botId?: string;
  contactId?: string;
  externalId: string;
  dialogIds: string[];
  name?: string;
  phone?: string;
  phoneNormalized?: string;
  email?: string;
  username?: string;
  tags?: unknown[] | null;
  variables?: Record<string, unknown> | null;
  rawContact?: unknown | null;
  rawDialogs: unknown[];
  rawProfile: SendPulseAudienceFileContact;
}

interface ImportStats {
  totalContacts: number;
  skippedContacts: number;
  sendPulseProfilesUpserted: number;
  clientsCreated: number;
  clientsUpdated: number;
  identitiesCreated: number;
  identitiesUpdated: number;
}

async function main(): Promise<void> {
  const filePath = resolveInputFilePath(process.argv[2]);
  const sourceFile = filePath;
  const audience = await readAudienceFile(filePath);
  const contacts = Array.isArray(audience.contacts) ? audience.contacts : [];

  await AppDataSource.initialize();

  try {
    const clientsRepository = AppDataSource.getRepository(Client);
    const identitiesRepository = AppDataSource.getRepository(ContactIdentity);
    const sendPulseContactsRepository =
      AppDataSource.getRepository(SendPulseContact);
    const exportedAt = audience.exportedAt ? new Date(audience.exportedAt) : null;
    const stats: ImportStats = {
      totalContacts: contacts.length,
      skippedContacts: 0,
      sendPulseProfilesUpserted: 0,
      clientsCreated: 0,
      clientsUpdated: 0,
      identitiesCreated: 0,
      identitiesUpdated: 0,
    };

    for (const contact of contacts) {
      const importData = toImportData(contact);

      if (!importData) {
        stats.skippedContacts += 1;
        continue;
      }

      await AppDataSource.transaction(async (manager) => {
        const client = await resolveClient({
          data: importData,
          clientsRepository: manager.getRepository(Client),
          identitiesRepository: manager.getRepository(ContactIdentity),
          stats,
        });
        const identity = await resolveIdentity({
          data: importData,
          client,
          identitiesRepository: manager.getRepository(ContactIdentity),
          stats,
        });

        await upsertSendPulseProfile({
          data: importData,
          client,
          identity,
          sourceFile,
          exportedAt,
          sendPulseContactsRepository:
            manager.getRepository(SendPulseContact),
        });

        stats.sendPulseProfilesUpserted += 1;
      });
    }

    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await AppDataSource.destroy();
  }
}

async function resolveClient(input: {
  data: ContactImportData;
  clientsRepository: Repository<Client>;
  identitiesRepository: Repository<ContactIdentity>;
  stats: ImportStats;
}): Promise<Client> {
  const existingIdentity = await input.identitiesRepository.findOne({
    where: {
      channel: Channel.SENDPULSE,
      externalId: input.data.externalId,
    },
    relations: {
      client: true,
    },
  });

  if (existingIdentity) {
    const updated = applyClientFields(existingIdentity.client, input.data);

    if (updated) {
      await input.clientsRepository.save(existingIdentity.client);
      input.stats.clientsUpdated += 1;
    }

    return existingIdentity.client;
  }

  let client: Client | null = null;

  if (input.data.phone) {
    input.data.phoneNormalized = normalizePhone(input.data.phone);
  }

  if (input.data.phoneNormalized) {
    client = await input.clientsRepository.findOne({
      where: {
        phoneNormalized: input.data.phoneNormalized,
      },
    });
  }

  if (!client && input.data.phone) {
    client = await input.clientsRepository.findOne({
      where: {
        phone: input.data.phone,
      },
    });
  }

  if (!client && input.data.email) {
    client = await input.clientsRepository.findOne({
      where: {
        email: input.data.email,
      },
    });
  }

  if (client) {
    const updated = applyClientFields(client, input.data);

    if (updated) {
      await input.clientsRepository.save(client);
      input.stats.clientsUpdated += 1;
    }

    return client;
  }

  const createdClient = input.clientsRepository.create({
    name: input.data.name,
    phone: input.data.phone,
    phoneNormalized: input.data.phoneNormalized,
    email: input.data.email,
  });

  input.stats.clientsCreated += 1;

  return input.clientsRepository.save(createdClient);
}

async function resolveIdentity(input: {
  data: ContactImportData;
  client: Client;
  identitiesRepository: Repository<ContactIdentity>;
  stats: ImportStats;
}): Promise<ContactIdentity> {
  const existingIdentity = await input.identitiesRepository.findOne({
    where: {
      channel: Channel.SENDPULSE,
      externalId: input.data.externalId,
    },
  });

  if (existingIdentity) {
    const updated = applyIdentityFields(existingIdentity, input.data, input.client);

    if (updated) {
      await input.identitiesRepository.save(existingIdentity);
      input.stats.identitiesUpdated += 1;
    }

    return existingIdentity;
  }

  const identity = input.identitiesRepository.create({
    clientId: input.client.id,
    channel: Channel.SENDPULSE,
    externalId: input.data.externalId,
    username: input.data.username,
    phone: input.data.phone,
    phoneNormalized: input.data.phoneNormalized,
    email: input.data.email,
  });

  input.stats.identitiesCreated += 1;

  return input.identitiesRepository.save(identity);
}

async function upsertSendPulseProfile(input: {
  data: ContactImportData;
  client: Client;
  identity: ContactIdentity;
  sourceFile: string;
  exportedAt: Date | null;
  sendPulseContactsRepository: Repository<SendPulseContact>;
}): Promise<void> {
  const existing = await input.sendPulseContactsRepository.findOne({
    where: {
      exportKey: input.data.exportKey,
    },
  });
  const profile =
    existing ??
    input.sendPulseContactsRepository.create({
      exportKey: input.data.exportKey,
    });

  profile.clientId = input.client.id;
  profile.contactIdentityId = input.identity.id;
  profile.botId = input.data.botId;
  profile.contactId = input.data.contactId;
  profile.dialogIds = input.data.dialogIds;
  profile.tags = input.data.tags;
  profile.variables = input.data.variables;
  profile.rawContact = input.data.rawContact;
  profile.rawDialogs = input.data.rawDialogs;
  profile.rawProfile = input.data.rawProfile;
  profile.sourceFile = input.sourceFile;
  profile.exportedAt = input.exportedAt;

  await input.sendPulseContactsRepository.save(profile);
}

function applyClientFields(client: Client, data: ContactImportData): boolean {
  let updated = false;

  if (!client.name && data.name) {
    client.name = data.name;
    updated = true;
  }

  if (!client.phone && data.phone) {
    client.phone = data.phone;
    updated = true;
  }

  if (!client.phoneNormalized && data.phoneNormalized) {
    client.phoneNormalized = data.phoneNormalized;
    updated = true;
  }

  if (!client.email && data.email) {
    client.email = data.email;
    updated = true;
  }

  return updated;
}

function applyIdentityFields(
  identity: ContactIdentity,
  data: ContactImportData,
  client: Client,
): boolean {
  let updated = false;

  if (identity.clientId !== client.id) {
    identity.clientId = client.id;
    updated = true;
  }

  if (!identity.username && data.username) {
    identity.username = data.username;
    updated = true;
  }

  if (!identity.phone && data.phone) {
    identity.phone = data.phone;
    updated = true;
  }

  if (!identity.phoneNormalized && data.phoneNormalized) {
    identity.phoneNormalized = data.phoneNormalized;
    updated = true;
  }

  if (!identity.email && data.email) {
    identity.email = data.email;
    updated = true;
  }

  return updated;
}

function toImportData(
  contact: SendPulseAudienceFileContact,
): ContactImportData | undefined {
  const exportKey = getString(contact.key);
  const botId = getString(contact.botId);
  const contactId = getString(contact.contactId);
  const externalId = contactId ?? exportKey;

  if (!exportKey || !externalId) {
    return undefined;
  }

  const phone = firstString([
    getPathString(contact.rawContact, ['phone']),
    getPathString(contact.rawContact, ['phone_number']),
    getPathString(contact.variables, ['phone']),
    getPathString(contact.variables, ['Phone']),
  ]);

  return {
    exportKey,
    botId,
    contactId,
    externalId,
    dialogIds: toStringArray(contact.dialogIds),
    name: firstString([
      getPathString(contact.rawContact, ['name']),
      getPathString(contact.rawContact, ['full_name']),
      getPathString(contact.rawContact, ['first_name']),
      getPathString(contact.rawContact, ['last_name']),
    ]),
    phone,
    phoneNormalized: normalizePhone(phone),
    email: firstString([
      getPathString(contact.rawContact, ['email']),
      getPathString(contact.variables, ['email']),
      getPathString(contact.variables, ['Email']),
    ]),
    username: firstString([
      getPathString(contact.rawContact, ['username']),
      getPathString(contact.rawContact, ['telegram_username']),
      getPathString(contact.rawContact, ['channel_data', 'username']),
    ]),
    tags: Array.isArray(contact.tags) ? contact.tags : null,
    variables: isRecord(contact.variables) ? contact.variables : null,
    rawContact: contact.rawContact ?? null,
    rawDialogs: Array.isArray(contact.rawDialogs) ? contact.rawDialogs : [],
    rawProfile: contact,
  };
}

async function readAudienceFile(filePath: string): Promise<SendPulseAudienceFile> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;

  if (!isRecord(parsed)) {
    throw new Error('SendPulse audience file must contain a JSON object');
  }

  return parsed;
}

function resolveInputFilePath(input: string | undefined): string {
  if (!input) {
    throw new Error(
      'Usage: npm run sendpulse:import -- exports/sendpulse-audience.json',
    );
  }

  const filePath = isAbsolute(input) ? input : join(process.cwd(), input);

  if (!existsSync(filePath)) {
    throw new Error(`File was not found: ${filePath}`);
  }

  return filePath;
}

function firstString(values: Array<string | undefined>): string | undefined {
  const parts = values.filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' ');
}

function getPathString(value: unknown, path: string[]): string | undefined {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return getString(current);
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getString(item))
    .filter((item): item is string => Boolean(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
