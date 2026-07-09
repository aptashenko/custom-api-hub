import { ConfigService } from '@nestjs/config';

import { MakeService } from './make.service';

describe('MakeService', () => {
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let service: MakeService;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };
    service = new MakeService(configService as never);
  });

  it('logs payload instead of sending webhook outside production', async () => {
    configService.get.mockReturnValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      service.sendPayload({
        client: {
          id: 'client-id',
        },
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires webhook url in production', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'NODE_ENV' ? 'production' : undefined,
    );

    await expect(service.sendPayload({})).rejects.toThrow(
      'MAKE_WEBHOOK_URL is not configured',
    );
  });

  it('sends webhook in production when url is configured', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') {
        return 'production';
      }

      if (key === 'MAKE_WEBHOOK_URL') {
        return 'https://make.example/webhook';
      }

      return undefined;
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    await service.sendPayload({
      message: 'Hello',
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://make.example/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello',
      }),
    });
  });
});
