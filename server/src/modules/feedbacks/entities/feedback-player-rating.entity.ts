import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Feedback } from './feedback.entity';
import { Player } from '@modules/players/entities/player.entity';
import {
  LEVEL_MATCH_OPTIONS,
  SPORTSMANSHIP_OPTIONS,
  ACTION_CLEANLINESS_OPTIONS,
} from '@shared/feedback';
import type { LevelMatch, Sportsmanship, ActionCleanliness } from '@shared/feedback';

/**
 * 对其他球员的评分实体
 *
 * 每条反馈（Feedback）可包含对多位其他球员的评分。
 * 本实体记录对单个球员的多维度评价。
 *
 * 业务规则（应用层校验）：
 * - 禁止自评：rated_player_id 不能等于 feedback.player_id
 *   此约束在数据库层无法通过 CHECK 实现（不支持跨表子查询），
 *   由 FeedbackService 在提交反馈时进行应用层校验。
 * - feedback 删除后级联删除关联的 ratings
 */
@Entity('feedback_player_ratings')
@Index(['feedbackId'])
@Index(['ratedPlayerId'])
export class FeedbackPlayerRating {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'feedback_id',
    type: 'bigint',
    nullable: false,
  })
  feedbackId!: number;

  @ManyToOne(() => Feedback, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedback_id' })
  feedback!: Feedback;

  @Column({
    name: 'rated_player_id',
    type: 'bigint',
    nullable: false,
  })
  ratedPlayerId!: number;

  @ManyToOne(() => Player, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'rated_player_id' })
  ratedPlayer!: Player;

  @Column({
    name: 'level_match',
    type: 'enum',
    enum: LEVEL_MATCH_OPTIONS,
    nullable: true,
  })
  levelMatch!: LevelMatch | null;

  @Column({
    name: 'sportsmanship',
    type: 'enum',
    enum: SPORTSMANSHIP_OPTIONS,
    nullable: true,
  })
  sportsmanship!: Sportsmanship | null;

  @Column({
    name: 'action_cleanliness',
    type: 'enum',
    enum: ACTION_CLEANLINESS_OPTIONS,
    nullable: true,
  })
  actionCleanliness!: ActionCleanliness | null;

  @Column({
    name: 'is_punctual',
    type: 'boolean',
    nullable: true,
  })
  isPunctual!: boolean | null;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'NOW()',
  })
  createdAt!: Date;
}
