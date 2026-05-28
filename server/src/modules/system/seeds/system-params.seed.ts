import { SystemParamKey } from '@shared/system';

/**
 * 默认系统参数种子数据
 *
 * 这些记录通过 Migration 1716740000008-SeedSystemParams 插入数据库。
 * 初始数据与 basketball-match-platform-blueprint.md 中 system_params 表的
 * INSERT 语句完全一致。
 *
 * 版本管理策略：
 * - 本种子数据仅用于初始化
 * - 后续对已有参数的变更必须创建新的迁移文件
 * - 禁止直接修改本种子数据或对应的迁移文件
 */
export const DEFAULT_SYSTEM_PARAMS: {
  paramKey: SystemParamKey;
  paramValue: unknown;
  description: string;
}[] = [
  {
    paramKey: 'ability_adjust_weights',
    paramValue: {
      level_match: { unclear: 0, lower: -1, equal: 0, higher: 1 },
      sportsmanship: { good: 1, average: 0, poor: -1 },
      action_cleanliness: { clean: 1, average: 0, dirty: -2 },
      punctuality: { true: 1, false: -1 },
    },
    description: '能力匹配调节值计算权重',
  },
  {
    paramKey: 'match_threshold_params',
    paramValue: {
      base_threshold: 20.0,
      min_threshold: 5.0,
      intention_count_factor: 0.5,
    },
    description: '匹配能力值差距动态阈值参数',
  },
  {
    paramKey: 'base_ability_weights',
    paramValue: {
      height: 0.15,
      weight: 0.05,
      wingspan: 0.10,
      standing_reach: 0.10,
      jumping_reach: 0.15,
      basketball_age: 0.20,
      age: 0.05,
      position_fit: 0.20,
    },
    description: '基础能力值计算权重',
  },
];
