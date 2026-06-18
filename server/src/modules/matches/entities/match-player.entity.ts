import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Match } from './match.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { MatchPlayerStatus, MATCH_PLAYER_STATUSES } from '@shared/match';

/**
 * MatchPlayer entity representing a player's association with a match.
 *
 * v2.0 重构：
 * - 新增 intentionId（关联产生该邀请的意向）
 * - status 枚举：invited/confirmed/withdrawn/no_show（declined→withdrawn）
 * - 删除 isReserve
 * - 唯一约束改为 (matchId, intentionId)
 * - 新增 depositOrderNo（Saga补偿用）
 */
@Entity('match_players')
@Index(['matchId'])
@Index(['playerId'])
@Index(['intentionId'])  // v2.0: 按意向查询
@Index('UQ_match_players_match_intention_notnull', ['matchId', 'intentionId'], {
  unique: true,
  where: '"intention_id" IS NOT NULL',  // v2.0: partial unique index，旧数据(NULL)不受约束
})
export class MatchPlayer {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'match_id',
    type: 'bigint',
    nullable: false,
  })
  matchId!: number;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match!: Match;

  @Column({
    name: 'player_id',
    type: 'bigint',
    nullable: false,
  })
  playerId!: number;

  @ManyToOne(() => Player, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'player_id' })
  player!: Player;

  /**
   * v2.0: 关联产生该邀请的意向 ID。
   */
  @Column({
    name: 'intention_id',
    type: 'bigint',
    nullable: true,
  })
  intentionId!: number | null;

  @ManyToOne(() => Intention, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'intention_id' })
  intention!: Intention | null;

  @Column({
    name: 'team_number',
    type: 'int',
    nullable: true,
  })
  teamNumber!: number | null;

  /**
   * Derived from status — true when status is 'confirmed'.
   * Not stored in DB; use status for persistence.
   */
  get isConfirmed(): boolean {
    return this.status === 'confirmed';
  }

  @Column({
    name: 'confirmed_at',
    type: 'timestamptz',
    nullable: true,
  })
  confirmedAt!: Date | null;

  @Column({
    name: 'deposit_paid',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  depositPaid!: boolean;

  /**
   * v2.0: 支付订单号（Saga补偿用）。重命名自旧 orderNo。
   */
  @Column({
    name: 'deposit_order_no',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  depositOrderNo!: string | null;

  @Column({
    type: 'enum',
    enum: MATCH_PLAYER_STATUSES,
    nullable: false,
    default: 'invited',
  })
  status!: MatchPlayerStatus;
}
