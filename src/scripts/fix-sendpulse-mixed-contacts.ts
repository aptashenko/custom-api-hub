import AppDataSource from '../typeorm/data-source';

interface Options {
  apply: boolean;
  clientNumbers: number[];
  createMissing: boolean;
  fixFields: boolean;
  limit: number;
}

interface CountRow {
  mismatchRows: number;
  affectedClients: number;
  affectedIdentities: number;
  relinkableRows: number;
  highConfidenceRows: number;
  highConfidenceClients: number;
}

interface MissingTargetRow {
  old_client_id: string;
  old_identity_id: string;
  raw_telegram_id: string;
  raw_name: string | null;
  raw_username: string | null;
  raw_email: string | null;
  raw_phone: string | null;
  sendpulse_contact_id: string;
  sendpulse_created_at: Date;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  await AppDataSource.initialize();

  try {
    const before = await getCounts(options);
    const samples = await getSamples(options);
    const result = options.apply
      ? await AppDataSource.transaction(async (manager) => {
          const relink = await relinkSendPulseContacts(manager, options);
          const createMissing = options.createMissing
            ? await createMissingTargets(manager, options)
            : undefined;
          const fieldCleanup = options.fixFields
            ? await cleanupWrongFields(manager, options)
            : undefined;

          return {
            relink,
            createMissing,
            fieldCleanup,
          };
        })
      : undefined;
    const after = options.apply ? await getCounts(options) : undefined;

    console.log(
      JSON.stringify(
        {
          mode: options.apply ? 'apply' : 'dry-run',
          clientNumbers: options.clientNumbers,
          createMissing: options.createMissing,
          fixFields: options.fixFields,
          before,
          after,
          result,
          samples,
        },
        null,
        2,
      ),
    );
  } finally {
    await AppDataSource.destroy();
  }
}

async function getCounts(options: Options): Promise<CountRow> {
  const rows = await AppDataSource.query(`
    WITH mismatches AS (
      SELECT
        c.id AS client_id,
        ci.id AS identity_id,
        ci."externalId" AS identity_external_id,
        sp.id AS sendpulse_contact_id,
        sp."rawContact"->>'telegram_id' AS raw_telegram_id,
        sp."rawContact"->>'username' AS raw_username,
        sp.variables->>'email' AS raw_email,
        sp.variables->>'phone' AS raw_phone,
        c.email AS client_email,
        c.phone AS client_phone,
        ci.email AS identity_email,
        ci.phone AS identity_phone,
        ci.username AS identity_username,
        target_identity.id AS target_identity_id
      FROM sendpulse_contacts sp
      JOIN client c ON c.id = sp."clientId"
      JOIN contact_identity ci ON ci.id = sp."contactIdentityId"
      LEFT JOIN contact_identity target_identity
        ON target_identity.channel = 'TELEGRAM'
       AND target_identity."externalId" = sp."rawContact"->>'telegram_id'
      WHERE sp."rawContact"->>'telegram_id' IS NOT NULL
        AND ci."externalId" IS NOT NULL
        AND sp."rawContact"->>'telegram_id' <> ci."externalId"
        ${clientNumberFilter('c', options)}
    ),
    flagged AS (
      SELECT *
      FROM mismatches
      WHERE (
        client_email IS NOT NULL
        AND client_email <> ''
        AND raw_email IS NOT NULL
        AND raw_email <> ''
        AND lower(client_email) = lower(raw_email)
      )
      OR (
        identity_email IS NOT NULL
        AND identity_email <> ''
        AND raw_email IS NOT NULL
        AND raw_email <> ''
        AND lower(identity_email) = lower(raw_email)
      )
      OR (
        identity_username IS NOT NULL
        AND identity_username <> ''
        AND raw_username IS NOT NULL
        AND raw_username <> ''
        AND identity_username = raw_username
      )
      OR (
        client_phone IS NOT NULL
        AND client_phone <> ''
        AND raw_phone IS NOT NULL
        AND raw_phone <> ''
        AND client_phone = raw_phone
      )
    )
    SELECT
      count(*)::integer AS "mismatchRows",
      count(DISTINCT client_id)::integer AS "affectedClients",
      count(DISTINCT identity_id)::integer AS "affectedIdentities",
      count(*) FILTER (WHERE target_identity_id IS NOT NULL)::integer AS "relinkableRows",
      (SELECT count(*)::integer FROM flagged) AS "highConfidenceRows",
      (SELECT count(DISTINCT client_id)::integer FROM flagged) AS "highConfidenceClients"
    FROM mismatches
  `) as CountRow[];

  return (
    rows[0] ?? {
      mismatchRows: 0,
      affectedClients: 0,
      affectedIdentities: 0,
      relinkableRows: 0,
      highConfidenceRows: 0,
      highConfidenceClients: 0,
    }
  );
}

async function getSamples(options: Options): Promise<unknown[]> {
  return AppDataSource.query(
    `
      WITH mismatches AS (
        SELECT
          c."clientNumber" AS "clientNumber",
          c.id AS "clientId",
          c.name AS "clientName",
          c.email AS "clientEmail",
          c.phone AS "clientPhone",
          ci.id AS "identityId",
          ci."externalId" AS "identityExternalId",
          ci.username AS "identityUsername",
          ci.email AS "identityEmail",
          ci.phone AS "identityPhone",
          sp.id AS "sendPulseContactId",
          sp."contactId" AS "sendPulseExternalContactId",
          sp."rawContact"->>'telegram_id' AS "rawTelegramId",
          sp."rawContact"->>'name' AS "rawName",
          sp."rawContact"->>'username' AS "rawUsername",
          sp.variables->>'email' AS "rawEmail",
          sp.variables->>'phone' AS "rawPhone",
          target_identity.id AS "targetIdentityId",
          target_client."clientNumber" AS "targetClientNumber",
          sp."updatedAt" AS "sendPulseUpdatedAt",
          concat_ws(',',
            CASE WHEN c.email IS NOT NULL AND c.email <> '' AND sp.variables->>'email' IS NOT NULL AND sp.variables->>'email' <> '' AND lower(c.email) = lower(sp.variables->>'email') THEN 'client_email' END,
            CASE WHEN ci.email IS NOT NULL AND ci.email <> '' AND sp.variables->>'email' IS NOT NULL AND sp.variables->>'email' <> '' AND lower(ci.email) = lower(sp.variables->>'email') THEN 'identity_email' END,
            CASE WHEN ci.username IS NOT NULL AND ci.username <> '' AND sp."rawContact"->>'username' IS NOT NULL AND sp."rawContact"->>'username' <> '' AND ci.username = sp."rawContact"->>'username' THEN 'identity_username' END,
            CASE WHEN c.phone IS NOT NULL AND c.phone <> '' AND sp.variables->>'phone' IS NOT NULL AND sp.variables->>'phone' <> '' AND c.phone = sp.variables->>'phone' THEN 'client_phone' END
          ) AS flags
        FROM sendpulse_contacts sp
        JOIN client c ON c.id = sp."clientId"
        JOIN contact_identity ci ON ci.id = sp."contactIdentityId"
        LEFT JOIN contact_identity target_identity
          ON target_identity.channel = 'TELEGRAM'
         AND target_identity."externalId" = sp."rawContact"->>'telegram_id'
        LEFT JOIN client target_client ON target_client.id = target_identity."clientId"
        WHERE sp."rawContact"->>'telegram_id' IS NOT NULL
          AND ci."externalId" IS NOT NULL
          AND sp."rawContact"->>'telegram_id' <> ci."externalId"
          ${clientNumberFilter('c', options)}
      )
      SELECT *
      FROM mismatches
      ORDER BY
        CASE WHEN flags <> '' THEN 0 ELSE 1 END,
        "sendPulseUpdatedAt" DESC,
        "clientNumber"
      LIMIT $1
    `,
    [options.limit],
  ) as Promise<unknown[]>;
}

async function cleanupWrongFields(
  manager: typeof AppDataSource.manager,
  options: Options,
): Promise<{
  clientsEmailCleared: number;
  clientsPhoneCleared: number;
  identitiesEmailCleared: number;
  identitiesUsernameCleared: number;
  identitiesPhoneCleared: number;
}> {
  const clientsEmailCleared = await updateCount(manager.query(`
    WITH mismatches AS (${mismatchSql(options)}),
    updated AS (
      UPDATE client c
      SET email = NULL
      WHERE EXISTS (
        SELECT 1
        FROM mismatches m
        WHERE m.client_id = c.id
          AND m.raw_email IS NOT NULL
          AND m.raw_email <> ''
          AND c.email IS NOT NULL
          AND c.email <> ''
          AND lower(c.email) = lower(m.raw_email)
          AND NOT EXISTS (
            SELECT 1
            FROM sendpulse_contacts sp_ok
            JOIN contact_identity ci_ok ON ci_ok.id = sp_ok."contactIdentityId"
            WHERE sp_ok."clientId" = c.id
              AND sp_ok."rawContact"->>'telegram_id' = ci_ok."externalId"
              AND sp_ok.variables->>'email' IS NOT NULL
              AND lower(sp_ok.variables->>'email') = lower(c.email)
          )
      )
      RETURNING c.id
    )
    SELECT count(*)::integer AS count FROM updated
  `));
  const clientsPhoneCleared = await updateCount(manager.query(`
    WITH mismatches AS (${mismatchSql(options)}),
    updated AS (
      UPDATE client c
      SET phone = NULL, "phoneNormalized" = NULL
      WHERE EXISTS (
        SELECT 1
        FROM mismatches m
        WHERE m.client_id = c.id
          AND m.raw_phone IS NOT NULL
          AND m.raw_phone <> ''
          AND c.phone IS NOT NULL
          AND c.phone <> ''
          AND c.phone = m.raw_phone
          AND NOT EXISTS (
            SELECT 1
            FROM sendpulse_contacts sp_ok
            JOIN contact_identity ci_ok ON ci_ok.id = sp_ok."contactIdentityId"
            WHERE sp_ok."clientId" = c.id
              AND sp_ok."rawContact"->>'telegram_id' = ci_ok."externalId"
              AND sp_ok.variables->>'phone' = c.phone
          )
      )
      RETURNING c.id
    )
    SELECT count(*)::integer AS count FROM updated
  `));
  const identitiesEmailCleared = await updateCount(manager.query(`
    WITH mismatches AS (${mismatchSql(options)}),
    updated AS (
      UPDATE contact_identity ci
      SET email = NULL
      WHERE EXISTS (
        SELECT 1
        FROM mismatches m
        WHERE m.identity_id = ci.id
          AND m.raw_email IS NOT NULL
          AND m.raw_email <> ''
          AND ci.email IS NOT NULL
          AND ci.email <> ''
          AND lower(ci.email) = lower(m.raw_email)
          AND NOT EXISTS (
            SELECT 1
            FROM sendpulse_contacts sp_ok
            WHERE sp_ok."contactIdentityId" = ci.id
              AND sp_ok."rawContact"->>'telegram_id' = ci."externalId"
              AND sp_ok.variables->>'email' IS NOT NULL
              AND lower(sp_ok.variables->>'email') = lower(ci.email)
          )
      )
      RETURNING ci.id
    )
    SELECT count(*)::integer AS count FROM updated
  `));
  const identitiesUsernameCleared = await updateCount(manager.query(`
    WITH mismatches AS (${mismatchSql(options)}),
    updated AS (
      UPDATE contact_identity ci
      SET username = NULL
      WHERE EXISTS (
        SELECT 1
        FROM mismatches m
        WHERE m.identity_id = ci.id
          AND m.raw_username IS NOT NULL
          AND m.raw_username <> ''
          AND ci.username IS NOT NULL
          AND ci.username <> ''
          AND ci.username = m.raw_username
          AND NOT EXISTS (
            SELECT 1
            FROM sendpulse_contacts sp_ok
            WHERE sp_ok."contactIdentityId" = ci.id
              AND sp_ok."rawContact"->>'telegram_id' = ci."externalId"
              AND sp_ok."rawContact"->>'username' = ci.username
          )
      )
      RETURNING ci.id
    )
    SELECT count(*)::integer AS count FROM updated
  `));
  const identitiesPhoneCleared = await updateCount(manager.query(`
    WITH mismatches AS (${mismatchSql(options)}),
    updated AS (
      UPDATE contact_identity ci
      SET phone = NULL, "phoneNormalized" = NULL
      WHERE EXISTS (
        SELECT 1
        FROM mismatches m
        WHERE m.identity_id = ci.id
          AND m.raw_phone IS NOT NULL
          AND m.raw_phone <> ''
          AND ci.phone IS NOT NULL
          AND ci.phone <> ''
          AND ci.phone = m.raw_phone
          AND NOT EXISTS (
            SELECT 1
            FROM sendpulse_contacts sp_ok
            WHERE sp_ok."contactIdentityId" = ci.id
              AND sp_ok."rawContact"->>'telegram_id' = ci."externalId"
              AND sp_ok.variables->>'phone' = ci.phone
          )
      )
      RETURNING ci.id
    )
    SELECT count(*)::integer AS count FROM updated
  `));

  return {
    clientsEmailCleared,
    clientsPhoneCleared,
    identitiesEmailCleared,
    identitiesUsernameCleared,
    identitiesPhoneCleared,
  };
}

async function relinkSendPulseContacts(
  manager: typeof AppDataSource.manager,
  options: Options,
): Promise<{ relinkedRows: number }> {
  const relinkedRows = await updateCount(manager.query(`
    WITH relinkable AS (${mismatchSql(options)}),
    updated AS (
      UPDATE sendpulse_contacts sp
      SET
        "clientId" = relinkable.target_client_id,
        "contactIdentityId" = relinkable.target_identity_id
      FROM relinkable
      WHERE sp.id = relinkable.sendpulse_contact_id
        AND relinkable.target_identity_id IS NOT NULL
        AND (
          sp."clientId" IS DISTINCT FROM relinkable.target_client_id
          OR sp."contactIdentityId" IS DISTINCT FROM relinkable.target_identity_id
        )
      RETURNING sp.id
    )
    SELECT count(*)::integer AS count FROM updated
  `));

  return {
    relinkedRows,
  };
}

async function createMissingTargets(
  manager: typeof AppDataSource.manager,
  options: Options,
): Promise<{ createdRows: number }> {
  const candidates = (await manager.query(
    missingTargetSql(options),
  )) as MissingTargetRow[];
  let createdRows = 0;

  for (const candidate of candidates) {
    const phoneNormalized = normalizePhone(candidate.raw_phone);
    const clientRows = (await manager.query(
      `
        INSERT INTO client (
          name,
          phone,
          "phoneNormalized",
          email,
          "leadCreatedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $5, now())
        RETURNING id
      `,
      [
        emptyToNull(candidate.raw_name),
        emptyToNull(candidate.raw_phone),
        phoneNormalized,
        emptyToNull(candidate.raw_email),
        candidate.sendpulse_created_at,
      ],
    )) as Array<{ id: string }>;
    const clientId = clientRows[0]?.id;

    if (!clientId) {
      throw new Error('Failed to create client for missing SendPulse target');
    }

    const identityRows = (await manager.query(
      `
        INSERT INTO contact_identity (
          "clientId",
          channel,
          "externalId",
          username,
          phone,
          "phoneNormalized",
          email,
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, 'TELEGRAM', $2, $3, $4, $5, $6, $7, now())
        RETURNING id
      `,
      [
        clientId,
        candidate.raw_telegram_id,
        emptyToNull(candidate.raw_username),
        emptyToNull(candidate.raw_phone),
        phoneNormalized,
        emptyToNull(candidate.raw_email),
        candidate.sendpulse_created_at,
      ],
    )) as Array<{ id: string }>;
    const identityId = identityRows[0]?.id;

    if (!identityId) {
      throw new Error('Failed to create identity for missing SendPulse target');
    }

    await manager.query(
      `
        UPDATE sendpulse_contacts
        SET "clientId" = $1,
            "contactIdentityId" = $2
        WHERE id = $3
      `,
      [clientId, identityId, candidate.sendpulse_contact_id],
    );

    if (candidate.raw_email) {
      await manager.query(
        `
          UPDATE client
          SET email = NULL
          WHERE id = $1
            AND email IS NOT NULL
            AND lower(email) = lower($2)
        `,
        [candidate.old_client_id, candidate.raw_email],
      );
      await manager.query(
        `
          UPDATE contact_identity
          SET email = NULL
          WHERE id = $1
            AND email IS NOT NULL
            AND lower(email) = lower($2)
        `,
        [candidate.old_identity_id, candidate.raw_email],
      );
    }

    if (candidate.raw_username) {
      await manager.query(
        `
          UPDATE contact_identity
          SET username = NULL
          WHERE id = $1
            AND username = $2
        `,
        [candidate.old_identity_id, candidate.raw_username],
      );
    }

    createdRows += 1;
  }

  return {
    createdRows,
  };
}

function mismatchSql(options: Options): string {
  return `
    SELECT
      c.id AS client_id,
      ci.id AS identity_id,
      sp.id AS sendpulse_contact_id,
      sp."rawContact"->>'telegram_id' AS raw_telegram_id,
      sp."rawContact"->>'username' AS raw_username,
      sp.variables->>'email' AS raw_email,
      sp.variables->>'phone' AS raw_phone,
      target_identity.id AS target_identity_id,
      target_identity."clientId" AS target_client_id
    FROM sendpulse_contacts sp
    JOIN client c ON c.id = sp."clientId"
    JOIN contact_identity ci ON ci.id = sp."contactIdentityId"
    LEFT JOIN contact_identity target_identity
      ON target_identity.channel = 'TELEGRAM'
     AND target_identity."externalId" = sp."rawContact"->>'telegram_id'
    WHERE sp."rawContact"->>'telegram_id' IS NOT NULL
      AND ci."externalId" IS NOT NULL
      AND sp."rawContact"->>'telegram_id' <> ci."externalId"
      ${clientNumberFilter('c', options)}
  `;
}

function missingTargetSql(options: Options): string {
  return `
    SELECT
      c."clientNumber" AS old_client_number,
      c.id AS old_client_id,
      ci.id AS old_identity_id,
      sp.id AS sendpulse_contact_id,
      sp."rawContact"->>'telegram_id' AS raw_telegram_id,
      sp."rawContact"->>'name' AS raw_name,
      sp."rawContact"->>'username' AS raw_username,
      sp.variables->>'email' AS raw_email,
      sp.variables->>'phone' AS raw_phone,
      sp."createdAt" AS sendpulse_created_at,
      concat_ws(',',
        CASE WHEN c.email IS NOT NULL AND c.email <> '' AND sp.variables->>'email' IS NOT NULL AND sp.variables->>'email' <> '' AND lower(c.email) = lower(sp.variables->>'email') THEN 'client_email' END,
        CASE WHEN ci.email IS NOT NULL AND ci.email <> '' AND sp.variables->>'email' IS NOT NULL AND sp.variables->>'email' <> '' AND lower(ci.email) = lower(sp.variables->>'email') THEN 'identity_email' END,
        CASE WHEN ci.username IS NOT NULL AND ci.username <> '' AND sp."rawContact"->>'username' IS NOT NULL AND sp."rawContact"->>'username' <> '' AND ci.username = sp."rawContact"->>'username' THEN 'identity_username' END,
        CASE WHEN c.phone IS NOT NULL AND c.phone <> '' AND sp.variables->>'phone' IS NOT NULL AND sp.variables->>'phone' <> '' AND c.phone = sp.variables->>'phone' THEN 'client_phone' END
      ) AS flags
    FROM sendpulse_contacts sp
    JOIN client c ON c.id = sp."clientId"
    JOIN contact_identity ci ON ci.id = sp."contactIdentityId"
    LEFT JOIN contact_identity target_identity
      ON target_identity.channel = 'TELEGRAM'
     AND target_identity."externalId" = sp."rawContact"->>'telegram_id'
    WHERE sp."rawContact"->>'telegram_id' IS NOT NULL
      AND ci."externalId" IS NOT NULL
      AND sp."rawContact"->>'telegram_id' <> ci."externalId"
      AND target_identity.id IS NULL
      ${clientNumberFilter('c', options)}
      AND (
        (
          c.email IS NOT NULL
          AND c.email <> ''
          AND sp.variables->>'email' IS NOT NULL
          AND sp.variables->>'email' <> ''
          AND lower(c.email) = lower(sp.variables->>'email')
        )
        OR (
          ci.email IS NOT NULL
          AND ci.email <> ''
          AND sp.variables->>'email' IS NOT NULL
          AND sp.variables->>'email' <> ''
          AND lower(ci.email) = lower(sp.variables->>'email')
        )
        OR (
          ci.username IS NOT NULL
          AND ci.username <> ''
          AND sp."rawContact"->>'username' IS NOT NULL
          AND sp."rawContact"->>'username' <> ''
          AND ci.username = sp."rawContact"->>'username'
        )
      )
  `;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 7) {
    return null;
  }

  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function clientNumberFilter(clientAlias: string, options: Options): string {
  if (options.clientNumbers.length === 0) {
    return '';
  }

  return `AND ${clientAlias}."clientNumber" IN (${options.clientNumbers.join(', ')})`;
}

async function updateCount(query: Promise<Array<{ count: number }>>): Promise<number> {
  const rows = await query;

  return Number(rows[0]?.count ?? 0);
}

function parseOptions(args: string[]): Options {
  const options: Options = {
    apply: false,
    clientNumbers: [],
    createMissing: false,
    fixFields: false,
    limit: 25,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--client-number') {
      const value = Number(args[index + 1]);

      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--client-number must be a positive integer');
      }

      options.clientNumbers.push(value);
      index += 1;
    } else if (arg === '--create-missing') {
      options.createMissing = true;
    } else if (arg === '--fix-fields') {
      options.fixFields = true;
    } else if (arg === '--limit') {
      const value = Number(args[index + 1]);

      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--limit must be a non-negative integer');
      }

      options.limit = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.fixFields && !options.apply) {
    throw new Error('--fix-fields requires --apply');
  }

  if (options.createMissing && !options.apply) {
    throw new Error('--create-missing requires --apply');
  }

  return options;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
