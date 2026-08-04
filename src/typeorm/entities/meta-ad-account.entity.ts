import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_ad_accounts')
export class MetaAdAccount {
  @PrimaryColumn({ type: 'varchar' })
  metaAdAccountId: string;

  @Column({ type: 'varchar' })
  accountId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'integer', nullable: true })
  accountStatus?: number | null;

  @Column({ type: 'varchar', nullable: true })
  currency?: string | null;

  @Column({ type: 'varchar', nullable: true })
  timezoneName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  businessId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  businessName?: string | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
