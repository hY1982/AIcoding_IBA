import { Test, TestingModule } from '@nestjs/testing';
import { AbilityCalculationService } from './ability-calculation.service';
import {
  AbilityWeightsProvider,
  ABILITY_WEIGHTS_PROVIDER,
} from '../interfaces/ability-weights.provider';
import { DefaultWeightsProvider } from '../providers/default-weights.provider';
import { BaseAbilityWeights } from '@shared/system';
import { Gender } from '@shared/player';

describe('AbilityCalculationService', () => {
  let service: AbilityCalculationService;
  let defaultProvider: DefaultWeightsProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbilityCalculationService,
        DefaultWeightsProvider,
        {
          provide: ABILITY_WEIGHTS_PROVIDER,
          useExisting: DefaultWeightsProvider,
        },
      ],
    }).compile();

    service = module.get<AbilityCalculationService>(AbilityCalculationService);
    defaultProvider = module.get<DefaultWeightsProvider>(DefaultWeightsProvider);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPercentile', () => {
    const testData = [
      { value: 160, percentile: 5 },
      { value: 170, percentile: 25 },
      { value: 175, percentile: 50 },
      { value: 180, percentile: 75 },
      { value: 190, percentile: 95 },
    ];

    it('should return 0 for minimum value (160cm)', () => {
      expect(service.getPercentile(160, testData)).toBe(0);
    });

    it('should return 100 for maximum value (190cm)', () => {
      expect(service.getPercentile(190, testData)).toBe(100);
    });

    it('should return 50 for median value (175cm)', () => {
      expect(service.getPercentile(175, testData)).toBe(50);
    });

    it('should interpolate correctly between two points', () => {
      // 172.5 is halfway between 170(25%) and 175(50%)
      expect(service.getPercentile(172.5, testData)).toBe(37.5);
    });

    it('should return 0 for value below minimum', () => {
      expect(service.getPercentile(150, testData)).toBe(0);
    });

    it('should return 100 for value above maximum', () => {
      expect(service.getPercentile(200, testData)).toBe(100);
    });

    it('should return 50 for empty dataset', () => {
      expect(service.getPercentile(175, [])).toBe(50);
    });

    it('should handle adjacent data points with same value', () => {
      const duplicateValueData = [
        { value: 160, percentile: 5 },
        { value: 170, percentile: 25 },
        { value: 170, percentile: 50 },
        { value: 180, percentile: 75 },
      ];
      expect(service.getPercentile(170, duplicateValueData)).toBe(25);
    });
  });

  describe('calculateBaseAbility - 权重求和', () => {
    it('should return 100 when all metrics exceed dataset maximum', () => {
      // 超出最大值返回 100（使用26岁巅峰年龄和8年球龄以获得满分）
      const player = {
        age: 26,
        basketballAge: 8,
        gender: 'male' as Gender,
        height: 250,
        weight: 120,
        wingspan: 220,
        standingReach: 260,
        jumpingReach: 350,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      // 8年球龄=95%，26岁年龄=100%，其他=100%，加权后应为99.25
      expect(score).toBeGreaterThanOrEqual(99);
    });

    it('should return 0 when all metrics are below dataset minimum', () => {
      // 低于最小值返回 0（年龄边界返回16岁的30%）
      const player = {
        age: 10,
        basketballAge: -5,
        gender: 'male' as Gender,
        height: 150,
        weight: 40,
        wingspan: 150,
        standingReach: 190,
        jumpingReach: 240,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should return approximately 50 for all metrics at median', () => {
      const player = {
        age: 26,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      // 26岁是年龄巅峰(100%)，其他属性为中位数(~50%)，加权后略高于50
      expect(score).toBeGreaterThanOrEqual(48);
      expect(score).toBeLessThanOrEqual(58);
    });
  });

  describe('calculateBaseAbility - 不同性别数据集切换', () => {
    it('should use female dataset for female player', () => {
      const malePlayer = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 170,
        weight: 65,
        wingspan: 175,
        standingReach: 220,
        jumpingReach: 285,
        positions: ['PG' as const],
      };

      const femalePlayer = {
        age: 25,
        basketballAge: 3,
        gender: 'female' as Gender,
        height: 158,
        weight: 52,
        wingspan: 160,
        standingReach: 205,
        jumpingReach: 255,
        positions: ['PG' as const],
      };

      const maleScore = service.calculateBaseAbility(malePlayer);
      const femaleScore = service.calculateBaseAbility(femalePlayer);

      // 两个球员在各自性别中的百分位应该相近（允许±3分差异，因男女数据集分布不同）
      expect(Math.abs(maleScore - femaleScore)).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateBaseAbility - 可空字段', () => {
    it('should use default value (50 percentile) when weight is undefined', () => {
      const playerWithWeight = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const playerWithoutWeight = {
        ...playerWithWeight,
        weight: undefined,
      };

      const scoreWith = service.calculateBaseAbility(playerWithWeight);
      const scoreWithout = service.calculateBaseAbility(playerWithoutWeight);

      // 由于weight在默认权重中占0.10，缺失时差异约为 (actualPercentile - 50) * 0.10
      expect(Math.abs(scoreWith - scoreWithout)).toBeLessThanOrEqual(10);
    });

    it('should use default value (50 percentile) when wingspan is undefined', () => {
      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: undefined,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should use default value when standingReach is undefined', () => {
      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: undefined,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should use default value when jumpingReach is undefined', () => {
      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: undefined,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateBaseAbility - 综合计算', () => {
    it('should calculate reasonable score for typical male player', () => {
      const player = {
        age: 25,
        basketballAge: 5,
        gender: 'male' as Gender,
        height: 180,
        weight: 75,
        wingspan: 185,
        standingReach: 232,
        jumpingReach: 310,
        positions: ['PG' as const, 'SG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeGreaterThanOrEqual(40);
      expect(score).toBeLessThanOrEqual(80);
    });
  });

  describe('calculateBaseAbility - 边界值', () => {
    it('should not crash with height=0', () => {
      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 0,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return high score when all metrics exceed dataset maximum', () => {
      const player = {
        age: 50,
        basketballAge: 20,
        gender: 'male' as Gender,
        height: 300,
        weight: 120,
        wingspan: 220,
        standingReach: 260,
        jumpingReach: 350,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      // 所有指标超出最大值 → 各指标百分位为 100（年龄边界返回40岁的35%，球龄边界返回15年的90%）
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should handle negative input gracefully', () => {
      const player = {
        age: -5,
        basketballAge: -1,
        gender: 'male' as Gender,
        height: -10,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getBasketballAgePercentile - S型饱和曲线', () => {
    const maleBasketballAgeData = [
      { value: 0, percentile: 5 },
      { value: 2, percentile: 45 },
      { value: 5, percentile: 85 },
      { value: 8, percentile: 95 },
      { value: 15, percentile: 90 },
    ];

    it('should return low percentile for beginner (0 years)', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      expect(getBasketballAgePercentile(0, maleBasketballAgeData)).toBe(5);
    });

    it('should return peak at 8 years', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      expect(getBasketballAgePercentile(8, maleBasketballAgeData)).toBe(95);
    });

    it('should return lower percentile for very senior (15 years)', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      expect(getBasketballAgePercentile(15, maleBasketballAgeData)).toBe(90);
    });

    it('should return higher percentile for 5 years than 2 years', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      const p5 = getBasketballAgePercentile(5, maleBasketballAgeData);
      const p2 = getBasketballAgePercentile(2, maleBasketballAgeData);
      expect(p5).toBeGreaterThan(p2);
    });

    it('should return lower percentile for 15 years than 8 years (diminishing returns)', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      const p15 = getBasketballAgePercentile(15, maleBasketballAgeData);
      const p8 = getBasketballAgePercentile(8, maleBasketballAgeData);
      expect(p15).toBeLessThan(p8);
    });

    it('should interpolate between 0 and 2 years', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      // 1 is halfway between 0(5%) and 2(45%)
      expect(getBasketballAgePercentile(1, maleBasketballAgeData)).toBe(25);
    });

    it('should interpolate between 5 and 8 years', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      // 6.5 is halfway between 5(85%) and 8(95%)
      expect(getBasketballAgePercentile(6.5, maleBasketballAgeData)).toBe(90);
    });

    it('should interpolate between 8 and 15 years (declining)', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      // 11.5 is halfway between 8(95%) and 15(90%)
      expect(getBasketballAgePercentile(11.5, maleBasketballAgeData)).toBe(92.5);
    });

    it('should return boundary percentile for negative years', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      expect(getBasketballAgePercentile(-5, maleBasketballAgeData)).toBe(5);
    });

    it('should return boundary percentile for years above 15', () => {
      const getBasketballAgePercentile = (service as any).getBasketballAgePercentile.bind(service);
      expect(getBasketballAgePercentile(25, maleBasketballAgeData)).toBe(90);
    });
  });

  describe('getAgePercentile - 倒U型曲线', () => {
    const maleAgeData = [
      { value: 16, percentile: 30 },
      { value: 22, percentile: 80 },
      { value: 26, percentile: 100 },
      { value: 32, percentile: 70 },
      { value: 40, percentile: 35 },
    ];

    it('should return peak at 26 years old', () => {
      // 使用反射调用私有方法
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      expect(getAgePercentile(26, maleAgeData)).toBe(100);
    });

    it('should return lower percentile for teenager (16)', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      expect(getAgePercentile(16, maleAgeData)).toBe(30);
    });

    it('should return lower percentile for senior (40)', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      expect(getAgePercentile(40, maleAgeData)).toBe(35);
    });

    it('should return higher percentile for 22 than 16', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      const p22 = getAgePercentile(22, maleAgeData);
      const p16 = getAgePercentile(16, maleAgeData);
      expect(p22).toBeGreaterThan(p16);
    });

    it('should return higher percentile for 26 than 32', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      const p26 = getAgePercentile(26, maleAgeData);
      const p32 = getAgePercentile(32, maleAgeData);
      expect(p26).toBeGreaterThan(p32);
    });

    it('should interpolate between 22 and 26', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      // 24 is halfway between 22(80%) and 26(100%)
      expect(getAgePercentile(24, maleAgeData)).toBe(90);
    });

    it('should interpolate between 26 and 32', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      // 29 is 3/6 between 26(100%) and 32(70%)
      expect(getAgePercentile(29, maleAgeData)).toBe(85);
    });

    it('should return boundary percentile for age below 16', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      expect(getAgePercentile(10, maleAgeData)).toBe(30);
    });

    it('should return boundary percentile for age above 40', () => {
      const getAgePercentile = (service as any).getAgePercentile.bind(service);
      expect(getAgePercentile(50, maleAgeData)).toBe(35);
    });
  });

  describe('validateWeights - 权重校验安全网（P0）', () => {
    it('should return true when weights sum to 1.0', () => {
      const weights: BaseAbilityWeights = {
        height: 0.20,
        weight: 0.10,
        wingspan: 0.15,
        standing_reach: 0.15,
        jumping_reach: 0.20,
        basketball_age: 0.15,
        age: 0.05,
      };

      expect(service.validateWeights(weights)).toBe(true);
    });

    it('should return true when weights sum to 1.0 within tolerance (0.995)', () => {
      const weights: BaseAbilityWeights = {
        height: 0.20,
        weight: 0.10,
        wingspan: 0.15,
        standing_reach: 0.15,
        jumping_reach: 0.20,
        basketball_age: 0.145,
        age: 0.05,
      };

      expect(service.validateWeights(weights)).toBe(true);
    });

    it('should return false when weights sum to 0.9', () => {
      const weights: BaseAbilityWeights = {
        height: 0.15,
        weight: 0.10,
        wingspan: 0.15,
        standing_reach: 0.15,
        jumping_reach: 0.20,
        basketball_age: 0.10,
        age: 0.05,
      };

      expect(service.validateWeights(weights)).toBe(false);
    });

    it('should return false when weights sum to 1.1', () => {
      const weights: BaseAbilityWeights = {
        height: 0.25,
        weight: 0.15,
        wingspan: 0.15,
        standing_reach: 0.15,
        jumping_reach: 0.20,
        basketball_age: 0.15,
        age: 0.05,
      };

      expect(service.validateWeights(weights)).toBe(false);
    });
  });

  describe('calculateBaseAbility - 权重校验回退（P0）', () => {
    it('should fallback to default weights when provider returns invalid weights', () => {
      const invalidProvider: AbilityWeightsProvider = {
        getWeights: (): BaseAbilityWeights => ({
          height: 0.5,
          weight: 0.5,
          wingspan: 0,
          standing_reach: 0,
          jumping_reach: 0,
          basketball_age: 0,
          age: 0,
        }),
      };

      const serviceWithInvalidProvider = new AbilityCalculationService(
        invalidProvider,
        defaultProvider,
      );

      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = serviceWithInvalidProvider.calculateBaseAbility(player);
      // 使用默认权重（和为1.0）计算，中位数球员应接近50分
      expect(score).toBeCloseTo(50, 0);
    });

    it('should use provider weights when they are valid', () => {
      const customProvider: AbilityWeightsProvider = {
        getWeights: (): BaseAbilityWeights => ({
          height: 1.0,
          weight: 0,
          wingspan: 0,
          standing_reach: 0,
          jumping_reach: 0,
          basketball_age: 0,
          age: 0,
        }),
      };

      const serviceWithCustomProvider = new AbilityCalculationService(
        customProvider,
        defaultProvider,
      );

      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = serviceWithCustomProvider.calculateBaseAbility(player);
      // 只有height权重为1.0，中位数球员height=175对应50分
      expect(score).toBe(50);
    });

    it('should fallback via DI when injected provider returns invalid weights', async () => {
      const invalidProvider: AbilityWeightsProvider = {
        getWeights: (): BaseAbilityWeights => ({
          height: 0.5,
          weight: 0.5,
          wingspan: 0,
          standing_reach: 0,
          jumping_reach: 0,
          basketball_age: 0,
          age: 0,
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AbilityCalculationService,
          DefaultWeightsProvider,
          {
            provide: ABILITY_WEIGHTS_PROVIDER,
            useValue: invalidProvider,
          },
        ],
      }).compile();

      const diService = module.get<AbilityCalculationService>(AbilityCalculationService);

      const player = {
        age: 25,
        basketballAge: 3,
        gender: 'male' as Gender,
        height: 175,
        weight: 72,
        wingspan: 180,
        standingReach: 228,
        jumpingReach: 300,
        positions: ['PG' as const],
      };

      const score = diService.calculateBaseAbility(player);
      expect(score).toBeCloseTo(50, 0);
    });
  });

  describe('DefaultWeightsProvider', () => {
    it('should return weights that sum to 1.0', () => {
      const weights = defaultProvider.getWeights();
      const sum =
        weights.height +
        weights.weight +
        weights.wingspan +
        weights.standing_reach +
        weights.jumping_reach +
        weights.basketball_age +
        weights.age;

      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should not contain position_fit', () => {
      const weights = defaultProvider.getWeights();
      expect(weights).not.toHaveProperty('position_fit');
    });
  });
});
