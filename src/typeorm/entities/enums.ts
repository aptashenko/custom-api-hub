export enum Channel {
  TELEGRAM = 'TELEGRAM',
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
  WEBSITE = 'WEBSITE',
  SENDPULSE = 'SENDPULSE',
  CUSTOM = 'CUSTOM',
}

export enum ConversationStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
}

export enum MessageDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum MakeSyncStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}
