import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Channel, MakeWebhookLogStatus } from './enums';
import { MakeSyncEvent } from './make-sync-event.entity';

@Entity()
export class MakeWebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  makeSyncEventId: string;

  @ManyToOne(() => MakeSyncEvent, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'makeSyncEventId' })
  makeSyncEvent: MakeSyncEvent;

  @Column({ type: 'uuid', nullable: true })
  clientId?: string | null;

  @Column({ type: 'integer', nullable: true })
  clientNumber?: number | null;

  @Column({ type: 'text', nullable: true })
  name?: string | null;

  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  username?: string | null;

  @Column({
    type: 'enum',
    enum: Channel,
    enumName: 'channel_enum',
  })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: MakeWebhookLogStatus,
    enumName: 'make_webhook_log_status_enum',
  })
  status: MakeWebhookLogStatus;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  attemptedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
