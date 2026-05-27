import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Player } from './player.entity';
import { BasketballPosition, BASKETBALL_POSITIONS } from '@shared/player';

@Entity('player_positions')
@Index(['playerId', 'position'], { unique: true })
export class PlayerPosition {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'player_id',
    type: 'bigint',
    nullable: false,
  })
  playerId!: number;

  @ManyToOne(() => Player, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'player_id' })
  player!: Player;

  @Column({
    type: 'enum',
    enum: BASKETBALL_POSITIONS,
    nullable: false,
  })
  position!: BasketballPosition;

  @Column({
    type: 'int',
    nullable: false,
    default: 1,
  })
  priority!: number;
}
