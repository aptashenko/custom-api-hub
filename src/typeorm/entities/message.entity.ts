import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Client } from './client.entity';
import { Conversation } from './conversation.entity';
import { Channel, MessageDirection } from './enums';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_message_client_id')
  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Index('IDX_message_conversation_id')
  @Column({ type: 'uuid', nullable: true })
  conversationId?: string | null;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation?: Conversation | null;

  @Column({ type: 'enum', enum: Channel, enumName: 'channel_enum' })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: MessageDirection,
    enumName: 'message_direction_enum',
  })
  direction: MessageDirection;

  @Column({ type: 'text', nullable: true })
  text?: string | null;

  @Column({ type: 'varchar', nullable: true })
  externalMessageId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
