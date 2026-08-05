import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MetaApiListResponse<T> {
  data?: T[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
  };
}

@Injectable()
export class MetaAdsApiService {
  private readonly apiVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.apiVersion = this.configService.get<string>('META_API_VERSION') ?? 'v25.0';
  }

  getConfiguredAccountIds(): string[] {
    const raw = this.configService.get<string>('META_AD_ACCOUNT_IDS');
    const fallback = this.configService.get<string>('META_AD_ACCOUNT_ID');

    return (raw ?? fallback ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (value.startsWith('act_') ? value : `act_${value}`));
  }

  async get<T extends Record<string, unknown>>(
    path: string,
    params: Record<string, string | undefined> = {},
  ): Promise<T> {
    const response = await this.fetchJson<T>(this.buildUrl(path, params));

    return response;
  }

  async list<T extends Record<string, unknown>>(
    path: string,
    params: Record<string, string | undefined> = {},
  ): Promise<T[]> {
    const rows: T[] = [];
    let url: URL | undefined = this.buildUrl(path, params);

    while (url) {
      const response: MetaApiListResponse<T> =
        await this.fetchJson<MetaApiListResponse<T>>(url);
      rows.push(...(response.data ?? []));
      url = response.paging?.next ? new URL(response.paging.next) : undefined;
    }

    return rows;
  }

  private buildUrl(
    path: string,
    params: Record<string, string | undefined>,
  ): URL {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(`https://graph.facebook.com/${this.apiVersion}/${cleanPath}`);
    const accessToken = this.configService.getOrThrow<string>('META_ACCESS_TOKEN');

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    url.searchParams.set('access_token', accessToken);

    return url;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetch(url);
      const body = await response.text();
      let json: T & { error?: { message?: string } };

      try {
        json = JSON.parse(body);
      } catch {
        throw new Error(`Meta API returned non-JSON response: ${body.slice(0, 300)}`);
      }

      if (!response.ok || json.error) {
        const message = json.error?.message ?? response.statusText;

        if (attempt < maxAttempts && this.isRetryableError(message, response.status)) {
          await this.sleep(1000 * attempt * attempt);
          continue;
        }

        throw new Error(message);
      }

      return json;
    }

    throw new Error('Meta API request failed');
  }

  private isRetryableError(message: string, status: number): boolean {
    return status >= 500
      || message.includes('Service temporarily unavailable')
      || message.includes('An unknown error occurred');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
