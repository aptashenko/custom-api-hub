import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_ads_campaigns')
@Index('UQ_google_ads_campaigns_customer_campaign', ['googleCustomerId', 'googleCampaignId'], { unique: true })
export class GoogleAdsCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  googleCustomerId: string;

  @Column({ type: 'varchar' })
  googleCampaignId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  advertisingChannelType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  advertisingChannelSubType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  biddingStrategyType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  campaignBudgetId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  campaignBudgetName?: string | null;

  @Column({ type: 'bigint', nullable: true })
  campaignBudgetAmountMicros?: string | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
