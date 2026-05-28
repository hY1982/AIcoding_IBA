import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  Check,
} from 'typeorm';
import { Match } from '@modules/matches/entities/match.entity';
import { Player } from '@modules/players/entities/player.entity';

/**
 * 赛后反馈实体
 *
 * 每个球员对每场比赛只能提交一次反馈。
 * 反馈包含总体体验评分（1-5）和可选文字说明。
 *
 * 业务规则：
 * - (match_id, player_id) 唯一约束确保每场比赛每个球员只能反馈一次
 * - overall_rating 必须在 1-5 范围内
 * - 比赛删除后关联反馈级联删除（比赛不存在则反馈无意义）
 */
@Entity('feedbacks')
@Index(['matchId'])
@Index(['playerId'])
@Unique(['matchId', 'playerId'])
@Check('CHK_feedbacks_overall_rating', '"overall_rating" BETWEEN 1 AND 5')
export class Feedback {
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
    name: 'overall_rating',
    type: 'int',
    nullable: false,
  })
  overallRating!: number;

  @Column({
    name: 'overall_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  overallReason!: string | null;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  regionCode!: string | null;
}
