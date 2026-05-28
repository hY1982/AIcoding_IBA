import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Intention } from './intention.entity';
import { Format } from '@modules/formats/entities/format.entity';

/**
 * IntentionFormat entity — 意向与赛制的多对多关联表。
 *
 * 一个意向可选择最多 3 个赛制，按优先级排序（priority=1 为最高）。
 * 对 intentions 级联删除（意向作废时自动清理关联），
 * 对 formats 不级联删除（赛制作为核心配置，删除需审慎）。
 */
@Entity('intention_formats')
@Index(['intentionId', 'formatId'], { unique: true })
export class IntentionFormat {
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
    name: 'format_id',
    type: 'bigint',
    nullable: false,
  })
  formatId!: number;

  @ManyToOne(() => Format)
  @JoinColumn({ name: 'format_id' })
  format!: Format;

  @Column({
    type: 'int',
    nullable: false,
    default: 1,
  })
  priority!: number;
}
