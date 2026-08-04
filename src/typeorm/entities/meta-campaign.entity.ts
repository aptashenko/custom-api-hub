import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_campaigns')
export class MetaCampaign {
  @PrimaryColumn({ type: 'varchar' })
  metaCampaignId: string;

  @Index('IDX_meta_campaigns_account')
  @Column({ type: 'varchar' })
  metaAdAccountId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  objective?: string | null;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  effectiveStatus?: string | null;

  @Column({ type: 'varchar', nullable: true })
  buyingType?: string | null;

  @Column({ type: 'numeric', nullable: true })
  dailyBudget?: string | null;

  @Column({ type: 'numeric', nullable: true })
  lifetimeBudget?: string | null;

  @Column({ type: 'numeric', nullable: true })
  budgetRemaining?: string | null;

  @Column({ type: 'numeric', nullable: true })
  spendCap?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startTime?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  stopTime?: Date | null;

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
