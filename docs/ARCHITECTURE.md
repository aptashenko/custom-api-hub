
## `docs/ARCHITECTURE.md`

```md
# Architecture

## Purpose

Customer Hub provides a centralized backend for customer events and communication history.

## Flow

External Channels
→ Webhook API
→ Raw Event Storage
→ Normalization
→ Client Resolution
→ Data Storage
→ Event Aggregation
→ Make
→ Kommo

## Responsibilities

### Customer Hub

- receive webhooks
- store raw events
- normalize external payloads
- identify clients
- store contact identities
- store messages
- store UTM data
- aggregate messages
- send clean events to Make

### Make

- receive aggregated events
- synchronize data with Kommo
- update contacts
- add notes
- create tasks

### Kommo

Kommo is used as the operational client card for managers.

Kommo is not the source of truth.

### PostgreSQL

PostgreSQL is the source of truth for customer data and interaction history.