import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbilityAdjustService } from './ability-adjust.service';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { InternalServerErrorException } from '@nestjs/common';

// Mock the type guard from shared/types/system
jest.mock('@shared/system', () => ({
  ...jest.requireActual('@shared/system'),
  isAbilityAdjustWeights: jest.fn(),
}));

import { isAbilityAdjustWeights as rawIsAbilityAdjustWeights } from '@shared/system';
const isAbilityAdjustWeights = rawIsAbilityAdjustWeights as jest.MockedFunction<typeof rawIsAbilityAdjustWeights>;

const mockSystemParamRepo = () => ({
  findOne: jest.fn(),
});

describe('AbilityAdjustService', () => {
  let service: AbilityAdjustService;
  let systemParamRepo: jest.Mocked<Repository<SystemParam>>;

  const validWeights = {
    level_match: { unclear: 0, lower: -1, equal: 0, higher: 1 },
    sportsmanship: { good: 1, average: 0, poor: -1 },
    action_cleanliness: { clean: 1, average: 0, dirty: -2 },
    punctuality: { true: 1, false: -1 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbilityAdjustService,
        {
          provide: getRepositoryToken(SystemParam),
          useFactory: mockSystemParamRepo,
        },
      ],
    }).compile();

    service = module.get<AbilityAdjustService>(AbilityAdjustService);
    systemParamRepo = module.get(getRepositoryToken(SystemParam));

    jest.clearAllMocks();
    isAbilityAdjustWeights.mockReturnValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== getWeights ====================

  describe('getWeights', () => {
    it('should return weights from database when param exists and is valid', async () => {
      systemParamRepo.findOne.mockResolvedValue({
        id: 1,
        paramKey: 'ability_adjust_weights',
        paramValue: validWeights,
        description: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as SystemParam);

      const result = await service.getWeights();

      expect(result).toEqual(validWeights);
      expect(isAbilityAdjustWeights).toHaveBeenCalledWith(validWeights);
    });

    it('should throw InternalServerErrorException when ability_adjust_weights param does not exist', async () => {
      systemParamRepo.findOne.mockResolvedValue(null);

      await expect(service.getWeights()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when param value fails isAbilityAdjustWeights guard', async () => {
      systemParamRepo.findOne.mockResolvedValue({
        id: 1,
        paramKey: 'ability_adjust_weights',
        paramValue: { invalid: true },
        description: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as SystemParam);

      isAbilityAdjustWeights.mockReturnValue(false);

      await expect(service.getWeights()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should use isAbilityAdjustWeights type guard to validate structure', async () => {
      systemParamRepo.findOne.mockResolvedValue({
        id: 1,
        paramKey: 'ability_adjust_weights',
        paramValue: validWeights,
        description: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as SystemParam);

      await service.getWeights();

      expect(isAbilityAdjustWeights).toHaveBeenCalledTimes(1);
      expect(isAbilityAdjustWeights).toHaveBeenCalledWith(validWeights);
    });
  });

  // ==================== calculateSingleRatingAdjust ====================

  describe('calculateSingleRatingAdjust', () => {
    it('should calculate correct adjust value with all dimensions filled', () => {
      const rating = {
        levelMatch: 'higher',
        sportsmanship: 'good',
        actionCleanliness: 'clean',
        isPunctual: true,
      } as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      // higher(1) + good(1) + clean(1) + true(1) = 4
      expect(result).toBe(4);
    });

    it('should calculate correct adjust value for level_match only', () => {
      const rating = {
        levelMatch: 'lower',
        sportsmanship: null,
        actionCleanliness: null,
        isPunctual: null,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      // lower(-1) + null(0) + null(0) + null(0) = -1
      expect(result).toBe(-1);
    });

    it('should calculate correct adjust value for sportsmanship only', () => {
      const rating = {
        levelMatch: null,
        sportsmanship: 'poor',
        actionCleanliness: null,
        isPunctual: null,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      // null(0) + poor(-1) + null(0) + null(0) = -1
      expect(result).toBe(-1);
    });

    it('should calculate correct adjust value for action_cleanliness only', () => {
      const rating = {
        levelMatch: null,
        sportsmanship: null,
        actionCleanliness: 'dirty',
        isPunctual: null,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      // null(0) + null(0) + dirty(-2) + null(0) = -2
      expect(result).toBe(-2);
    });

    it('should calculate correct adjust value for punctuality (true)', () => {
      const rating = {
        levelMatch: null,
        sportsmanship: null,
        actionCleanliness: null,
        isPunctual: true,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      // null(0) + null(0) + null(0) + true(1) = 1
      expect(result).toBe(1);
    });

    it('should calculate correct adjust value for punctuality (false)', () => {
      const rating = {
        levelMatch: null,
        sportsmanship: null,
        actionCleanliness: null,
        isPunctual: false,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      // null(0) + null(0) + null(0) + false(-1) = -1
      expect(result).toBe(-1);
    });

    it('should return 0 when all dimensions are null', () => {
      const rating = {
        levelMatch: null,
        sportsmanship: null,
        actionCleanliness: null,
        isPunctual: null,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      expect(result).toBe(0);
    });

    it('should handle unclear level_match as 0', () => {
      const rating = {
        levelMatch: 'unclear',
        sportsmanship: null,
        actionCleanliness: null,
        isPunctual: null,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      expect(result).toBe(0);
    });

    it('should handle average sportsmanship as 0', () => {
      const rating = {
        levelMatch: null,
        sportsmanship: 'average',
        actionCleanliness: null,
        isPunctual: null,
      } as unknown as FeedbackPlayerRating;

      const result = service.calculateSingleRatingAdjust(rating, validWeights);

      expect(result).toBe(0);
    });
  });

  // ==================== calculateMatchAdjustForPlayer ====================

  describe('calculateMatchAdjustForPlayer', () => {
    it('should sum multiple ratings for the same player', () => {
      const ratings = [
        { levelMatch: 'higher', sportsmanship: 'good', actionCleanliness: 'clean', isPunctual: true } as FeedbackPlayerRating,
        { levelMatch: 'equal', sportsmanship: 'average', actionCleanliness: 'average', isPunctual: true } as FeedbackPlayerRating,
      ];

      const result = service.calculateMatchAdjustForPlayer(ratings, validWeights);

      // Rating1: 1+1+1+1 = 4; Rating2: 0+0+0+1 = 1; Total = 5
      expect(result).toBe(5);
    });

    it('should clamp total to upper bound 50', () => {
      const ratings = Array(20).fill(null).map(() =>
        ({ levelMatch: 'higher', sportsmanship: 'good', actionCleanliness: 'clean', isPunctual: true } as FeedbackPlayerRating),
      );

      const result = service.calculateMatchAdjustForPlayer(ratings, validWeights);

      // Each = 4, 20 * 4 = 80, clamped to 50
      expect(result).toBe(50);
    });

    it('should clamp total to lower bound -50', () => {
      const ratings = Array(20).fill(null).map(() =>
        ({ levelMatch: 'lower', sportsmanship: 'poor', actionCleanliness: 'dirty', isPunctual: false } as FeedbackPlayerRating),
      );

      const result = service.calculateMatchAdjustForPlayer(ratings, validWeights);

      // Each: -1 + (-1) + (-2) + (-1) = -5, 20 * -5 = -100, clamped to -50
      expect(result).toBe(-50);
    });

    it('should handle mix of positive and negative ratings', () => {
      const ratings = [
        { levelMatch: 'higher', sportsmanship: 'good', actionCleanliness: 'clean', isPunctual: true } as FeedbackPlayerRating,
        { levelMatch: 'lower', sportsmanship: 'poor', actionCleanliness: 'dirty', isPunctual: false } as FeedbackPlayerRating,
      ];

      const result = service.calculateMatchAdjustForPlayer(ratings, validWeights);

      // 4 + (-5) = -1
      expect(result).toBe(-1);
    });

    it('should return 0 for empty ratings array', () => {
      const result = service.calculateMatchAdjustForPlayer([], validWeights);
      expect(result).toBe(0);
    });
  });

  // ==================== clampAdjustValue ====================

  describe('clampAdjustValue', () => {
    it('should return value within range as-is', () => {
      expect(service.clampAdjustValue(0)).toBe(0);
      expect(service.clampAdjustValue(25)).toBe(25);
      expect(service.clampAdjustValue(-25)).toBe(-25);
      expect(service.clampAdjustValue(50)).toBe(50);
      expect(service.clampAdjustValue(-50)).toBe(-50);
    });

    it('should clamp value above 50 to 50', () => {
      expect(service.clampAdjustValue(51)).toBe(50);
      expect(service.clampAdjustValue(100)).toBe(50);
    });

    it('should clamp value below -50 to -50', () => {
      expect(service.clampAdjustValue(-51)).toBe(-50);
      expect(service.clampAdjustValue(-100)).toBe(-50);
    });
  });
});
