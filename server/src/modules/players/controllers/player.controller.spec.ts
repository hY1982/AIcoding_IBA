import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PlayerController } from './player.controller';
import { PlayerService } from '../services/player.service';
import { ShootingService } from '../services/shooting.service';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { CreateShootingRecordDto } from '../dto/create-shooting-record.dto';
import { PlayerProfile, ShootingStats } from '@shared/player';
import { PlayerShootingRecord } from '../entities/player-shooting-record.entity';

describe('PlayerController', () => {
  let controller: PlayerController;
  let playerService: Partial<Record<keyof PlayerService, jest.Mock>>;
  let shootingService: Partial<Record<keyof ShootingService, jest.Mock>>;

  const mockUser = { userId: 1, phone: '13812345678', userType: 'player' };
  const mockRequest = { user: mockUser } as any;

  const mockPlayerProfile: PlayerProfile = {
    id: 1,
    userId: 1,
    age: 25,
    basketballAge: 5,
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 190,
    standingReach: 230,
    jumpingReach: 310,
    positions: ['PG', 'SG'],
    regionCode: 'shenzhen_futian',
    baseAbilityScore: 62.5,
    matchAdjustValue: 0,
    totalAbilityScore: 62.5,
    phone: '138****5678',
    nickname: 'TestPlayer',
    realName: '张**',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-09T00:00:00Z',
  };

  beforeEach(async () => {
    playerService = {
      findByUserId: jest.fn(),
      update: jest.fn(),
    };

    shootingService = {
      createRecord: jest.fn(),
      getShootingStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlayerController],
      providers: [
        { provide: PlayerService, useValue: playerService },
        { provide: ShootingService, useValue: shootingService },
      ],
    }).compile();

    controller = module.get<PlayerController>(PlayerController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /profile', () => {
    it('should return masked player profile with valid user', async () => {
      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);

      const result = await controller.getProfile(mockRequest);

      expect(playerService.findByUserId).toHaveBeenCalledWith(mockUser.userId);
      expect(result).toEqual(mockPlayerProfile);
      expect(result.phone).toBe('138****5678');
      expect(result.realName).toBe('张**');
    });

    it('should throw NotFoundException when player profile does not exist', async () => {
      playerService.findByUserId!.mockResolvedValue(null);

      await expect(controller.getProfile(mockRequest)).rejects.toThrow(
        new NotFoundException('球员资料不存在'),
      );
    });
  });

  describe('PUT /profile', () => {
    it('should update player attributes and return updated profile', async () => {
      const updateDto: UpdatePlayerDto = { height: 190 };
      const updatedProfile = { ...mockPlayerProfile, height: 190 };

      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);
      playerService.update!.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockRequest, updateDto);

      expect(playerService.findByUserId).toHaveBeenCalledWith(mockUser.userId);
      expect(playerService.update).toHaveBeenCalledWith(mockPlayerProfile.id, updateDto);
      expect(result.height).toBe(190);
    });

    it('should trigger ability recalculation when height is updated', async () => {
      const updateDto: UpdatePlayerDto = { height: 190 };
      const updatedProfile = {
        ...mockPlayerProfile,
        height: 190,
        baseAbilityScore: 65.0,
        totalAbilityScore: 65.0,
      };

      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);
      playerService.update!.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockRequest, updateDto);

      expect(playerService.update).toHaveBeenCalledWith(mockPlayerProfile.id, updateDto);
      expect(result.baseAbilityScore).toBe(65.0);
    });

    it('should throw NotFoundException when player does not exist', async () => {
      playerService.findByUserId!.mockResolvedValue(null);

      await expect(
        controller.updateProfile(mockRequest, { height: 190 }),
      ).rejects.toThrow(new NotFoundException('球员资料不存在'));

      expect(playerService.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /shooting', () => {
    it('should create shooting record successfully', async () => {
      const dto: CreateShootingRecordDto = {
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 7,
        recordDate: '2026-06-09',
      };
      const expectedRecord = {
        id: 1,
        playerId: mockPlayerProfile.id,
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 7,
        recordDate: new Date(2026, 5, 9),
      } as PlayerShootingRecord;

      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);
      shootingService.createRecord!.mockResolvedValue(expectedRecord);

      const result = await controller.createShootingRecord(mockRequest, dto);

      expect(playerService.findByUserId).toHaveBeenCalledWith(mockUser.userId);
      expect(shootingService.createRecord).toHaveBeenCalledWith(
        mockPlayerProfile.id,
        dto,
      );
      expect(result).toEqual(expectedRecord);
    });

    it('should throw BadRequestException when shotsMade > shotsAttempted', async () => {
      const dto: CreateShootingRecordDto = {
        recordType: 'free_throw',
        shotsAttempted: 10,
        shotsMade: 11,
        recordDate: '2026-06-09',
      };

      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);
      shootingService.createRecord!.mockRejectedValue(
        new BadRequestException('命中数不能大于出手数'),
      );

      await expect(
        controller.createShootingRecord(mockRequest, dto),
      ).rejects.toThrow(new BadRequestException('命中数不能大于出手数'));
    });

    it('should throw NotFoundException when player does not exist', async () => {
      playerService.findByUserId!.mockResolvedValue(null);

      await expect(
        controller.createShootingRecord(mockRequest, {
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: '2026-06-09',
        }),
      ).rejects.toThrow(new NotFoundException('球员资料不存在'));

      expect(shootingService.createRecord).not.toHaveBeenCalled();
    });
  });

  describe('GET /shooting', () => {
    it('should return shooting stats array', async () => {
      const mockStats: ShootingStats[] = [
        {
          recordType: 'free_throw',
          totalAttempted: 30,
          totalMade: 22,
          percentage: 73.3,
        },
        {
          recordType: 'three_point',
          totalAttempted: 30,
          totalMade: 10,
          percentage: 33.3,
        },
      ];

      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);
      shootingService.getShootingStats!.mockResolvedValue(mockStats);

      const result = await controller.getShootingStats(mockRequest);

      expect(playerService.findByUserId).toHaveBeenCalledWith(mockUser.userId);
      expect(shootingService.getShootingStats).toHaveBeenCalledWith(
        mockPlayerProfile.id,
      );
      expect(result).toEqual(mockStats);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no records exist', async () => {
      playerService.findByUserId!.mockResolvedValue(mockPlayerProfile);
      shootingService.getShootingStats!.mockResolvedValue([]);

      const result = await controller.getShootingStats(mockRequest);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when player does not exist', async () => {
      playerService.findByUserId!.mockResolvedValue(null);

      await expect(controller.getShootingStats(mockRequest)).rejects.toThrow(
        new NotFoundException('球员资料不存在'),
      );

      expect(shootingService.getShootingStats).not.toHaveBeenCalled();
    });
  });
});
