import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Match } from '@modules/matches/entities/match.entity';
import { User } from '@modules/users/entities/user.entity';
import { MessageType, MESSAGE_TYPES } from '@shared/match';

/**
 * MatchMessage entity representing a chat message within a match group.
 *
 * Messages are persisted in PostgreSQL and broadcast via WebSocket.
 * The match_id + created_at composite index supports efficient pagination
 * of message history.
 */
@Entity('match_messages')
@Index(['matchId', 'createdAt'])
export class MatchMessage {
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
    name: 'sender_id',
    type: 'bigint',
    nullable: true,
  })
  senderId!: number | null;

  @ManyToOne(() => User, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender!: User | null;

  @Column({
    type: 'text',
    nullable: false,
  })
  content!: string;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: MESSAGE_TYPES,
    nullable: false,
    default: 'text',
  })
  messageType!: MessageType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
