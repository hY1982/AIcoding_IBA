import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Intention } from './intention.entity';
import { Venue } from '@modules/venues/entities/venue.entity';

/**
 * IntentionVenue entity — 意向与场地的多对多关联表。
 *
 * 一个意向可选择最多 3 个场地，按优先级排序（priority=1 为最高）。
 * 对 intentions 级联删除（意向作废时自动清理关联），
 * 对 venues 不级联删除（场地作为核心资产，删除需审慎）。
 */
@Entity('intention_venues')
@Index(['intentionId', 'venueId'], { unique: true })
export class IntentionVenue {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'intention_id',
    type: 'bigint',
    nullable: false,
  })
  intentionId!: number;

  @ManyToOne(() => Intention, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intention_id' })
  intention!: Intention;

  @Column({
    name: 'venue_id',
    type: 'bigint',
    nullable: false,
  })
  venueId!: number;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue!: Venue;

  @Column({
    type: 'int',
    nullable: false,
    default: 1,
  })
  priority!: number;
}
