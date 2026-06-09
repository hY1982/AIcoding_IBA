import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ShootingRecordType, SHOOTING_RECORD_TYPES } from '@shared/player';

/**
 * 球员投篮记录实体
 *
 * 记录球员的罚球线和三分线投篮数据，支持滚动半年统计。
 * 与 Player 实体为 N:1 关系，球员删除时级联删除记录。
 *
 * 索引设计：
 * - IDX_shooting_player_date: (playerId, recordDate DESC) — 支撑 getShootingStats 的日期范围筛选和排序
 * - IDX_shooting_player_type_date: (playerId, recordType, recordDate) — 蓝图规范，支撑按类型细分查询
 */
@Entity('player_shooting_records')
@Index('IDX_shooting_player_date', ['playerId', 'recordDate'])
@Index('IDX_shooting_player_type_date', ['playerId', 'recordType', 'recordDate'])
export class PlayerShootingRecord {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'player_id', type: 'bigint', nullable: false })
  playerId!: number;

  @Column({
    name: 'record_type',
    type: 'enum',
    enum: SHOOTING_RECORD_TYPES,
    nullable: false,
  })
  recordType!: ShootingRecordType;

  @Column({ name: 'shots_attempted', type: 'int', nullable: false })
  shotsAttempted!: number;

  @Column({ name: 'shots_made', type: 'int', nullable: false })
  shotsMade!: number;

  @Column({ name: 'record_date', type: 'date', nullable: false })
  recordDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
