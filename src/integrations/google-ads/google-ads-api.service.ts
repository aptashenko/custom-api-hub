import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GoogleAdsSearchStreamChunk {
  results?: Array<Record<string, unknown>>;
  error?: {
    message?: string;
  };
}

@Injectable()
export class GoogleAdsApiService {
  private accessToken?: {
    value: string;
    expiresAt: number;
  };

  constructor(private readonly configService: ConfigService) {}

  getConfiguredCustomerIds(): string[] {
    const raw =
      this.configService.get<string>('GOOGLE_ADS_CUSTOMER_IDS') ??
      this.configService.get<string>('GOOGLE_ADS_CUSTOMER_ID') ??
      '';

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.replaceAll('-', ''));
  }

  async search(
    customerId: string,
    query: string,
  ): Promise<Array<Record<string, unknown>>> {
    const apiVersion =
      this.configService.get<string>('GOOGLE_ADS_API_VERSION') ?? 'v25';
    const cleanCustomerId = customerId.replaceAll('-', '');
    const response = await fetch(
      `https://googleads.googleapis.com/${apiVersion}/customers/${cleanCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: await this.buildHeaders(),
        body: JSON.stringify({ query }),
      },
    );
    const body = await response.text();
    let chunks: GoogleAdsSearchStreamChunk[];

    try {
      chunks = JSON.parse(body) as GoogleAdsSearchStreamChunk[];
    } catch {
      throw new Error(
        `Google Ads API returned non-JSON response: ${body.slice(0, 300)}`,
      );
    }

    if (!response.ok) {
      throw new Error(this.extractErrorMessage(chunks) ?? response.statusText);
    }

    return chunks.flatMap((chunk) => chunk.results ?? []);
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.getAccessToken()}`,
      'Content-Type': 'application/json',
      'developer-token': this.configService.getOrThrow<string>(
        'GOOGLE_ADS_DEVELOPER_TOKEN',
      ),
    };
    const loginCustomerId = this.configService.get<string>(
      'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
    );

    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId.replaceAll('-', '');
    }

    return headers;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.configService.getOrThrow<string>('GOOGLE_ADS_CLIENT_ID'),
        client_secret: this.configService.getOrThrow<string>(
          'GOOGLE_ADS_CLIENT_SECRET',
        ),
        refresh_token: this.configService.getOrThrow<string>(
          'GOOGLE_ADS_REFRESH_TOKEN',
        ),
        grant_type: 'refresh_token',
      }),
    });
    const body = await response.text();
    let json: {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`Google OAuth returned non-JSON response: ${body.slice(0, 300)}`);
    }

    if (!response.ok || !json.access_token) {
      throw new Error(json.error_description ?? json.error ?? response.statusText);
    }

    this.accessToken = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };

    return this.accessToken.value;
  }

  private extractErrorMessage(chunks: GoogleAdsSearchStreamChunk[]): string | null {
    return chunks.find((chunk) => chunk.error?.message)?.error?.message ?? null;
  }
}
