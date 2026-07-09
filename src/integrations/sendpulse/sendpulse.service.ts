import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

interface SendPulseApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

interface SendPulseBot {
  id?: string;
  [key: string]: unknown;
}

interface SendPulseContact {
  id?: string;
  [key: string]: unknown;
}

interface SendPulseDialog {
  _id?: string;
  bot_id?: string;
  contact?: SendPulseContact;
  [key: string]: unknown;
}

interface SendPulseDialogsData {
  list?: SendPulseDialog[];
  total?: number;
  size?: number;
  search_after?: string;
  order?: string;
  [key: string]: unknown;
}

interface SendPulseOAuthResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  [key: string]: unknown;
}

export interface SendPulseAudienceContact {
  key: string;
  botId?: string;
  contactId?: string;
  dialogIds: string[];
  tags?: unknown[];
  variables?: Record<string, unknown>;
  rawContact?: SendPulseContact;
  rawDialogs: SendPulseDialog[];
}

export interface SendPulseAudienceExport {
  exportedAt: string;
  botId?: string;
  totals: {
    bots: number;
    dialogs: number;
    contacts: number;
  };
  account?: unknown;
  bots: SendPulseBot[];
  contacts: SendPulseAudienceContact[];
  dialogs: SendPulseDialog[];
}

export interface ExportSendPulseAudienceOptions {
  botId?: string;
  fileName?: string;
  filePath?: string;
  pageSize?: number;
}

export interface ExportSendPulseAudienceResult {
  filePath: string;
  exportedAt: string;
  totals: SendPulseAudienceExport['totals'];
}

@Injectable()
export class SendPulseService {
  private readonly logger = new Logger(SendPulseService.name);
  private cachedOAuthToken?: {
    token: string;
    expiresAt: number;
  };

  constructor(private readonly configService: ConfigService) {}

  async exportAudienceToFile(
    options: ExportSendPulseAudienceOptions = {},
  ): Promise<ExportSendPulseAudienceResult> {
    const audience = await this.getAudience(options);
    const filePath = this.resolveExportFilePath(options);

    await mkdir(dirname(filePath), {
      recursive: true,
    });
    await writeFile(filePath, `${JSON.stringify(audience, null, 2)}\n`, 'utf8');

    this.logger.log(
      `Exported SendPulse audience filePath=${filePath} contacts=${audience.totals.contacts} dialogs=${audience.totals.dialogs}`,
    );

    return {
      filePath,
      exportedAt: audience.exportedAt,
      totals: audience.totals,
    };
  }

  async getAudience(
    options: Pick<ExportSendPulseAudienceOptions, 'botId' | 'pageSize'> = {},
  ): Promise<SendPulseAudienceExport> {
    const [account, bots, dialogs] = await Promise.all([
      this.getAccount(),
      this.getBots(),
      this.getDialogs(options.pageSize),
    ]);
    const filteredDialogs = options.botId
      ? dialogs.filter((dialog) => dialog.bot_id === options.botId)
      : dialogs;
    const contacts = this.buildContacts(filteredDialogs);

    return {
      exportedAt: new Date().toISOString(),
      botId: options.botId,
      totals: {
        bots: bots.length,
        dialogs: filteredDialogs.length,
        contacts: contacts.length,
      },
      account,
      bots,
      contacts,
      dialogs: filteredDialogs,
    };
  }

  private async getAccount(): Promise<unknown> {
    const response = await this.request<SendPulseApiResponse<unknown>>('/account');

    return response.data;
  }

  private async getBots(): Promise<SendPulseBot[]> {
    const response = await this.request<SendPulseApiResponse<unknown>>('/bots');

    return Array.isArray(response.data)
      ? response.data.filter(this.isRecord) as SendPulseBot[]
      : [];
  }

  private async getDialogs(pageSizeOption?: number): Promise<SendPulseDialog[]> {
    const pageSize = this.resolvePageSize(pageSizeOption);
    const dialogs: SendPulseDialog[] = [];
    let skip = 0;

    while (true) {
      const response = await this.request<
        SendPulseApiResponse<SendPulseDialogsData>
      >('/dialogs', {
        size: String(pageSize),
        skip: String(skip),
        order: 'asc',
      });
      const data = this.isRecord(response.data) ? response.data : {};
      const page = Array.isArray(data.list)
        ? data.list.filter(this.isRecord) as SendPulseDialog[]
        : [];

      dialogs.push(...page);

      if (page.length === 0) {
        break;
      }

      if (typeof data.total === 'number' && dialogs.length >= data.total) {
        break;
      }

      if (page.length < pageSize) {
        break;
      }

      skip += page.length;
    }

    return dialogs;
  }

  private buildContacts(dialogs: SendPulseDialog[]): SendPulseAudienceContact[] {
    const contactsByKey = new Map<string, SendPulseAudienceContact>();

    for (const dialog of dialogs) {
      const rawContact = this.isRecord(dialog.contact) ? dialog.contact : undefined;
      const botId = this.getString(dialog.bot_id);
      const contactId = rawContact ? this.getString(rawContact.id) : undefined;
      const dialogId = this.getString(dialog._id);
      const key = this.buildContactKey({
        botId,
        contactId,
        dialogId,
        fallbackIndex: contactsByKey.size,
      });
      const existing = contactsByKey.get(key);

      if (existing) {
        if (dialogId && !existing.dialogIds.includes(dialogId)) {
          existing.dialogIds.push(dialogId);
        }
        existing.rawDialogs.push(dialog);
        continue;
      }

      contactsByKey.set(key, {
        key,
        botId,
        contactId,
        dialogIds: dialogId ? [dialogId] : [],
        tags: this.extractTags(rawContact, dialog),
        variables: this.extractVariables(rawContact, dialog),
        rawContact,
        rawDialogs: [dialog],
      });
    }

    return [...contactsByKey.values()];
  }

  private async request<T>(
    path: string,
    query?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.getChatbotsApiUrl()}${path}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: await this.getAuthorizationHeader(),
      },
    });
    const parsed = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        `SendPulse request failed path=${path} status=${response.status} response=${JSON.stringify(parsed)}`,
      );
    }

    if (
      this.isRecord(parsed) &&
      parsed.success === false
    ) {
      throw new Error(
        `SendPulse request failed path=${path} response=${JSON.stringify(parsed)}`,
      );
    }

    return parsed as T;
  }

  private async getAuthorizationHeader(): Promise<string> {
    const apiKey = this.configService.get<string>('SENDPULSE_API_KEY');

    if (apiKey) {
      return `Bearer ${apiKey}`;
    }

    return `Bearer ${await this.getOAuthToken()}`;
  }

  private async getOAuthToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedOAuthToken && this.cachedOAuthToken.expiresAt > now) {
      return this.cachedOAuthToken.token;
    }

    const clientId = this.configService.get<string>('SENDPULSE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SENDPULSE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error(
        'SENDPULSE_API_KEY or SENDPULSE_CLIENT_ID/SENDPULSE_CLIENT_SECRET is not configured',
      );
    }

    const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const parsed = await this.parseResponse(response);

    if (!response.ok || !this.isRecord(parsed)) {
      throw new Error(
        `SendPulse auth failed status=${response.status} response=${JSON.stringify(parsed)}`,
      );
    }

    const auth = parsed as SendPulseOAuthResponse;

    if (!auth.access_token) {
      throw new Error(
        `SendPulse auth response is missing access_token response=${JSON.stringify(parsed)}`,
      );
    }

    this.cachedOAuthToken = {
      token: auth.access_token,
      expiresAt: now + Math.max((auth.expires_in ?? 3600) - 60, 60) * 1000,
    };

    return auth.access_token;
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();

    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private resolveExportFilePath(options: ExportSendPulseAudienceOptions): string {
    if (options.filePath) {
      return isAbsolute(options.filePath)
        ? options.filePath
        : join(process.cwd(), options.filePath);
    }

    const exportDir =
      this.configService.get<string>('SENDPULSE_AUDIENCE_EXPORT_DIR') ??
      join(process.cwd(), 'exports');
    const fileName = options.fileName ?? this.createDefaultFileName();

    if (fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('SendPulse audience export fileName must not contain path separators');
    }

    return join(exportDir, fileName);
  }

  private createDefaultFileName(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    return `sendpulse-audience-${timestamp}.json`;
  }

  private getChatbotsApiUrl(): string {
    const configuredUrl = this.configService.get<string>('SENDPULSE_CHATBOTS_API_URL');
    const apiUrl = configuredUrl ?? 'https://api.sendpulse.com/chatbots';

    return apiUrl.replace(/\/$/, '');
  }

  private resolvePageSize(pageSizeOption?: number): number {
    const configured = Number(
      this.configService.get<string>('SENDPULSE_AUDIENCE_PAGE_SIZE'),
    );
    const pageSize = pageSizeOption ?? configured;

    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return 100;
    }

    return Math.min(Math.floor(pageSize), 500);
  }

  private buildContactKey(input: {
    botId?: string;
    contactId?: string;
    dialogId?: string;
    fallbackIndex: number;
  }): string {
    if (input.botId && input.contactId) {
      return `${input.botId}:${input.contactId}`;
    }

    if (input.contactId) {
      return `contact:${input.contactId}`;
    }

    if (input.dialogId) {
      return `dialog:${input.dialogId}`;
    }

    return `unknown:${input.fallbackIndex}`;
  }

  private extractTags(
    contact: SendPulseContact | undefined,
    dialog: SendPulseDialog,
  ): unknown[] | undefined {
    const contactTags = contact ? this.getUnknownArray(contact.tags) : undefined;

    return contactTags ?? this.getUnknownArray(dialog.tags);
  }

  private extractVariables(
    contact: SendPulseContact | undefined,
    dialog: SendPulseDialog,
  ): Record<string, unknown> | undefined {
    const contactVariables = contact
      ? this.getRecord(contact.variables ?? contact.custom_fields)
      : undefined;

    return contactVariables ?? this.getRecord(dialog.variables ?? dialog.custom_fields);
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
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
