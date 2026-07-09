import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MakeService {
  private readonly logger = new Logger(MakeService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPayload(payload: Record<string, unknown>): Promise<void> {
    if (this.isDevelopmentMode()) {
      this.logger.log(`Stubbed Make webhook payload=${JSON.stringify(payload)}`);
      return;
    }

    const webhookUrl = this.configService.get<string>('MAKE_WEBHOOK_URL');

    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL is not configured');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Make webhook request failed with status ${response.status}`);
    }
  }

  private isDevelopmentMode(): boolean {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }
}
