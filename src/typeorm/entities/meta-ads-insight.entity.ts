import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_ads_insights')
@Index('IDX_meta_ads_insights_account_date', ['metaAdAccountId', 'dateStart'])
@Index('IDX_meta_ads_insights_ad_date', ['metaAdId', 'dateStart'])
export class MetaAdsInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  metaAdAccountId: string;

  @Column({ type: 'varchar', nullable: true })
  metaCampaignId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  metaAdsetId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  metaAdId?: string | null;

  @Column({ type: 'varchar' })
  level: string;

  @Column({ type: 'date' })
  dateStart: string;

  @Column({ type: 'date' })
  dateStop: string;

  @Column({ type: 'varchar', nullable: true })
  breakdownKey?: string | null;

  @Column({ type: 'varchar', nullable: true })
  age?: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender?: string | null;

  @Column({ type: 'varchar', nullable: true })
  country?: string | null;

  @Column({ type: 'varchar', nullable: true })
  region?: string | null;

  @Column({ type: 'varchar', nullable: true })
  publisherPlatform?: string | null;

  @Column({ type: 'varchar', nullable: true })
  platformPosition?: string | null;

  @Column({ type: 'varchar', nullable: true })
  devicePlatform?: string | null;

  @Column({ type: 'varchar', nullable: true })
  impressionDevice?: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountCurrency?: string | null;

  @Column({ type: 'numeric', nullable: true })
  spend?: string | null;

  @Column({ type: 'bigint', nullable: true })
  impressions?: string | null;

  @Column({ type: 'bigint', nullable: true })
  reach?: string | null;

  @Column({ type: 'numeric', nullable: true })
  frequency?: string | null;

  @Column({ type: 'bigint', nullable: true })
  clicks?: string | null;

  @Column({ type: 'bigint', nullable: true })
  uniqueClicks?: string | null;

  @Column({ type: 'bigint', nullable: true })
  inlineLinkClicks?: string | null;

  @Column({ type: 'bigint', nullable: true })
  uniqueInlineLinkClicks?: string | null;

  @Column({ type: 'bigint', nullable: true })
  outboundClicks?: string | null;

  @Column({ type: 'numeric', nullable: true })
  cpc?: string | null;

  @Column({ type: 'numeric', nullable: true })
  cpm?: string | null;

  @Column({ type: 'numeric', nullable: true })
  cpp?: string | null;

  @Column({ type: 'numeric', nullable: true })
  ctr?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  actions?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  actionValues?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  conversions?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  costPerActionType?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  costPerConversion?: unknown | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
