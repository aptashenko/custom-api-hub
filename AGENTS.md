# AGENTS.md

## Project

Customer Hub API is a backend service that receives webhook events from external communication channels, normalizes them, stores customer data and messages, aggregates events, and sends clean events to Make.

Current MVP flow:

External service
→ Webhook endpoint
→ Raw event storage
→ Event normalization
→ Client resolution
→ Message / UTM storage
→ Debounce / aggregation
→ Make webhook

Make is responsible for Kommo integration.

## Tech Stack

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- Redis
- BullMQ
- Docker

## Architecture Rules

Use a modular NestJS architecture.

Business logic must not live in controllers.

Controllers:
- receive HTTP requests
- validate input
- call application services
- return responses

Services:
- contain business logic

Normalizers:
- convert external payloads into NormalizedEvent

Repositories / TypeORM:
- handle persistence

Workers:
- handle asynchronous jobs and event aggregation

External integrations:
- must be isolated in integration modules

## Main Modules

Expected modules:

- typeORM
- health
- webhooks
- raw-events
- events
- clients
- identities
- conversations
- messages
- lead-sources
- aggregation
- integrations
- make

Do not create unnecessary modules.

Keep MVP scope small.

## Webhook Flow

Webhook controllers must follow this flow:

1. Receive payload.
2. Store raw payload in RawEvent.
3. Select source normalizer.
4. Convert payload to NormalizedEvent.
5. Resolve existing client or create a new client.
6. Resolve ContactIdentity.
7. Store UTM data when available.
8. Store message when available.
9. Schedule aggregation/debounce job.
10. Return HTTP response quickly.

Do not call Make synchronously from webhook controllers.

## Normalized Event

All external events must be converted to a common internal format.

```ts
export interface NormalizedEvent {
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

  raw: unknown;
}