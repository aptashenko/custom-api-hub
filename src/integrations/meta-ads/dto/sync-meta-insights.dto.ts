export class SyncMetaInsightsDto {
  since?: string;
  until?: string;
  accountIds?: string[];
  breakdowns?: string[];
  chunkDays?: number;
}
