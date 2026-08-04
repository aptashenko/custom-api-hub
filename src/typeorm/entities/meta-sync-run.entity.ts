import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_sync_runs')
export class MetaSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'varchar' })
  syncType: string;

  @Column({ type: 'varchar', nullable: true })
  metaAdAccountId?: string | null;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'date', nullable: true })
  dateFrom?: string | null;

  @Column({ type: 'date', nullable: true })
  dateTo?: string | null;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ type: 'integer', default: 0 })
  fetchedCount: number;

  @Column({ type: 'integer', default: 0 })
  createdCount: number;

  @Column({ type: 'integer', default: 0 })
  updatedCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  raw?: unknown | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
