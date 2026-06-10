import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { PlayerPosition } from './player-position.entity';
import { Gender, GENDERS, TEAM_ROLES, TeamRole } from '@shared/player';

@Entity('players')
@Index(['totalAbilityScore'])
@Index(['regionCode'])
export class Player {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'user_id',
    type: 'bigint',
    nullable: false,
    unique: true,
  })
  userId!: number;

  @OneToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // MVP基础属性
  @Column({ type: 'int', nullable: false })
  age!: number;

  @Column({
    name: 'basketball_age',
    type: 'int',
    nullable: false,
  })
  basketballAge!: number;

  @Column({
    type: 'enum',
    enum: GENDERS,
    nullable: false,
  })
  gender!: Gender;

  @Column({ type: 'int', nullable: false })
  height!: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
  })
  weight!: number | null;

  @Column({ type: 'int', nullable: true })
  wingspan!: number | null;

  @Column({
    name: 'standing_reach',
    type: 'int',
    nullable: true,
  })
  standingReach!: number | null;

  @Column({
    name: 'jumping_reach',
    type: 'int',
    nullable: true,
  })
  jumpingReach!: number | null;

  // 计算能力值
  @Column({
    name: 'base_ability_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: number | string | null) =>
        value === null ? 0 : typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  baseAbilityScore!: number;

  @Column({
    name: 'match_adjust_value',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: number | string | null) =>
        value === null
          ? 0
          : typeof value === 'string'
            ? parseFloat(value)
            : value,
    },
  })
  matchAdjustValue!: number;

  @Column({
    name: 'total_ability_score',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: false,
    generatedType: 'STORED',
    asExpression: 'base_ability_score + match_adjust_value',
    transformer: {
      to: (value: number) => value,
      from: (value: number | string | null) =>
        value === null ? 0 : typeof value === 'string' ? parseFloat(value) : value,
    },
  })
  totalAbilityScore!: number;

  // P1扩展属性（MVP阶段可为null）
  @Column({
    name: 'bench_press',
    type: 'decimal',
    precision: 5,
    scale: 1,
    nullable: true,
  })
  benchPress!: number | null;

  @Column({
    name: 'hand_length',
    type: 'decimal',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  handLength!: number | null;

  @Column({
    name: 'sprint_100m',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  sprint100m!: number | null;

  @Column({
    name: 'run_1000m',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  run1000m!: number | null;

  @Column({
    name: 'run_2000m',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  run2000m!: number | null;

  @Column({
    name: 'run_5000m',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  run5000m!: number | null;

  @Column({
    name: 'run_record_date',
    type: 'date',
    nullable: true,
  })
  runRecordDate!: Date | null;

  @Column({
    name: 'team_experience',
    type: 'varchar',
    length: 100,
    array: true,
    nullable: true,
  })
  teamExperience!: string[] | null;

  @Column({
    name: 'team_role',
    type: 'enum',
    enum: TEAM_ROLES,
    nullable: true,
  })
  teamRole!: TeamRole | null;

  @Column({
    name: 'breakthrough_level',
    type: 'int',
    nullable: true,
    default: 0,
  })
  breakthroughLevel!: number | null;

  @Column({
    name: 'passing_level',
    type: 'int',
    nullable: true,
    default: 0,
  })
  passingLevel!: number | null;

  @Column({
    name: 'defense_level',
    type: 'int',
    nullable: true,
    default: 0,
  })
  defenseLevel!: number | null;

  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  regionCode!: string | null;

  @VersionColumn({ name: 'version', default: 0 })
  version!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PlayerPosition, (position) => position.player, {
    cascade: true,
  })
  positions!: PlayerPosition[];
}
