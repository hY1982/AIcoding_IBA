import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SystemParamKey, SYSTEM_PARAM_KEYS } from '@shared/system';

/**
 * 系统参数实体
 *
 * 存储平台运行时可动态调整的配置参数。
 * 使用 JSONB 存储参数值，提供最大灵活性。
 *
 * 类型安全：
 * - shared/types/system.ts 中为每个 SystemParamKey 定义了对应的 TypeScript 接口
 * - 提供运行时类型守卫函数（isAbilityAdjustWeights 等）用于 JSON 校验
 * - 读取参数时建议通过类型守卫验证结构，避免运行时错误
 *
 * 版本管理：
 * - 初始数据由 Migration 1716740000008-SeedSystemParams 插入
 * - 后续变更需创建新的迁移文件，禁止直接修改种子迁移
 */
@Entity('system_params')
@Unique(['paramKey'])
export class SystemParam {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'param_key',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  paramKey!: SystemParamKey;

  @Column({
    name: 'param_value',
    type: 'jsonb',
    nullable: false,
  })
  paramValue!: unknown;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
