import { BaseAbilityWeights } from '@shared/system';

/**
 * 能力值权重提供者接口
 *
 * 通过接口抽象权重获取逻辑，解耦数据库依赖：
 * - 提升可测试性：单元测试可注入 MockProvider
 * - 提升架构清晰度：权重获取与计算逻辑分离
 * - 便于扩展：P1阶段新增 PositionWeightsProvider 时无需改动计算服务
 */
export interface AbilityWeightsProvider {
  getWeights(): BaseAbilityWeights;
}

/**
 * NestJS 注入令牌
 */
export const ABILITY_WEIGHTS_PROVIDER = 'ABILITY_WEIGHTS_PROVIDER';
