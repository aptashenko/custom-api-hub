# Webhook Flow

Этот документ описывает, что происходит в системе, когда пользователь заходит в
бота, нажимает `/start`, отправляет сообщения, а Customer Hub сохраняет клиента,
сообщения, UTM-метки и готовит данные для Make.

## Коротко

Внешние сервисы присылают webhook-и в разном формате. Поэтому сначала мы
приводим каждый webhook к единому внутреннему формату `NormalizedEvent`.

После нормализации остальная система уже не зависит от конкретного формата
SendPulse, Telegram, WhatsApp или другого канала.

## Общая Схема

```text
Пользователь
-> Telegram / WhatsApp / другой канал
-> SendPulse
-> POST /webhooks/sendpulse
-> raw_events
-> NormalizedEvent
-> client / contact_identity
-> message / lead_source
-> make_sync_event
-> Make
-> Kommo
```

Make отвечает за интеграцию с Kommo. Webhook controller не вызывает Make
напрямую.

## 1. Пользователь Заходит В Бота

Пользователь открывает бота и нажимает `/start`.

Если ссылка была рекламной, в ней могут быть UTM-метки. Например:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
```

SendPulse получает событие от Telegram и отправляет webhook в наш API:

```text
POST /webhooks/sendpulse
```

## 2. Сохраняем Сырой Webhook

Сначала API сохраняет оригинальный payload без изменений в таблицу:

```text
raw_events
```

Зачем это нужно:

- можно посмотреть, что реально прислал SendPulse;
- можно отлаживать normalizer;
- можно восстановить данные, если логика нормализации изменится.

Основные поля:

```text
id
source
eventType
payload
processed
createdAt
updatedAt
```

## 3. Нормализуем Payload

После сохранения raw event вызывается `SendPulseNormalizer`.

Он превращает payload SendPulse в единый формат:

```ts
interface NormalizedEvent {
  source: string;
  channel: Channel;
  eventType: string;

  externalUserId?: string;
  externalMessageId?: string;

  client: {
    name?: string;
    phone?: string;
    email?: string;
    username?: string;
  };

  message?: {
    text?: string;
    direction: MessageDirection;
  };

  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };

  rawEventId?: string;
  raw: unknown;
}
```

Пример нормализованного Telegram-сообщения:

```json
{
  "source": "sendpulse",
  "channel": "TELEGRAM",
  "eventType": "incoming_message",
  "externalUserId": "380485157",
  "externalMessageId": "2138",
  "client": {
    "name": "Ptashenko Artem",
    "username": "aptashenko"
  },
  "message": {
    "text": "helloooo",
    "direction": "IN"
  },
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "test"
  }
}
```

Важно: `NormalizedEvent` сейчас отдельно в БД не сохраняется. Это промежуточная
структура в памяти.

## 4. Как Ищется Клиент

Клиент ищется в `ClientResolverService`.

Порядок такой:

```text
1. Если есть externalUserId, ищем contact_identity по channel + externalId.
2. Если identity найдена, берём связанного client.
3. Если identity не найдена, ищем client по phone.
4. Если по phone не нашли, ищем client по email.
5. Если client всё ещё не найден, создаём нового client.
6. Если externalUserId есть, но identity не было, создаём contact_identity.
```

## 5. Что Такое Client

`client` — это внутренний клиент в нашей системе. Это не Telegram-пользователь и
не WhatsApp-пользователь, а именно человек/контакт внутри Customer Hub.

Таблица:

```text
client
```

Поля:

```text
id
name
phone
email
createdAt
updatedAt
```

Пример:

```text
id    = edf4849d-7023-4cc1-b10c-aa6337b5c34e
name  = Ptashenko Artem
phone = null
email = null
```

## 6. Что Такое ContactIdentity

`contact_identity` — это внешний аккаунт клиента в конкретном канале.

Например, Telegram identity:

```text
channel    = TELEGRAM
externalId = 380485157
username   = aptashenko
```

Таблица:

```text
contact_identity
```

Поля:

```text
id
clientId
channel
externalId
username
phone
email
createdAt
updatedAt
```

Пример:

```text
clientId   = edf4849d-7023-4cc1-b10c-aa6337b5c34e
channel    = TELEGRAM
externalId = 380485157
username   = aptashenko
```

В таблице есть уникальность по паре:

```text
channel + externalId
```

Это значит, что один и тот же Telegram user id не может случайно привязаться к
двум разным клиентам в рамках Telegram.

## 7. Если Тот Же Человек Придёт Из WhatsApp

Для WhatsApp будет другая identity:

```text
channel = WHATSAPP
externalId = whatsapp-user-id
```

Система сначала попробует найти именно такую WhatsApp identity.

Если её нет, система попробует найти существующего клиента по телефону или email.

Если WhatsApp прислал тот же phone или email, что уже есть у клиента, новая
WhatsApp identity будет привязана к существующему client:

```text
Client Artem
  -> TELEGRAM externalId=380485157
  -> WHATSAPP externalId=whatsapp-user-id
```

Если phone/email нет или они не совпали, будет создан новый client. Это может
создать дубль, и потом его можно будет объединять отдельной логикой.

## 8. Как Сохраняется Сообщение

Если в `NormalizedEvent` есть текст сообщения, оно сохраняется в таблицу:

```text
message
```

Поля:

```text
id
clientId
conversationId
channel
direction
text
externalMessageId
createdAt
```

Пример:

```text
clientId          = edf4849d-7023-4cc1-b10c-aa6337b5c34e
channel           = TELEGRAM
direction         = IN
text              = helloooo
externalMessageId = 2138
```

## 9. Как Сохраняются UTM-Метки

Если SendPulse прислал UTM-метки, они сохраняются в таблицу:

```text
lead_source
```

Поля:

```text
id
clientId
utmSource
utmMedium
utmCampaign
utmContent
utmTerm
referrer
landingPage
createdAt
```

Если UTM-меток нет, запись в `lead_source` не создаётся.

## 10. Почему Make Не Вызывается Сразу

Webhook controller должен быстро принять событие и вернуть ответ.

Поэтому Make не вызывается синхронно из webhook-а.

Вместо этого создаётся pending event:

```text
make_sync_event
```

В нём хранится:

```text
status = PENDING
clientId
payload.channel
payload.messageIds
payload.debounceUntil
```

Сейчас debounce равен 60 секундам.

Это значит: если пользователь отправил несколько сообщений подряд, они попадут в
один payload для Make.

## 11. Как Мы Избегаем Повторов Сообщений

В pending event сохраняются id только новых сообщений текущего debounce-окна:

```json
{
  "messageIds": [
    "7cb37e60-8286-4cba-94d3-be56ae26cf3d"
  ]
}
```

Когда приходит второе сообщение до истечения debounce, оно добавляется в тот же
массив:

```json
{
  "messageIds": [
    "7cb37e60-8286-4cba-94d3-be56ae26cf3d",
    "162ca337-1c39-46c0-a37a-66bfc78ed868"
  ]
}
```

Когда event отправлен в Make, он получает статус `SENT`.

Следующие сообщения создают новый pending event с новыми `messageIds`. Старые
сообщения больше не отправляются повторно.

## 12. Как Pending Event Отправляется В Make

Для обработки pending-событий вызывается:

```text
POST /make-sync/process-pending
```

Сервис ищет события:

```text
status = PENDING
sentAt IS NULL
payload.debounceUntil <= now
```

Потом он собирает финальный payload только по `messageIds` этого события.

В dev-режиме Make не вызывается. Payload просто печатается в лог:

```text
Stubbed Make webhook payload=...
```

В production-режиме payload отправляется в:

```text
MAKE_WEBHOOK_URL
```

## 13. Что Отправляется В Make

Пример финального payload:

```json
{
  "client": {
    "id": "edf4849d-7023-4cc1-b10c-aa6337b5c34e",
    "name": "Ptashenko Artem",
    "phone": null,
    "email": null
  },
  "clientCard": {
    "id": "edf4849d-7023-4cc1-b10c-aa6337b5c34e",
    "clientNumber": 1001,
    "profile": {
      "name": "Ptashenko Artem",
      "phone": null,
      "email": null,
      "username": "ptashenko",
      "avatarUrl": null
    },
    "sendPulse": {
      "contactId": "contact-id",
      "botId": "bot-id",
      "pipeline": null,
      "tags": ["lead"],
      "variables": {}
    },
    "activity": {
      "messageCount": 1,
      "lastMessageText": "helloooo",
      "lastMessageAt": "2026-07-04T21:05:00.692Z"
    },
    "identities": [
      {
        "channel": "TELEGRAM",
        "externalId": "telegram-user-id",
        "username": "ptashenko",
        "phone": null,
        "email": null
      }
    ],
    "leadSources": [],
    "recentMessages": [
      {
        "id": "7cb37e60-8286-4cba-94d3-be56ae26cf3d",
        "channel": "TELEGRAM",
        "direction": "IN",
        "text": "helloooo",
        "externalMessageId": "external-message-id",
        "createdAt": "2026-07-04T21:05:00.692Z"
      }
    ]
  },
  "channel": "TELEGRAM",
  "messages": [
    {
      "id": "7cb37e60-8286-4cba-94d3-be56ae26cf3d",
      "text": "helloooo",
      "createdAt": "2026-07-04T21:05:00.692Z"
    }
  ],
  "lastMessageAt": "2026-07-04T21:05:00.692Z"
}
```

`clientCard.sendPulse.rawContact` намеренно не отправляется в Make: это сырой
объект SendPulse, который может быть большим и нестабильным.

Если отправка успешна:

```text
make_sync_event.status = SENT
make_sync_event.sentAt = current timestamp
```

Если отправка упала:

```text
make_sync_event.status = FAILED
make_sync_event.error = текст ошибки
```

## Как Проверять В БД

### Посмотреть Клиентов

```sql
SELECT
  id,
  name,
  phone,
  email,
  "createdAt",
  "updatedAt"
FROM client
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Посмотреть Identities

```sql
SELECT
  id,
  "clientId",
  channel,
  "externalId",
  username,
  phone,
  email
FROM contact_identity
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Посмотреть Сообщения Клиента

```sql
SELECT
  id,
  channel,
  direction,
  text,
  "externalMessageId",
  "createdAt"
FROM message
WHERE "clientId" = 'client-id-here'
ORDER BY "createdAt" ASC;
```

### Посмотреть Pending/Sent Events Для Make

```sql
SELECT
  id,
  status,
  "clientId",
  "sentAt",
  error,
  jsonb_pretty(payload) AS payload
FROM make_sync_event
ORDER BY "updatedAt" DESC
LIMIT 10;
```

### Посмотреть Последний Raw Webhook

```sql
SELECT
  id,
  source,
  "eventType",
  jsonb_pretty(payload) AS payload
FROM raw_events
ORDER BY "createdAt" DESC
LIMIT 1;
```
