import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  Check,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Player } from '@modules/players/entities/player.entity';
import { IntentionVenue } from './intention-venue.entity';
import { IntentionFormat } from './intention-format.entity';
import { IntentionStatus, INTENTION_STATUSES } from '@shared/intention';

/**
 * Intention entity representing a player's match intention.
 *
 * Core business entity for the matching engine. Each intention captures
 * a player's desired match time, duration, acceptable wait time, and
 * preferred venues/formats.
 *
 * Design decisions:
 * - end_time is computed in @BeforeInsert/@BeforeUpdate hooks (start_time + duration_minutes)
 *   PostgreSQL GENERATED column requires immutable expressions, which prohibits
 *   referencing other columns with variable interval calculations. Application-layer
 *   computation provides equivalent consistency with greater flexibility.
 * - expires_at is computed in application layer (submitted_at + acceptable_wait_minutes)
 * - region_code is auto-populated by backend from player region or preferred venue region
 * - match_id is a plain bigint column until Module 1.5 creates the matches table
 *
 * TODO(Module 1.5): Add foreign key constraint on match_id -> matches(id)
 */
@Entity('intentions')
@Index(['status'])
@Index(['startTime', 'endTime'])
@Index(['playerId', 'status'])
@Index(['regionCode', 'status', 'startTime'])
@Check(
  'CHK_intentions_duration',
  '"duration_minutes" >= 120 AND "duration_minutes" <= 360',
)
export class Intention {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'player_id',
    type: 'bigint',
    nullable: false,
  })
  playerId!: number;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player!: Player;

  @Column({
    name: 'start_time',
    type: 'timestamptz',
    nullable: false,
  })
  startTime!: Date;

  @Column({
    name: 'duration_minutes',
    type: 'int',
    nullable: false,
  })
  durationMinutes!: number;

  /**
   * 用户愿意为匹配成功额外等待的最大分钟数。
   * 默认 30 分钟以提高匹配成功率。
   */
  @Column({
    name: 'acceptable_wait_minutes',
    type: 'int',
    nullable: false,
    default: 30,
  })
  acceptableWaitMinutes!: number;

  /**
   * 结束时间：start_time + duration_minutes。
   * 由 @BeforeInsert/@BeforeUpdate 钩子自动计算。
   *
   * 警告：必须通过实体 save() 方法更新，绕过 TypeORM 生命周期钩子
   *（如 QueryBuilder 或原生 SQL）将导致 end_time 与 start_time/duration_minutes
   * 不一致。如需直接更新，请同步调用 computeDerivedTimes() 或手动计算 end_time。
   *
   * 注：未使用 PostgreSQL GENERATED STORED 列，因为 generated column
   * 要求表达式为 immutable，而涉及其他列变量的 interval 计算（如
   * start_time + duration_minutes * interval '1 minute'）不被 PostgreSQL
   * 视为 immutable。应用层计算提供等效一致性。
   */
  @Column({
    name: 'end_time',
    type: 'timestamptz',
    nullable: false,
  })
  endTime!: Date;

  @Column({
    type: 'enum',
    enum: INTENTION_STATUSES,
    nullable: false,
    default: 'pending',
  })
  status!: IntentionStatus;

  /**
   * 匹配成功后关联的比赛 ID。
   * TODO(Module 1.5): 创建 matches 表后，通过 Migration 补充外键约束：
   * ALTER TABLE intentions ADD CONSTRAINT FK_intentions_match
   *   FOREIGN KEY (match_id) REFERENCES matches(id)
   */
  @Column({
    name: 'match_id',
    type: 'bigint',
    nullable: true,
  })
  matchId!: number | null;

  /**
   * 地区编码，分区键。
   * 填充策略：由后端自动计算，优先从 player 地区获取，
   * 其次从 intention_venues 中优先级最高的场地地区获取。
   * Module 2.5（意向服务）中实现此逻辑。
   */
  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  regionCode!: string | null;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * 意向过期时间。
   * 生成规则：submitted_at + acceptable_wait_minutes。
   * 在应用层（Module 2.5 意向服务或实体生命周期钩子）中强制保证，
   * 不可由用户直接设置。
   */
  @Column({
    name: 'expires_at',
    type: 'timestamptz',
    nullable: false,
  })
  expiresAt!: Date;

  @OneToMany(() => IntentionVenue, (iv) => iv.intention, { cascade: true })
  intentionVenues!: IntentionVenue[];

  @OneToMany(() => IntentionFormat, (ifmt) => ifmt.intention, { cascade: true })
  intentionFormats!: IntentionFormat[];

  @BeforeInsert()
  @BeforeUpdate()
  computeDerivedTimes(): void {
    // Guard against null/undefined/invalid values during hook execution
    if (
      this.startTime == null ||
      this.durationMinutes == null ||
      this.durationMinutes <= 0
    ) {
      return;
    }

    // end_time = start_time + duration_minutes
    const endTimeMs =
      this.startTime.getTime() + this.durationMinutes * 60 * 1000;
    this.endTime = new Date(endTimeMs);

    // expires_at = submitted_at + acceptable_wait_minutes
    // submittedAt is set by @CreateDateColumn just before insert
    // 业务规则：修改 acceptable_wait_minutes 会同步延长/缩短过期时间
    const waitMinutes = this.acceptableWaitMinutes ?? 30;
    const baseTime = this.submittedAt || new Date();
    const expiresMs = baseTime.getTime() + waitMinutes * 60 * 1000;
    this.expiresAt = new Date(expiresMs);
  }
}
