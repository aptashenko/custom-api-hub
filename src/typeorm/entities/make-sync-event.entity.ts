import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Client } from './client.entity';
import { Conversation } from './conversation.entity';
import { MakeSyncStatus } from './enums';

@Entity()
export class MakeSyncEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  clientId?: string | null;

  @ManyToOne(() => Client, (client) => client.makeSyncEvents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clientId' })
  client?: Client | null;

  @Column({ type: 'uuid', nullable: true })
  conversationId?: string | null;

  @ManyToOne(
    () => Conversation,
    (conversation) => conversation.makeSyncEvents,
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({ name: 'conversationId' })
  conversation?: Conversation | null;

  @Column({
    type: 'enum',
    enum: MakeSyncStatus,
    enumName: 'make_sync_status_enum',
  })
  status: MakeSyncStatus;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
