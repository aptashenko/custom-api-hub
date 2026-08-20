import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Client } from './client.entity';

@Entity()
export class LeadSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.leadSources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'varchar', nullable: true })
  utmSource?: string | null;

  @Column({ type: 'varchar', nullable: true })
  utmMedium?: string | null;

  @Column({ type: 'varchar', nullable: true })
  utmCampaign?: string | null;

  @Column({ type: 'varchar', nullable: true })
  utmContent?: string | null;

  @Column({ type: 'varchar', nullable: true })
  utmTerm?: string | null;

  @Column({ type: 'varchar', nullable: true })
  referrer?: string | null;

  @Column({ type: 'varchar', nullable: true })
  landingPage?: string | null;

  @Column({ type: 'varchar', nullable: true })
  gclid?: string | null;

  @Column({ type: 'varchar', nullable: true })
  gbraid?: string | null;

  @Column({ type: 'varchar', nullable: true })
  wbraid?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleCustomerId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleCampaignId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdGroupId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleAdId?: string | null;

  @Column({ type: 'text', nullable: true })
  googleKeyword?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleMatchType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleDevice?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
