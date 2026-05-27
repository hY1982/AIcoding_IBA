import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EncryptTransformer } from '@common/transformers/encrypt.transformer';
import {
  UserType,
  UserStatus,
  USER_TYPES,
  USER_STATUSES,
} from '@shared/common';

@Entity('users')
@Index(['phoneHash'])
@Index(['userType'])
@Index(['status'])
@Index(['regionCode'])
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    transformer: EncryptTransformer,
  })
  phone!: string;

  @Column({
    name: 'phone_hash',
    type: 'varchar',
    length: 64,
    nullable: false,
    unique: true,
    comment: 'HMAC-SHA256 hash of phone for indexed lookup',
  })
  phoneHash!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  nickname!: string;

  @Column({
    name: 'real_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: EncryptTransformer,
  })
  realName!: string | null;

  @Column({
    name: 'id_card',
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: EncryptTransformer,
  })
  idCard!: string | null;

  @Column({
    name: 'avatar_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatarUrl!: string | null;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: USER_TYPES,
    nullable: false,
  })
  userType!: UserType;

  @Column({
    type: 'enum',
    enum: USER_STATUSES,
    nullable: false,
    default: 'active',
  })
  status!: UserStatus;

  @Column({
    name: 'region_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  regionCode!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
