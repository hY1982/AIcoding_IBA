import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseAbilityWeights, isBaseAbilityWeights } from '@shared/system';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { AbilityWeightsProvider } from '../interfaces/ability-weights.provider';
import { DefaultWeightsProvider } from './default-weights.provider';

/**
 * 权重和校验允许的浮点误差
 */
const WEIGHT_SUM_TOLERANCE = 0.01;

/**
 * SystemParam 权重提供者
 *
 * 从数据库 system_params 表读取 base_ability_weights 配置。
 * 在模块初始化时异步加载并缓存，后续同步返回缓存值。
 * 读取失败、不存在、结构不合法或权重和不为 1.0 时，回退到 DefaultWeightsProvider。
 */
@Injectable()
export class SystemParamWeightsProvider
  implements AbilityWeightsProvider, OnModuleInit
{
  private readonly logger = new Logger(SystemParamWeightsProvider.name);
  private cachedWeights: BaseAbilityWeights | null = null;

  constructor(
    @InjectRepository(SystemParam)
    private readonly systemParamRepo: Repository<SystemParam>,
    private readonly defaultProvider: DefaultWeightsProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadWeights();
  }

  getWeights(): BaseAbilityWeights {
    if (this.cachedWeights !== null) {
      return this.cachedWeights;
    }
    return this.defaultProvider.getWeights();
  }

  /**
   * 从数据库加载权重配置，进行运行时校验后缓存
   */
  private async loadWeights(): Promise<void> {
    try {
      const param = await this.systemParamRepo.findOne({
        where: { paramKey: 'base_ability_weights' },
      });

      if (!param) {
        this.logger.warn(
          '数据库中未找到 base_ability_weights 配置，使用默认权重',
        );
        this.cachedWeights = this.defaultProvider.getWeights();
        return;
      }

      const value = param.paramValue;

      if (!isBaseAbilityWeights(value)) {
        this.logger.warn(
          '数据库中 base_ability_weights 结构不合法，使用默认权重',
        );
        this.cachedWeights = this.defaultProvider.getWeights();
        return;
      }

      const sum =
        value.height +
        value.weight +
        value.wingspan +
        value.standing_reach +
        value.jumping_reach +
        value.basketball_age +
        value.age;

      if (Math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE) {
        this.logger.warn(
          `数据库中 base_ability_weights 权重和=${sum.toFixed(4)}≠1.0，使用默认权重`,
        );
        this.cachedWeights = this.defaultProvider.getWeights();
        return;
      }

      this.cachedWeights = value;
      this.logger.log('已从数据库加载 base_ability_weights 配置');
    } catch (error) {
      this.logger.error('读取 base_ability_weights 失败，使用默认权重', error);
      this.cachedWeights = this.defaultProvider.getWeights();
    }
  }
}
