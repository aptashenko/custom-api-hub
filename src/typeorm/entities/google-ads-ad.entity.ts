import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_ads_ads')
@Index('UQ_google_ads_ads_customer_ad', ['googleCustomerId', 'googleAdId'], { unique: true })
@Index('IDX_google_ads_ads_ad_group', ['googleCustomerId', 'googleAdGroupId'])
@Index('IDX_google_ads_ads_campaign', ['googleCustomerId', 'googleCampaignId'])
export class GoogleAdsAd {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  googleCustomerId: string;

  @Column({ type: 'varchar' })
  googleCampaignId: string;

  @Column({ type: 'varchar' })
  googleAdGroupId: string;

  @Column({ type: 'varchar' })
  googleAdId: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  type?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  finalUrls?: unknown | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
