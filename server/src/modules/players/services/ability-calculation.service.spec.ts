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
      // 超出最大值返回 100
      const player = {
        age: 50,
        basketballAge: 20,
        gender: 'male' as Gender,
        height: 250,
        weight: 120,
        wingspan: 220,
        standingReach: 260,
        jumpingReach: 350,
        positions: ['PG' as const],
      };

      const score = service.calculateBaseAbility(player);
      expect(score).toBe(100);
    });

    it('should return 0 when all metrics are below dataset minimum', () => {
      // 低于最小值返回 0
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
      expect(score).toBe(0);
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
      expect(score).toBeCloseTo(50, 0);
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
      // 所有指标超出最大值 → 各指标百分位为 100
      expect(score).toBe(100);
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
