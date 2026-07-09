import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ContactIdentity } from './contact-identity.entity';
import { Conversation } from './conversation.entity';
import { LeadSource } from './lead-source.entity';
import { MakeSyncEvent } from './make-sync-event.entity';
import { Message } from './message.entity';

@Entity()
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @Index('IDX_client_phone')
  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Index('IDX_client_email')
  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ContactIdentity, (identity) => identity.client)
  identities: ContactIdentity[];

  @OneToMany(() => Conversation, (conversation) => conversation.client)
  conversations: Conversation[];

  @OneToMany(() => Message, (message) => message.client)
  messages: Message[];

  @OneToMany(() => LeadSource, (leadSource) => leadSource.client)
  leadSources: LeadSource[];

  @OneToMany(() => MakeSyncEvent, (makeSyncEvent) => makeSyncEvent.client)
  makeSyncEvents: MakeSyncEvent[];
}
