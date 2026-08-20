import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_ads_insights')
@Index('UQ_google_ads_insights_identity', [
  'googleCustomerId',
  'level',
  'dateStart',
  'dateStop',
  'googleCampaignId',
  'googleAdGroupId',
  'googleAdId',
], { unique: true })
@Index('IDX_google_ads_insights_customer_date', ['googleCustomerId', 'dateStart'])
@Index('IDX_google_ads_insights_ad_date', ['googleAdId', 'dateStart'])
export class GoogleAdsInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  googleCustomerId: string;

  @Column({ type: 'varchar', nullable: true })
  googleCampaignId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdGroupId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdId?: string | null;

  @Column({ type: 'varchar' })
  level: string;

  @Column({ type: 'date' })
  dateStart: string;

  @Column({ type: 'date' })
  dateStop: string;

  @Column({ type: 'varchar', nullable: true })
  currencyCode?: string | null;

  @Column({ type: 'bigint', default: 0 })
  impressions: string;

  @Column({ type: 'bigint', default: 0 })
  clicks: string;

  @Column({ type: 'bigint', default: 0 })
  costMicros: string;

  @Column({ type: 'numeric', nullable: true })
  cost?: string | null;

  @Column({ type: 'numeric', nullable: true })
  ctr?: string | null;

  @Column({ type: 'numeric', nullable: true })
  averageCpcMicros?: string | null;

  @Column({ type: 'numeric', nullable: true })
  averageCpc?: string | null;

  @Column({ type: 'numeric', nullable: true })
  averageCpm?: string | null;

  @Column({ type: 'numeric', nullable: true })
  conversions?: string | null;

  @Column({ type: 'numeric', nullable: true })
  conversionsValue?: string | null;

  @Column({ type: 'numeric', nullable: true })
  costPerConversionMicros?: string | null;

  @Column({ type: 'numeric', nullable: true })
  costPerConversion?: string | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
