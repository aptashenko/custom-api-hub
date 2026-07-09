import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Client } from './client.entity';
import { Channel, ConversationStatus } from './enums';
import { MakeSyncEvent } from './make-sync-event.entity';
import { Message } from './message.entity';

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.conversations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'enum', enum: Channel, enumName: 'channel_enum' })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    enumName: 'conversation_status_enum',
  })
  status: ConversationStatus;

  @Column({ type: 'varchar', nullable: true })
  source?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @OneToMany(() => MakeSyncEvent, (makeSyncEvent) => makeSyncEvent.conversation)
  makeSyncEvents: MakeSyncEvent[];
}
