import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Check,
  OneToMany,
} from 'typeorm';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { FormatType, FORMAT_TYPES } from '@shared/format';

/**
 * Format entity representing a basketball match format (game type).
 *
 * This is an independent table with no foreign key dependencies.
 * It defines the rules for match formation: team size, number of teams,
 * win conditions, and estimated duration.
 *
 * Database-level CHECK constraint ensures team_count_max >= team_count_min.
 */
@Entity('formats')
@Check('CHK_formats_team_counts', '"team_count_max" >= "team_count_min"')
export class Format {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  name!: string;

  @Column({
    name: 'format_type',
    type: 'enum',
    enum: FORMAT_TYPES,
    nullable: false,
  })
  formatType!: FormatType;

  @Column({ name: 'team_size', type: 'int', nullable: false })
  teamSize!: number;

  @Column({ name: 'team_count_min', type: 'int', nullable: false })
  teamCountMin!: number;

  @Column({ name: 'team_count_max', type: 'int', nullable: false })
  teamCountMax!: number;

  @Column({
    name: 'win_condition',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  winCondition!: string | null;

  // 预计总占用时长（含热身与间歇），单位：小时，精度 0.1h（6分钟），最长 99.9h
  @Column({
    name: 'duration_hours',
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
  })
  durationHours!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * 软删除标记。查询业务需显式筛选 is_active = true。
   * 默认 true，表示新创建的赛制默认可用。
   */
  @Column({
    name: 'is_active',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => IntentionFormat, (intf) => intf.format, { lazy: true })
  intentionFormats!: Promise<IntentionFormat[]>;
}
