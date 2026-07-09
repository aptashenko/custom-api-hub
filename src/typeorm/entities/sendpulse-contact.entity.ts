import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Client } from './client.entity';
import { ContactIdentity } from './contact-identity.entity';

@Entity('sendpulse_contacts')
@Index('IDX_sendpulse_contact_export_key', ['exportKey'], { unique: true })
@Index('IDX_sendpulse_contact_bot_contact', ['botId', 'contactId'])
export class SendPulseContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  clientId?: string | null;

  @ManyToOne(() => Client, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clientId' })
  client?: Client | null;

  @Column({ type: 'uuid', nullable: true })
  contactIdentityId?: string | null;

  @ManyToOne(() => ContactIdentity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'contactIdentityId' })
  contactIdentity?: ContactIdentity | null;

  @Column({ type: 'varchar' })
  exportKey: string;

  @Column({ type: 'varchar', nullable: true })
  botId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactId?: string | null;

  @Column({ type: 'varchar', array: true, default: '{}' })
  dialogIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  tags?: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  variables?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  rawContact?: unknown | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rawDialogs: unknown[];

  @Column({ type: 'jsonb' })
  rawProfile: unknown;

  @Column({ type: 'varchar', nullable: true })
  sourceFile?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  exportedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
