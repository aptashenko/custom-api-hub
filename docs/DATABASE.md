# Database

## Client

Represents one real customer.

## ContactIdentity

Represents a customer identity in an external channel.

Examples:

- Telegram user ID
- Instagram user ID
- WhatsApp identity

A client can have multiple identities.

## Conversation

Represents a communication context with a client.

## Message

Represents an incoming or outgoing message.

## LeadSource

Stores UTM and acquisition source information.

A client may have multiple lead sources.

## RawEvent

Stores the original external webhook payload.

Raw events are used for debugging and reprocessing.

## MakeSyncEvent

Stores events prepared for delivery to Make.

Used for delivery tracking and retry.

## Reporting

Looker Studio access is documented in [LOOKER_STUDIO.md](./LOOKER_STUDIO.md).
