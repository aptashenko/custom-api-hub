import { Channel, MessageDirection } from '../../typeorm/entities/enums';
import { SendPulseNormalizer } from './sendpulse.normalizer';

describe('SendPulseNormalizer', () => {
  let normalizer: SendPulseNormalizer;

  beforeEach(() => {
    normalizer = new SendPulseNormalizer();
  });

  it('extracts event type', () => {
    const normalized = normalizer.normalize({
      event_type: 'message_received',
    });

    expect(normalized.eventType).toBe('message_received');
  });

  it('extracts external user id', () => {
    const normalized = normalizer.normalize({
      contact: {
        id: 12345,
      },
    });

    expect(normalized.externalUserId).toBe('12345');
  });

  it('extracts message text', () => {
    const normalized = normalizer.normalize({
      message: {
        text: 'Hello',
      },
    });

    expect(normalized.message?.text).toBe('Hello');
  });

  it('extracts UTM from variables', () => {
    const normalized = normalizer.normalize({
      variables: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer',
        utm_content: 'ad-1',
        utm_term: 'crm',
      },
    });

    expect(normalized.utm).toEqual({
      source: 'google',
      medium: 'cpc',
      campaign: 'summer',
      content: 'ad-1',
      term: 'crm',
    });
  });

  it('defaults direction to IN', () => {
    const normalized = normalizer.normalize({
      text: 'Incoming text',
    });

    expect(normalized.message?.direction).toBe(MessageDirection.IN);
  });

  it('detects telegram channel', () => {
    const normalized = normalizer.normalize({
      channel: 'Telegram Bot',
    });

    expect(normalized.channel).toBe(Channel.TELEGRAM);
  });

  it('normalizes real SendPulse telegram webhook payload', () => {
    const normalized = normalizer.normalize([
      {
        info: {
          message: {
            channel_data: {
              message: {
                text: 'hi test bot',
              },
              message_id: 2121,
              chat_id: 380485157,
            },
            id: '6a496b4f67a824bf17040c06',
          },
        },
        service: 'telegram',
        title: 'incoming_message',
        bot: {
          channel: 'TELEGRAM',
        },
        contact: {
          username: 'aptashenko',
          name: 'Ptashenko Artem',
          telegram_id: '380485157',
          id: '6a4969158278b1482a02e7f6',
        },
      },
      {
        info: null,
        service: 'telegram',
        title: 'open_chat',
      },
    ]);

    expect(normalized).toEqual(
      expect.objectContaining({
        source: 'sendpulse',
        channel: Channel.TELEGRAM,
        eventType: 'incoming_message',
        externalUserId: '380485157',
        externalMessageId: '2121',
        client: {
          name: 'Ptashenko Artem',
          phone: undefined,
          email: undefined,
          username: 'aptashenko',
        },
        message: {
          text: 'hi test bot',
          direction: MessageDirection.IN,
        },
      }),
    );
  });
});
