import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_ads_sync_runs')
export class GoogleAdsSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'text', array: true, default: '{}' })
  googleCustomerIds: string[];

  @Column({ type: 'date', nullable: true })
  dateFrom?: string | null;

  @Column({ type: 'date', nullable: true })
  dateTo?: string | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: unknown | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
