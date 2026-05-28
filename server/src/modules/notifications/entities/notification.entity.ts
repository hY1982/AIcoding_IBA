import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import {
  NotificationType,
  NOTIFICATION_TYPES,
  SendStatus,
  SEND_STATUSES,
  NotificationChannel,
} from '@shared/notification';

/**
 * 通知记录实体
 *
 * 存储平台向用户发送的各类通知。
 * 支持多渠道发送记录（push/sms/in_app）和发送状态追踪。
 *
 * 扩展字段说明：
 * - send_status: 追踪通知发送状态（pending/succeeded/failed），用于第三方渠道运维和重试
 * - sent_at: 记录实际发送时间，用于监控和排障
 *
 * 索引说明：
 * - (user_id, is_read, created_at): 核心查询场景"获取用户未读消息"
 * - (region_code): 分区键，支持按地区查询
 * 前瞻性：如需对 sent_via 数组做高效包含查询，可后续添加 GIN(sent_via) 索引
 */
@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
@Index(['regionCode'])
export class Notification {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'user_id',
    type: 'bigint',
    nullable: false,
  })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: NOTIFICATION_TYPES,
    nullable: false,
  })
  type!: NotificationType;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  title!: string;

  @Column({
    type: 'text',
    nullable: false,
  })
  content!: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  data!: Record<string, unknown> | null;

  @Column({
    name: 'is_read',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  isRead!: boolean;

  @Column({
    name: 'send_status',
    type: 'enum',
    enum: SEND_STATUSES,
    nullable: false,
    default: 'pending',
  })
  sendStatus!: SendStatus;

  @Column({
    name: 'sent_at',
    type: 'timestamptz',
    nullable: true,
  })
  sentAt!: Date | null;

  @Column({
    name: 'sent_via',
    type: 'varchar',
    length: 20,
    array: true,
    nullable: true,
  })
  sentVia!: NotificationChannel[] | null;

  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  regionCode!: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'NOW()',
  })
  createdAt!: Date;
}
