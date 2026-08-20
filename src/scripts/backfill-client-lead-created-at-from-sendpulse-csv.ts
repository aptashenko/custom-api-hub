import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import AppDataSource from '../typeorm/data-source';

interface SendPulseCsvContact {
  contactId: string;
  subscribedAt: Date;
}

interface BackfillStats {
  csvRows: number;
  validRows: number;
  skippedRows: number;
  duplicateContactIds: number;
  matchedClients: number;
  updatedClients: number;
  fallbackClientsUpdated: number;
}

async function main(): Promise<void> {
  const filePath = resolveInputFilePath(process.argv[2]);
  const csv = await readSendPulseCsv(filePath);

  await AppDataSource.initialize();

  try {
    const stats = await backfillLeadCreatedAt(csv.contacts, csv);

    console.log(
      JSON.stringify(
        {
          filePath,
          ...stats,
        },
        null,
        2,
      ),
    );
  } finally {
    await AppDataSource.destroy();
  }
}

async function backfillLeadCreatedAt(
  contacts: SendPulseCsvContact[],
  csv: { csvRows: number; skippedRows: number },
): Promise<BackfillStats> {
  const deduplicated = deduplicateContacts(contacts);
  const contactIds = deduplicated.map((contact) => contact.contactId);
  const subscribedAtValues = deduplicated.map((contact) =>
    contact.subscribedAt.toISOString(),
  );

  const matchedRows = await AppDataSource.query(
    `
      WITH csv_contacts AS (
        SELECT *
        FROM unnest($1::text[], $2::timestamptz[]) AS input("contactId", "subscribedAt")
      )
      SELECT COUNT(DISTINCT c.id)::integer AS count
      FROM csv_contacts csv
      JOIN sendpulse_contacts sc ON sc."contactId" = csv."contactId"
      JOIN client c ON c.id = sc."clientId"
    `,
    [contactIds, subscribedAtValues],
  ) as Array<{ count: number }>;

  const updatedRows = await AppDataSource.query(
    `
      WITH csv_contacts AS (
        SELECT *
        FROM unnest($1::text[], $2::timestamptz[]) AS input("contactId", "subscribedAt")
      ),
      updated_clients AS (
        UPDATE client c
        SET "leadCreatedAt" = csv."subscribedAt"
        FROM sendpulse_contacts sc
        JOIN csv_contacts csv ON csv."contactId" = sc."contactId"
        WHERE sc."clientId" = c.id
          AND c."leadCreatedAt" IS DISTINCT FROM csv."subscribedAt"
        RETURNING c.id
      )
      SELECT COUNT(*)::integer AS count
      FROM updated_clients
    `,
    [contactIds, subscribedAtValues],
  ) as Array<{ count: number }>;

  const fallbackRows = await AppDataSource.query(
    `
    WITH csv_contacts AS (
      SELECT *
      FROM unnest($1::text[]) AS input("contactId")
    ),
    csv_clients AS (
      SELECT DISTINCT sc."clientId"
      FROM sendpulse_contacts sc
      JOIN csv_contacts csv ON csv."contactId" = sc."contactId"
      WHERE sc."clientId" IS NOT NULL
    ),
    updated_clients AS (
      UPDATE client c
      SET "leadCreatedAt" = "createdAt"
      WHERE NOT EXISTS (
        SELECT 1
        FROM csv_clients csv_client
        WHERE csv_client."clientId" = c.id
      )
        AND c."leadCreatedAt" IS DISTINCT FROM c."createdAt"
      RETURNING c.id
    )
    SELECT COUNT(*)::integer AS count
    FROM updated_clients
  `,
    [contactIds],
  ) as Array<{ count: number }>;

  return {
    csvRows: csv.csvRows,
    validRows: deduplicated.length,
    skippedRows: csv.skippedRows,
    duplicateContactIds: contacts.length - deduplicated.length,
    matchedClients: Number(matchedRows[0]?.count ?? 0),
    updatedClients: Number(updatedRows[0]?.count ?? 0),
    fallbackClientsUpdated: Number(fallbackRows[0]?.count ?? 0),
  };
}

async function readSendPulseCsv(
  filePath: string,
): Promise<{
  contacts: SendPulseCsvContact[];
  csvRows: number;
  skippedRows: number;
}> {
  const rows = parseCsv(await readFile(filePath, 'utf8'));

  if (rows.length === 0) {
    return {
      contacts: [],
      csvRows: 0,
      skippedRows: 0,
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const idIndex = headers.indexOf('id');
  const subscribedAtIndex = headers.indexOf('subscribed at');

  if (idIndex === -1 || subscribedAtIndex === -1) {
    throw new Error('CSV must contain "id" and "subscribed at" columns');
  }

  const contacts: SendPulseCsvContact[] = [];
  let skippedRows = 0;

  for (const row of rows.slice(1)) {
    const contactId = row[idIndex]?.trim();
    const subscribedAt = parseSendPulseDate(row[subscribedAtIndex]);

    if (!contactId || !subscribedAt) {
      skippedRows += 1;
      continue;
    }

    contacts.push({
      contactId,
      subscribedAt,
    });
  }

  return {
    contacts,
    csvRows: rows.length - 1,
    skippedRows,
  };
}

function deduplicateContacts(
  contacts: SendPulseCsvContact[],
): SendPulseCsvContact[] {
  const byContactId = new Map<string, SendPulseCsvContact>();

  for (const contact of contacts) {
    const existing = byContactId.get(contact.contactId);

    if (!existing || contact.subscribedAt < existing.subscribedAt) {
      byContactId.set(contact.contactId, contact);
    }
  }

  return [...byContactId.values()];
}

function parseSendPulseDate(value: string | undefined): Date | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(
    trimmed,
  );

  if (!match) {
    return undefined;
  }

  const [, day, month, year, hours, minutes, seconds] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    ),
  );

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function resolveInputFilePath(input: string | undefined): string {
  if (!input) {
    throw new Error(
      'Usage: npm run sendpulse:backfill-lead-created-at -- export.csv',
    );
  }

  const filePath = isAbsolute(input) ? input : join(process.cwd(), input);

  if (!existsSync(filePath)) {
    throw new Error(`File was not found: ${filePath}`);
  }

  return filePath;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
