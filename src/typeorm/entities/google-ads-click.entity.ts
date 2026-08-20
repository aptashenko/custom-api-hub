import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_ads_clicks')
@Index('UQ_google_ads_clicks_customer_date_gclid', ['googleCustomerId', 'date', 'gclid'], { unique: true })
@Index('IDX_google_ads_clicks_gclid', ['gclid'])
@Index('IDX_google_ads_clicks_campaign_date', ['googleCustomerId', 'googleCampaignId', 'date'])
export class GoogleAdsClick {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  googleCustomerId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  gclid?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleCampaignId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  campaignName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdGroupId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  adGroupName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdId?: string | null;

  @Column({ type: 'text', nullable: true })
  keywordText?: string | null;

  @Column({ type: 'varchar', nullable: true })
  keywordMatchType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  device?: string | null;

  @Column({ type: 'varchar', nullable: true })
  adNetworkType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  slot?: string | null;

  @Column({ type: 'varchar', nullable: true })
  clickType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  pageNumber?: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationOfPresenceCity?: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationOfPresenceCountry?: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationOfPresenceRegion?: string | null;

  @Column({ type: 'integer', default: 0 })
  clicks: number;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
