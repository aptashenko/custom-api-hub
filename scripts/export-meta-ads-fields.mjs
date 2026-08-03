#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await loadDotEnv();

const apiVersion = process.env.META_API_VERSION || 'v25.0';
const token = process.env.META_ACCESS_TOKEN;
const configuredAdAccountId = process.env.META_AD_ACCOUNT_ID;
const outputDir = process.env.META_FIELDS_OUTPUT_DIR || 'docs/meta-ads-fields';

const sdkObjects = [
  {
    name: 'AdAccount',
    url: 'https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adaccount.py',
  },
  {
    name: 'Campaign',
    url: 'https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/campaign.py',
  },
  {
    name: 'AdSet',
    url: 'https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py',
  },
  {
    name: 'Ad',
    url: 'https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/ad.py',
  },
  {
    name: 'AdCreative',
    url: 'https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreative.py',
  },
  {
    name: 'AdsInsights',
    url: 'https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adsinsights.py',
  },
];

async function loadDotEnv() {
  const envPath = '.env';

  let content;
  try {
    content = await readFile(envPath, 'utf8');
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
    throw new Error(`Non-JSON response from ${requestUrl}: ${body.slice(0, 300)}`);
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

async function discoverSampleNodeIds(adAccountId) {
  const campaign = await firstPage(`/${adAccountId}/campaigns`, {
    fields: 'id,name',
    effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']),
  }).catch(() => undefined);

  const adset = campaign?.id
    ? await firstPage(`/${campaign.id}/adsets`, {
        fields: 'id,name',
        effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']),
      }).catch(() => undefined)
    : await firstPage(`/${adAccountId}/adsets`, {
        fields: 'id,name',
        effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']),
      }).catch(() => undefined);

  const ad = adset?.id
    ? await firstPage(`/${adset.id}/ads`, {
        fields: 'id,name,creative',
        effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']),
      }).catch(() => undefined)
    : await firstPage(`/${adAccountId}/ads`, {
        fields: 'id,name,creative',
        effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED']),
      }).catch(() => undefined);

  const creativeId = ad?.creative?.id;
  const creative = creativeId ? { id: creativeId } : undefined;

  return {
    AdAccount: adAccountId,
    Campaign: campaign?.id,
    AdSet: adset?.id,
    Ad: ad?.id,
    AdCreative: creative?.id,
  };
}

async function fetchMetadata(objectName, id) {
  if (!id) {
    return {
      objectName,
      id: null,
      status: 'missing_sample_object',
      fields: [],
      connections: {},
    };
  }

  const result = await graphGet(`/${id}`, {
    metadata: '1',
  });

  return {
    objectName,
    id,
    status: 'ok',
    graphType: result.metadata?.type,
    fields: result.metadata?.fields || [],
    connections: result.metadata?.connections || {},
  };
}

function parseSdkFields(source) {
  const fieldClassStart = source.indexOf('class Field(AbstractObject.Field):');
  if (fieldClassStart === -1) {
    return [];
  }

  const afterFieldClass = source.slice(fieldClassStart).split('\n').slice(1);
  const fields = [];

  for (const line of afterFieldClass) {
    if (/^    class /.test(line) || /^    def /.test(line) || /^    # /.test(line)) {
      break;
    }

    const match = line.match(/^\s{8}([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']+)'/);
    if (match) {
      fields.push({
        constant: match[1],
        name: match[2],
      });
    }
  }

  return fields;
}

async function fetchSdkFields() {
  const result = {};

  for (const object of sdkObjects) {
    const response = await fetch(object.url);
    if (!response.ok) {
      throw new Error(`Cannot fetch ${object.name} SDK fields: ${response.status} ${response.statusText}`);
    }

    result[object.name] = parseSdkFields(await response.text());
  }

  return result;
}

async function fetchAllSdkObjectFields() {
  const contents = await requestJson(
    'https://api.github.com/repos/facebook/facebook-python-business-sdk/contents/facebook_business/adobjects',
  );

  const files = contents
    .filter((item) => item.type === 'file' && item.name.endsWith('.py'))
    .filter((item) => !item.name.startsWith('__') && !item.name.startsWith('abstract'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const objects = await mapLimit(files, 12, async (file) => {
    const response = await fetch(file.download_url);
    if (!response.ok) {
      throw new Error(`Cannot fetch SDK object ${file.name}: ${response.status} ${response.statusText}`);
    }

    const source = await response.text();
    const fields = parseSdkFields(source);
    if (fields.length === 0) {
      return undefined;
    }

    const className = source.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\(/m)?.[1] || file.name.replace(/\.py$/, '');
    return {
      objectName: className,
      file: file.name,
      fields: fields.map((field) => ({
        name: field.name,
        sdkConstant: field.constant,
        inferredDescription: explainFieldName(field.name),
      })),
    };
  });

  return objects.filter(Boolean).sort((a, b) => a.objectName.localeCompare(b.objectName));
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function explainFieldName(name) {
  const rules = [
    [/^id$/, 'Уникальный ID объекта в Graph API.'],
    [/_id$/, 'ID связанного объекта.'],
    [/_name$/, 'Название связанного объекта.'],
    [/^name$/, 'Название объекта.'],
    [/status$/, 'Статус объекта или процесса.'],
    [/effective_status$/, 'Фактический статус с учетом родительских объектов, модерации и доставки.'],
    [/created_time$/, 'Дата и время создания.'],
    [/updated_time$/, 'Дата и время последнего обновления.'],
    [/start|time_start/, 'Начало периода, расписания или действия.'],
    [/stop|end|time_stop/, 'Конец периода, расписания или действия.'],
    [/budget|spend|cost|cpc|cpm|cpp|roas|value/, 'Денежный показатель, бюджет, расход, стоимость или ценность конверсий.'],
    [/impressions/, 'Количество показов.'],
    [/reach/, 'Охват уникальных пользователей.'],
    [/click/, 'Клики или метрика, рассчитанная по кликам.'],
    [/action|conversion|purchase|lead/, 'События результата, конверсии, лиды, покупки или стоимость таких событий.'],
    [/targeting/, 'Настройки аудитории и таргетинга.'],
    [/creative|image|video|thumbnail|asset/, 'Креатив, медиа-актив или связанные настройки объявления.'],
    [/campaign/, 'Поле связано с кампанией.'],
    [/adset/, 'Поле связано с группой объявлений.'],
    [/account/, 'Поле связано с рекламным аккаунтом.'],
  ];

  return rules.find(([pattern]) => pattern.test(name))?.[1] || '';
}

function mergeFields(metadataFields, sdkFields) {
  const byName = new Map();

  for (const field of sdkFields || []) {
    byName.set(field.name, {
      name: field.name,
      sdkConstant: field.constant,
      type: '',
      description: '',
      inferredDescription: explainFieldName(field.name),
      source: 'sdk',
    });
  }

  for (const field of metadataFields || []) {
    byName.set(field.name, {
      ...(byName.get(field.name) || {}),
      name: field.name,
      type: field.type || '',
      description: field.description || '',
      inferredDescription: field.description ? '' : explainFieldName(field.name),
      source: byName.has(field.name) ? 'metadata+sdk' : 'metadata',
    });
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toMarkdown(report) {
  const lines = [
    '# Meta Ads API fields inventory',
    '',
    `Generated: ${report.generatedAt}`,
    `API version: ${report.apiVersion}`,
    `Ad account: ${report.adAccountId}`,
    '',
    'Descriptions from Graph metadata are authoritative for the exact token/account/API version used. Empty descriptions mean Meta did not expose a description through metadata or the field came only from the official SDK field constants.',
    '',
  ];

  for (const object of report.objects) {
    lines.push(`## ${object.objectName}`, '');
    lines.push(`Sample object id: ${object.id || 'not found'}`);
    lines.push(`Status: ${object.status}`);
    if (object.graphType) {
      lines.push(`Graph type: ${object.graphType}`);
    }
    lines.push('');
    lines.push('| Field | Type | Description | Source |');
    lines.push('| --- | --- | --- | --- |');

    for (const field of object.fields) {
      const description = field.description || field.inferredDescription || '';
      lines.push(
        `| \`${field.name}\` | ${escapeTable(field.type)} | ${escapeTable(description)} | ${field.source} |`,
      );
    }

    lines.push('');

    if (Object.keys(object.connections || {}).length > 0) {
      lines.push('### Connections', '');
      lines.push('| Connection | URL |');
      lines.push('| --- | --- |');
      for (const [name, url] of Object.entries(object.connections).sort()) {
        lines.push(`| \`${name}\` | ${escapeTable(url)} |`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

function allSdkObjectsToMarkdown(report) {
  const lines = [
    '# Meta Business SDK all adobject fields',
    '',
    `Generated: ${report.generatedAt}`,
    'Source: facebook/facebook-python-business-sdk main branch, facebook_business/adobjects',
    '',
    'This is a broad SDK field inventory. It includes field constants exposed by the official SDK, but does not guarantee that every field is readable for every token, account, API version, objective, or asset type.',
    '',
  ];

  for (const object of report.objects) {
    lines.push(`## ${object.objectName}`, '');
    lines.push(`SDK file: \`${object.file}\``);
    lines.push('');
    lines.push('| Field | SDK constant | Inferred note |');
    lines.push('| --- | --- | --- |');

    for (const field of object.fields) {
      lines.push(
        `| \`${field.name}\` | \`${field.sdkConstant}\` | ${escapeTable(field.inferredDescription)} |`,
      );
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function main() {
  assertEnv();

  await mkdir(outputDir, { recursive: true });

  const adAccountId = await resolveAdAccountId();
  const nodeIds = await discoverSampleNodeIds(adAccountId);
  const sdkFields = await fetchSdkFields();
  const allSdkObjects = await fetchAllSdkObjectFields();

  const objects = [];
  for (const objectName of Object.keys(nodeIds)) {
    const metadata = await fetchMetadata(objectName, nodeIds[objectName]).catch((error) => ({
      objectName,
      id: nodeIds[objectName] || null,
      status: `metadata_error: ${error.message}`,
      fields: [],
      connections: {},
    }));

    objects.push({
      ...metadata,
      fields: mergeFields(metadata.fields, sdkFields[objectName]),
    });
  }

  objects.push({
    objectName: 'AdsInsights',
    id: adAccountId,
    status: 'sdk_fields_only',
    fields: mergeFields([], sdkFields.AdsInsights),
    connections: {},
  });

  const report = {
    generatedAt: new Date().toISOString(),
    apiVersion,
    adAccountId,
    objects,
  };

  const jsonPath = join(outputDir, 'meta-ads-fields.json');
  const markdownPath = join(outputDir, 'meta-ads-fields.md');

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownPath, toMarkdown(report));

  const allSdkReport = {
    generatedAt: report.generatedAt,
    objects: allSdkObjects,
  };
  const allSdkJsonPath = join(outputDir, 'meta-business-sdk-all-fields.json');
  const allSdkMarkdownPath = join(outputDir, 'meta-business-sdk-all-fields.md');

  await writeFile(allSdkJsonPath, `${JSON.stringify(allSdkReport, null, 2)}\n`);
  await writeFile(allSdkMarkdownPath, allSdkObjectsToMarkdown(allSdkReport));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
  console.log(`Wrote ${allSdkJsonPath}`);
  console.log(`Wrote ${allSdkMarkdownPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
