import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_adsets')
export class MetaAdset {
  @PrimaryColumn({ type: 'varchar' })
  metaAdsetId: string;

  @Index('IDX_meta_adsets_account')
  @Column({ type: 'varchar' })
  metaAdAccountId: string;

  @Index('IDX_meta_adsets_campaign')
  @Column({ type: 'varchar' })
  metaCampaignId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  effectiveStatus?: string | null;

  @Column({ type: 'varchar', nullable: true })
  optimizationGoal?: string | null;

  @Column({ type: 'varchar', nullable: true })
  billingEvent?: string | null;

  @Column({ type: 'varchar', nullable: true })
  bidStrategy?: string | null;

  @Column({ type: 'numeric', nullable: true })
  dailyBudget?: string | null;

  @Column({ type: 'numeric', nullable: true })
  lifetimeBudget?: string | null;

  @Column({ type: 'numeric', nullable: true })
  budgetRemaining?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  targeting?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  promotedObject?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  attributionSpec?: unknown | null;

  @Column({ type: 'timestamptz', nullable: true })
  startTime?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endTime?: Date | null;

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
