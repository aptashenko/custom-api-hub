import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SendPulseService } from './sendpulse.service';

describe('SendPulseService', () => {
  let configService: {
    get: jest.Mock;
  };
  let service: SendPulseService;
  let exportDir: string;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    exportDir = await mkdtemp(join(tmpdir(), 'sendpulse-audience-'));
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'SENDPULSE_API_KEY') {
          return 'sp_apikey_test';
        }

        if (key === 'SENDPULSE_CHATBOTS_API_URL') {
          return 'https://api.test/chatbots';
        }

        if (key === 'SENDPULSE_AUDIENCE_EXPORT_DIR') {
          return exportDir;
        }

        return undefined;
      }),
    };
    service = new SendPulseService(configService as never);
  });

  afterEach(async () => {
    fetchSpy?.mockRestore();
    await rm(exportDir, {
      recursive: true,
      force: true,
    });
  });

  it('exports paginated dialogs as audience contacts to a json file', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = input instanceof URL ? input : new URL(String(input));

      if (url.pathname === '/chatbots/account') {
        return jsonResponse({
          success: true,
          data: {
            tags: ['vip'],
            variables: ['phone'],
          },
        });
      }

      if (url.pathname === '/chatbots/bots') {
        return jsonResponse({
          success: true,
          data: [
            {
              id: 'bot-1',
              channel_data: {
                username: 'test_bot',
              },
            },
          ],
        });
      }

      if (url.pathname === '/chatbots/dialogs') {
        const skip = url.searchParams.get('skip');

        if (skip === '0') {
          return jsonResponse({
            success: true,
            data: {
              total: 3,
              list: [
                {
                  _id: 'dialog-1',
                  bot_id: 'bot-1',
                  contact: {
                    id: 'contact-1',
                    full_name: 'Alex',
                    tags: ['lead'],
                    variables: {
                      phone: '+10000000000',
                    },
                  },
                },
                {
                  _id: 'dialog-2',
                  bot_id: 'bot-1',
                  contact: {
                    id: 'contact-2',
                    full_name: 'Sam',
                  },
                },
              ],
            },
          });
        }

        return jsonResponse({
          success: true,
          data: {
            total: 3,
            list: [
              {
                _id: 'dialog-3',
                bot_id: 'bot-1',
                contact: {
                  id: 'contact-1',
                  full_name: 'Alex',
                  tags: ['lead'],
                },
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected URL ${url.toString()}`);
    });

    const result = await service.exportAudienceToFile({
      fileName: 'audience.json',
      pageSize: 2,
    });
    const exported = JSON.parse(await readFile(result.filePath, 'utf8')) as {
      totals: {
        bots: number;
        dialogs: number;
        contacts: number;
      };
      contacts: Array<{
        contactId?: string;
        dialogIds: string[];
        rawDialogs: unknown[];
      }>;
    };

    expect(result.filePath).toBe(join(exportDir, 'audience.json'));
    expect(result.totals).toEqual({
      bots: 1,
      dialogs: 3,
      contacts: 2,
    });
    expect(exported.totals).toEqual(result.totals);
    expect(exported.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactId: 'contact-1',
          dialogIds: ['dialog-1', 'dialog-3'],
          rawDialogs: expect.arrayContaining([
            expect.objectContaining({
              _id: 'dialog-1',
            }),
            expect.objectContaining({
              _id: 'dialog-3',
            }),
          ]),
        }),
      ]),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sp_apikey_test',
        }),
      }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}
