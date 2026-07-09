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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
