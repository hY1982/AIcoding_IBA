import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Mock Order Entity
 *
 * Stores mock payment orders in PostgreSQL for persistence.
 * This ensures order state survives service restarts and supports
 * querying for reconciliation purposes.
 *
 * Design note: In production with real payment providers (WeChat/Alipay),
 * this entity would be replaced by or augmented with provider-specific
 * order tracking tables.
 */
@Entity('mock_orders')
@Index(['orderNo'])
@Index(['matchId', 'playerId'])
@Index(['status'])
export class MockOrder {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'order_no',
    type: 'varchar',
    length: 64,
    nullable: false,
    unique: true,
  })
  orderNo!: string;

  @Column({
    name: 'match_id',
    type: 'bigint',
    nullable: false,
  })
  matchId!: number;

  @Column({
    name: 'player_id',
    type: 'bigint',
    nullable: false,
  })
  playerId!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
  })
  amount!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'closed', 'failed'],
    nullable: false,
    default: 'pending',
  })
  status!: 'pending' | 'paid' | 'closed' | 'failed';

  @Column({
    name: 'expire_at',
    type: 'timestamptz',
    nullable: false,
  })
  expireAt!: Date;

  @Column({
    name: 'paid_at',
    type: 'timestamptz',
    nullable: true,
  })
  paidAt!: Date | null;

  @Column({
    name: 'closed_at',
    type: 'timestamptz',
    nullable: true,
  })
  closedAt!: Date | null;

  @Column({
    name: 'callback_processed',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  callbackProcessed!: boolean;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
