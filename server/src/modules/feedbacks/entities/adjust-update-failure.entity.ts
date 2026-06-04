import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 调节值更新失败记录实体
 *
 * 用于持久化调节值更新失败的信息，供异步补偿服务精准重试。
 * 当 FeedbackService.updatePlayerMatchAdjustWithRetry 达到最大重试次数仍失败时，
 * 将失败信息写入本表，后续由 FeedbackAdjustSyncService 或定时任务扫描并补偿。
 *
 * 生命周期：
 * - 创建：调节值更新失败时
 * - 补偿成功：FeedbackAdjustSyncService 重试成功后删除
 * - 过期清理：可配置保留策略（如 30 天）
 */
@Entity('adjust_update_failures')
@Index(['matchId', 'ratedPlayerId'])
@Index(['resolved'])
@Index(['createdAt'])
export class AdjustUpdateFailure {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'match_id',
    type: 'bigint',
    nullable: false,
  })
  matchId!: number;

  @Column({
    name: 'rated_player_id',
    type: 'bigint',
    nullable: false,
  })
  ratedPlayerId!: number;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorMessage!: string | null;

  @Column({
    name: 'retry_count',
    type: 'int',
    nullable: false,
    default: 0,
  })
  retryCount!: number;

  @Column({
    name: 'resolved',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  resolved!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
