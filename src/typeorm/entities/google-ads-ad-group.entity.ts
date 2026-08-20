import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_ads_ad_groups')
@Index('UQ_google_ads_ad_groups_customer_ad_group', ['googleCustomerId', 'googleAdGroupId'], { unique: true })
@Index('IDX_google_ads_ad_groups_campaign', ['googleCustomerId', 'googleCampaignId'])
export class GoogleAdsAdGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  googleCustomerId: string;

  @Column({ type: 'varchar' })
  googleCampaignId: string;

  @Column({ type: 'varchar' })
  googleAdGroupId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  type?: string | null;

  @Column({ type: 'bigint', nullable: true })
  cpcBidMicros?: string | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
