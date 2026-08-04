import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_ads')
export class MetaAd {
  @PrimaryColumn({ type: 'varchar' })
  metaAdId: string;

  @Index('IDX_meta_ads_account')
  @Column({ type: 'varchar' })
  metaAdAccountId: string;

  @Index('IDX_meta_ads_campaign')
  @Column({ type: 'varchar' })
  metaCampaignId: string;

  @Index('IDX_meta_ads_adset')
  @Column({ type: 'varchar' })
  metaAdsetId: string;

  @Index('IDX_meta_ads_creative')
  @Column({ type: 'varchar', nullable: true })
  metaCreativeId?: string | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  effectiveStatus?: string | null;

  @Column({ type: 'varchar', nullable: true })
  conversionDomain?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  trackingSpecs?: unknown | null;

  @Column({ type: 'timestamptz', nullable: true })
  createdTime?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  updatedTime?: Date | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
