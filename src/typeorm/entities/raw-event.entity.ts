import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('raw_events')
export class RawEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  eventType?: string | null;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Index('IDX_raw_event_processed')
  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
