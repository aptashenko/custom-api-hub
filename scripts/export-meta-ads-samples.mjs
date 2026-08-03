#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await loadDotEnv();

const apiVersion = process.env.META_API_VERSION || 'v25.0';
const token = process.env.META_ACCESS_TOKEN;
const configuredAdAccountId = process.env.META_AD_ACCOUNT_ID;
const outputDir = process.env.META_SAMPLES_OUTPUT_DIR || 'docs/meta-ads-fields';
const fieldsFile = process.env.META_FIELDS_FILE || 'docs/meta-ads-fields/meta-ads-fields.json';

async function loadDotEnv() {
  let content;
  try {
    content = await readFile('.env', 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function assertEnv() {
  if (!token) {
    throw new Error('Set META_ACCESS_TOKEN before running this script.');
  }
}

function normalizeAdAccountId(value) {
  if (!value) {
    return undefined;
  }

  return value.startsWith('act_') ? value : `act_${value}`;
}

async function requestJson(url, params = {}) {
  const requestUrl = new URL(url);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      requestUrl.searchParams.set(key, value);
    }
  }

  const response = await fetch(requestUrl);
  const body = await response.text();

  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`Non-JSON response from ${redactUrl(requestUrl)}: ${body.slice(0, 300)}`);
  }

  if (!response.ok || json.error) {
    const message = json.error?.message || response.statusText;
    throw new Error(`${response.status} ${message} (${redactUrl(requestUrl)})`);
  }

  return json;
}

function redactUrl(url) {
  const redacted = new URL(url);
  if (redacted.searchParams.has('access_token')) {
    redacted.searchParams.set('access_token', '[REDACTED]');
  }

  return redacted.toString();
}

async function graphGet(path, params = {}) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return requestJson(`https://graph.facebook.com/${apiVersion}/${cleanPath}`, {
    ...params,
    access_token: token,
  });
}

async function firstPage(path, params = {}) {
  const result = await graphGet(path, { limit: 1, ...params });
  return result.data?.[0];
}

async function resolveAdAccountId() {
  const adAccountId = normalizeAdAccountId(configuredAdAccountId);
  if (adAccountId) {
    return adAccountId;
  }

  const account = await firstPage('/me/adaccounts', { fields: 'id,name,account_id' });
  if (!account?.id) {
    throw new Error('No ad account found. Set META_AD_ACCOUNT_ID=act_... explicitly.');
  }

  return account.id;
}

async function resolveSampleIds(adAccountId) {
  const campaign = process.env.META_CAMPAIGN_ID
    ? { id: process.env.META_CAMPAIGN_ID }
    : await firstPage(`/${adAccountId}/campaigns`, {
        fields: 'id,name',
      }).catch(() => undefined);

  const adset = process.env.META_ADSET_ID
    ? { id: process.env.META_ADSET_ID }
    : await firstPage(`/${adAccountId}/adsets`, {
        fields: 'id,name',
      }).catch(() => undefined);

  const ad = process.env.META_AD_ID
    ? { id: process.env.META_AD_ID }
    : await firstPage(`/${adAccountId}/ads`, {
        fields: 'id,name,creative',
      }).catch(() => undefined);

  const creative = process.env.META_ADCREATIVE_ID
    ? { id: process.env.META_ADCREATIVE_ID }
    : ad?.creative?.id
      ? { id: ad.creative.id }
      : await firstPage(`/${adAccountId}/adcreatives`, {
          fields: 'id,name',
        }).catch(() => undefined);

  return {
    Campaign: campaign?.id,
    AdSet: adset?.id,
    Ad: ad?.id,
    AdCreative: creative?.id,
  };
}

async function readFieldsByObject() {
  const content = await readFile(fieldsFile, 'utf8');
  const report = JSON.parse(content);
  return Object.fromEntries(
    report.objects.map((object) => [object.objectName, object.fields.map((field) => field.name)]),
  );
}

async function fetchReadableNodeFields(id, fields) {
  if (!id) {
    return {
      status: 'missing_sample_object',
      data: null,
      readableFields: [],
      unreadableFields: [],
    };
  }

  const readableFields = [];
  const unreadableFields = [];
  const data = {};

  await fetchFieldGroup(`/${id}`, fields, data, readableFields, unreadableFields);

  return {
    status: 'ok',
    id,
    data,
    readableFields,
    unreadableFields,
  };
}

async function fetchReadableEdgeFields(path, fields, params = {}) {
  const readableFields = [];
  const unreadableFields = [];
  const data = {};

  await fetchFieldGroup(path, fields, data, readableFields, unreadableFields, params, true);

  return {
    status: 'ok',
    data,
    readableFields,
    unreadableFields,
  };
}

async function fetchFieldGroup(path, fields, data, readableFields, unreadableFields, extraParams = {}, edge = false) {
  if (fields.length === 0) {
    return;
  }

  try {
    const response = await graphGet(path, {
      ...extraParams,
      fields: fields.join(','),
      limit: edge ? 1 : undefined,
    });
    const payload = edge ? response.data?.[0] || null : response;
    if (payload) {
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          data[field] = payload[field];
          readableFields.push(field);
        }
      }
    }
    return;
  } catch (error) {
    if (fields.length === 1) {
      unreadableFields.push({
        field: fields[0],
        error: error.message,
      });
      return;
    }
  }

  const middle = Math.ceil(fields.length / 2);
  await fetchFieldGroup(path, fields.slice(0, middle), data, readableFields, unreadableFields, extraParams, edge);
  await fetchFieldGroup(path, fields.slice(middle), data, readableFields, unreadableFields, extraParams, edge);
}

async function main() {
  assertEnv();
  await mkdir(outputDir, { recursive: true });

  const adAccountId = await resolveAdAccountId();
  const sampleIds = await resolveSampleIds(adAccountId);
  const fieldsByObject = await readFieldsByObject();

  const report = {
    generatedAt: new Date().toISOString(),
    apiVersion,
    adAccountId,
    sampleIds,
    objects: {
      Campaign: await fetchReadableNodeFields(sampleIds.Campaign, fieldsByObject.Campaign || []),
      AdSet: await fetchReadableNodeFields(sampleIds.AdSet, fieldsByObject.AdSet || []),
      Ad: await fetchReadableNodeFields(sampleIds.Ad, fieldsByObject.Ad || []),
      AdCreative: await fetchReadableNodeFields(sampleIds.AdCreative, fieldsByObject.AdCreative || []),
      AdsInsights: await fetchReadableEdgeFields(`/${adAccountId}/insights`, fieldsByObject.AdsInsights || [], {
        date_preset: process.env.META_INSIGHTS_DATE_PRESET || 'last_30d',
        level: process.env.META_INSIGHTS_LEVEL || 'account',
      }).catch((error) => ({
        status: 'error',
        error: error.message,
        data: null,
        readableFields: [],
        unreadableFields: [],
      })),
    },
  };

  const jsonPath = join(outputDir, 'meta-ads-sample-responses.json');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${jsonPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
