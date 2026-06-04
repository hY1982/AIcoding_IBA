import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FeedbackService } from './feedback.service';
import { AbilityAdjustService } from './ability-adjust.service';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Player } from '@modules/players/entities/player.entity';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';

const mockRepo = () => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockAbilityAdjustService = () => ({
  getWeights: jest.fn(),
  calculateSingleRatingAdjust: jest.fn(),
  calculateMatchAdjustForPlayer: jest.fn(),
  clampAdjustValue: jest.fn((v: number) => v),
});

const mockDataSource = () => ({
  transaction: jest.fn((fn) => fn({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((entity, data) => data),
    save: jest.fn((entity, data) => Promise.resolve(data)),
    getRepository: jest.fn(),
  })),
});

describe('FeedbackService', () => {
  let service: FeedbackService;
  let feedbackRepo: jest.Mocked<Repository<Feedback>>;
  let ratingRepo: jest.Mocked<Repository<FeedbackPlayerRating>>;
  let matchRepo: jest.Mocked<Repository<Match>>;
  let matchPlayerRepo: jest.Mocked<Repository<MatchPlayer>>;
  let playerRepo: jest.Mocked<Repository<Player>>;
  let failureRepo: jest.Mocked<Repository<AdjustUpdateFailure>>;
  let abilityAdjustService: jest.Mocked<AbilityAdjustService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(Feedback),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(FeedbackPlayerRating),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(Match),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(MatchPlayer),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(Player),
          useFactory: mockRepo,
        },
        {
          provide: getRepositoryToken(AdjustUpdateFailure),
          useFactory: mockRepo,
        },
        {
          provide: AbilityAdjustService,
          useFactory: mockAbilityAdjustService,
        },
        {
          provide: DataSource,
          useFactory: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    feedbackRepo = module.get(getRepositoryToken(Feedback));
    ratingRepo = module.get(getRepositoryToken(FeedbackPlayerRating));
    matchRepo = module.get(getRepositoryToken(Match));
    matchPlayerRepo = module.get(getRepositoryToken(MatchPlayer));
    playerRepo = module.get(getRepositoryToken(Player));
    failureRepo = module.get(getRepositoryToken(AdjustUpdateFailure));
    abilityAdjustService = module.get(AbilityAdjustService);
    dataSource = module.get(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== createFeedback ====================

  describe('createFeedback', () => {
    const createDto: CreateFeedbackDto = {
      matchId: 1,
      playerId: 10,
      overallRating: 4,
      overallReason: 'Great match!',
      playerRatings: [
        { ratedPlayerId: 20, levelMatch: 'equal', sportsmanship: 'good', actionCleanliness: 'clean', isPunctual: true },
      ],
    };

    it('should create feedback with playerRatings successfully', async () => {
      const mockMatch = { id: 1, status: 'completed', regionCode: 'test' } as Match;
      const mockMatchPlayer = { matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer;
      const mockOtherPlayer = { matchId: 1, playerId: 20, status: 'confirmed' } as MatchPlayer;
      const savedFeedback = { id: 100, ...createDto, submittedAt: new Date(), updatedAt: new Date(), regionCode: 'test' } as unknown as Feedback;
      const savedRating = { id: 200, feedbackId: 100, ratedPlayerId: 20 } as FeedbackPlayerRating;

      matchRepo.findOne.mockResolvedValue(mockMatch);
      matchPlayerRepo.findOne.mockResolvedValueOnce(mockMatchPlayer).mockResolvedValueOnce(mockOtherPlayer);
      feedbackRepo.findOneBy.mockResolvedValue(null);
      feedbackRepo.create.mockReturnValue(savedFeedback);
      feedbackRepo.save.mockResolvedValue(savedFeedback);
      ratingRepo.create.mockReturnValue(savedRating);
      ratingRepo.save.mockResolvedValue(savedRating);
      abilityAdjustService.getWeights.mockResolvedValue({
        level_match: { unclear: 0, lower: -1, equal: 0, higher: 1 },
        sportsmanship: { good: 1, average: 0, poor: -1 },
        action_cleanliness: { clean: 1, average: 0, dirty: -2 },
        punctuality: { true: 1, false: -1 },
      });
      abilityAdjustService.calculateMatchAdjustForPlayer.mockReturnValue(3);
      playerRepo.findOne.mockResolvedValue({ id: 20, matchAdjustValue: 0 } as Player);

      const result = await service.createFeedback(createDto);

      expect(result).toMatchObject({
        matchId: 1,
        playerId: 10,
        overallRating: 4,
        overallReason: 'Great match!',
      });
    });

    it('should reject when match does not exist', async () => {
      matchRepo.findOne.mockResolvedValue(null);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject when match status is not completed', async () => {
      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'pending_confirmation' } as Match);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject when player is not a match participant', async () => {
      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'completed' } as Match);
      matchPlayerRepo.findOne.mockResolvedValue(null);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject when player status is not confirmed', async () => {
      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'completed' } as Match);
      matchPlayerRepo.findOne.mockResolvedValue({ matchId: 1, playerId: 10, status: 'invited' } as MatchPlayer);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject duplicate feedback', async () => {
      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'completed' } as Match);
      matchPlayerRepo.findOne.mockResolvedValueOnce({ matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer);
      feedbackRepo.findOneBy.mockResolvedValue({ id: 99, matchId: 1, playerId: 10 } as Feedback);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject self-rating', async () => {
      const selfRatingDto: CreateFeedbackDto = {
        ...createDto,
        playerRatings: [{ ratedPlayerId: 10, levelMatch: 'equal' }],
      };

      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'completed' } as Match);
      matchPlayerRepo.findOne.mockResolvedValueOnce({ matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer);
      feedbackRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createFeedback(selfRatingDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject rating a player who is not in the same match', async () => {
      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'completed' } as Match);
      matchPlayerRepo.findOne
        .mockResolvedValueOnce({ matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer)
        .mockResolvedValueOnce(null);
      feedbackRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject rating a player who is not confirmed', async () => {
      matchRepo.findOne.mockResolvedValue({ id: 1, status: 'completed' } as Match);
      matchPlayerRepo.findOne
        .mockResolvedValueOnce({ matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer)
        .mockResolvedValueOnce({ matchId: 1, playerId: 20, status: 'invited' } as MatchPlayer);
      feedbackRepo.findOneBy.mockResolvedValue(null);

      await expect(service.createFeedback(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow empty playerRatings array', async () => {
      const emptyRatingsDto: CreateFeedbackDto = { ...createDto, playerRatings: [] };
      const mockMatch = { id: 1, status: 'completed' } as Match;
      const mockMatchPlayer = { matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer;
      const savedFeedback = { id: 100, ...emptyRatingsDto, submittedAt: new Date(), updatedAt: new Date(), regionCode: null } as unknown as Feedback;

      matchRepo.findOne.mockResolvedValue(mockMatch);
      matchPlayerRepo.findOne.mockResolvedValueOnce(mockMatchPlayer);
      feedbackRepo.findOneBy.mockResolvedValue(null);
      feedbackRepo.create.mockReturnValue(savedFeedback);
      feedbackRepo.save.mockResolvedValue(savedFeedback);

      const result = await service.createFeedback(emptyRatingsDto);

      expect(result).toMatchObject({
        matchId: 1,
        playerId: 10,
        overallRating: 4,
      });
      expect(ratingRepo.save).not.toHaveBeenCalled();
    });

    it('should retry updatePlayerMatchAdjust on failure and eventually succeed', async () => {
      const mockMatch = { id: 1, status: 'completed' } as Match;
      const mockMatchPlayer = { matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer;
      const mockOtherPlayer = { matchId: 1, playerId: 20, status: 'confirmed' } as MatchPlayer;
      const savedFeedback = { id: 100, ...createDto, submittedAt: new Date(), updatedAt: new Date(), regionCode: null } as unknown as Feedback;
      const savedRating = { id: 200, feedbackId: 100, ratedPlayerId: 20 } as FeedbackPlayerRating;

      matchRepo.findOne.mockResolvedValue(mockMatch);
      matchPlayerRepo.findOne.mockResolvedValueOnce(mockMatchPlayer).mockResolvedValueOnce(mockOtherPlayer);
      feedbackRepo.findOneBy.mockResolvedValue(null);
      feedbackRepo.create.mockReturnValue(savedFeedback);
      feedbackRepo.save.mockResolvedValue(savedFeedback);
      ratingRepo.create.mockReturnValue(savedRating);
      ratingRepo.save.mockResolvedValue(savedRating);
      abilityAdjustService.getWeights.mockResolvedValue({
        level_match: { unclear: 0, lower: -1, equal: 0, higher: 1 },
        sportsmanship: { good: 1, average: 0, poor: -1 },
        action_cleanliness: { clean: 1, average: 0, dirty: -2 },
        punctuality: { true: 1, false: -1 },
      });
      abilityAdjustService.calculateMatchAdjustForPlayer.mockReturnValue(3);

      // First two calls fail, third succeeds
      playerRepo.findOne
        .mockRejectedValueOnce(new Error('DB error'))
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 20, matchAdjustValue: 0 } as Player);

      const result = await service.createFeedback(createDto);

      expect(result).toMatchObject({
        matchId: 1,
        playerId: 10,
        overallRating: 4,
      });
      expect(playerRepo.findOne).toHaveBeenCalledTimes(3);
    });

    it('should log error and not throw when all retries fail', async () => {
      const mockMatch = { id: 1, status: 'completed' } as Match;
      const mockMatchPlayer = { matchId: 1, playerId: 10, status: 'confirmed' } as MatchPlayer;
      const mockOtherPlayer = { matchId: 1, playerId: 20, status: 'confirmed' } as MatchPlayer;
      const savedFeedback = { id: 100, ...createDto, submittedAt: new Date(), updatedAt: new Date(), regionCode: null } as unknown as Feedback;
      const savedRating = { id: 200, feedbackId: 100, ratedPlayerId: 20 } as FeedbackPlayerRating;

      matchRepo.findOne.mockResolvedValue(mockMatch);
      matchPlayerRepo.findOne.mockResolvedValueOnce(mockMatchPlayer).mockResolvedValueOnce(mockOtherPlayer);
      feedbackRepo.findOneBy.mockResolvedValue(null);
      feedbackRepo.create.mockReturnValue(savedFeedback);
      feedbackRepo.save.mockResolvedValue(savedFeedback);
      ratingRepo.create.mockReturnValue(savedRating);
      ratingRepo.save.mockResolvedValue(savedRating);
      abilityAdjustService.getWeights.mockResolvedValue({
        level_match: { unclear: 0, lower: -1, equal: 0, higher: 1 },
        sportsmanship: { good: 1, average: 0, poor: -1 },
        action_cleanliness: { clean: 1, average: 0, dirty: -2 },
        punctuality: { true: 1, false: -1 },
      });
      abilityAdjustService.calculateMatchAdjustForPlayer.mockReturnValue(3);

      // All 3 calls fail
      playerRepo.findOne.mockRejectedValue(new Error('Persistent DB error'));

      const result = await service.createFeedback(createDto);

      // Feedback should still be created successfully
      expect(result).toMatchObject({
        matchId: 1,
        playerId: 10,
        overallRating: 4,
      });
      // Should retry maxRetries times (3)
      expect(playerRepo.findOne).toHaveBeenCalledTimes(3);
    });
  });

  // ==================== findPendingFeedbacks ====================

  describe('findPendingFeedbacks', () => {
    it('should return completed matches where player has not submitted feedback', async () => {
      const pendingMatches = [
        { id: 1, status: 'completed' } as Match,
        { id: 2, status: 'completed' } as Match,
      ];

      matchRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(pendingMatches),
      } as any);

      const result = await service.findPendingFeedbacks(10);

      expect(result).toEqual(pendingMatches);
    });

    it('should return empty array when no pending feedbacks exist', async () => {
      matchRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.findPendingFeedbacks(10);

      expect(result).toEqual([]);
    });
  });
});
