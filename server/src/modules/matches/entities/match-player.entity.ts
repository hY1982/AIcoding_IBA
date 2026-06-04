import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Match } from './match.entity';
import { Player } from '@modules/players/entities/player.entity';
import { MatchPlayerStatus, MATCH_PLAYER_STATUSES } from '@shared/match';

/**
 * MatchPlayer entity representing a player's association with a match.
 *
 * Links players to matches with confirmation status, team assignment,
 * deposit payment tracking, and reserve player flag.
 */
@Entity('match_players')
@Index(['matchId'])
@Index(['playerId'])
@Unique(['matchId', 'playerId'])
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
    name: 'is_reserve',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  isReserve!: boolean;

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

  @Column({
    name: 'order_no',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  orderNo!: string | null;

  @Column({
    type: 'enum',
    enum: MATCH_PLAYER_STATUSES,
    nullable: false,
    default: 'invited',
  })
  status!: MatchPlayerStatus;
}
