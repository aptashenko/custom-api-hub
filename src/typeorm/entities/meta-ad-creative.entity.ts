import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('meta_ad_creatives')
export class MetaAdCreative {
  @PrimaryColumn({ type: 'varchar' })
  metaCreativeId: string;

  @Index('IDX_meta_ad_creatives_account')
  @Column({ type: 'varchar' })
  metaAdAccountId: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  body?: string | null;

  @Column({ type: 'varchar', nullable: true })
  objectType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  status?: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageHash?: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl?: string | null;

  @Column({ type: 'varchar', nullable: true })
  videoId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  instagramUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  instagramPermalinkUrl?: string | null;

  @Column({ type: 'varchar', nullable: true })
  callToActionType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  leadGenFormId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  objectStorySpec?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  assetFeedSpec?: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  callToAction?: unknown | null;

  @Column({ type: 'jsonb' })
  raw: unknown;

  @Column({ type: 'timestamptz' })
  syncedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
