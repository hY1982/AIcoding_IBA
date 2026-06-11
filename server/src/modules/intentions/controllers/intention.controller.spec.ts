import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IntentionController } from './intention.controller';
import { IntentionService, IntentionResponse } from '../services/intention.service';
import { PlayerService } from '@modules/players/services/player.service';
import { CreateIntentionDto } from '../dto/create-intention.dto';
import { UpdateIntentionDto } from '../dto/update-intention.dto';
import { QueryIntentionDto } from '../dto/query-intention.dto';
import { PaginatedResponse } from '@shared/common';

/**
 * IntentionController 单元测试
 *
 * 策略：Mock IntentionService 和 PlayerService，
 * 验证 Controller 层的路由委托、角色校验、异常传播逻辑。
 */
describe('IntentionController', () => {
  let controller: IntentionController;
  let intentionService: jest.Mocked<IntentionService>;
  let playerService: jest.Mocked<PlayerService>;

  const mockPlayerProfile = {
    id: 1,
    userId: 10,
    age: 25,
    basketballAge: 5,
    gender: 'male' as const,
    height: 180,
    positions: [],
    baseAbilityScore: 50,
    matchAdjustValue: 0,
    totalAbilityScore: 50,
    phone: '138****0001',
    nickname: 'TestPlayer',
    realName: '测试球员',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockIntentionResponse: IntentionResponse = {
    id: 1,
    playerId: 1,
    startTime: '2026-06-12T10:00:00.000Z',
    durationMinutes: 120,
    acceptableWaitMinutes: 30,
    endTime: '2026-06-12T12:00:00.000Z',
    status: 'pending',
    matchId: null,
    regionCode: 'shenzhen_futian',
    submittedAt: '2026-06-11T08:00:00.000Z',
    updatedAt: '2026-06-11T08:00:00.000Z',
    expiresAt: '2026-06-11T08:30:00.000Z',
    venues: [{ venueId: 1, priority: 1, venueName: 'Test Court' }],
    formats: [{ formatId: 1, priority: 1, formatName: '5v5 全场' }],
  };

  const mockPaginatedResponse: PaginatedResponse<IntentionResponse> = {
    page: 1,
    pageSize: 10,
    total: 1,
    list: [mockIntentionResponse],
  };

  function createPlayerRequest(overrides: Record<string, any> = {}) {
    return {
      user: {
        userId: 10,
        phone: '13800000001',
        userType: 'player',
        ...overrides,
      },
    } as any;
  }

  function createManagerRequest() {
    return {
      user: {
        userId: 20,
        phone: '13800000002',
        userType: 'venue_manager',
      },
    } as any;
  }

  beforeEach(async () => {
    const mockIntentionService = {
      create: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      findById: jest.fn(),
      findByPlayer: jest.fn(),
    };

    const mockPlayerService = {
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntentionController],
      providers: [
        { provide: IntentionService, useValue: mockIntentionService },
        { provide: PlayerService, useValue: mockPlayerService },
      ],
    }).compile();

    controller = module.get<IntentionController>(IntentionController);
    intentionService = module.get(IntentionService) as jest.Mocked<IntentionService>;
    playerService = module.get(PlayerService) as jest.Mocked<PlayerService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================
  // POST /intentions
  // ============================================================

  describe('POST /intentions (create)', () => {
    const dto: CreateIntentionDto = {
      startTime: '2026-06-12T10:00:00.000Z',
      durationMinutes: 120,
      venueIds: [{ venueId: 1, priority: 1 }],
      formatIds: [{ formatId: 1, priority: 1 }],
    };

    it('should create intention for player user', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.create.mockResolvedValue(mockIntentionResponse);

      const result = await controller.create(createPlayerRequest(), dto);

      expect(playerService.findByUserId).toHaveBeenCalledWith(10);
      expect(intentionService.create).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(mockIntentionResponse);
    });

    it('should reject venue_manager user with 403', async () => {
      await expect(
        controller.create(createManagerRequest(), dto),
      ).rejects.toThrow(ForbiddenException);

      expect(intentionService.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when player profile not found', async () => {
      playerService.findByUserId.mockResolvedValue(null);

      await expect(
        controller.create(createPlayerRequest(), dto),
      ).rejects.toThrow(NotFoundException);

      expect(intentionService.create).not.toHaveBeenCalled();
    });

    it('should propagate BadRequestException from service', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.create.mockRejectedValue(
        new BadRequestException('比赛开始时间必须至少提前 1 小时'),
      );

      await expect(
        controller.create(createPlayerRequest(), dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate ConflictException from service (time overlap)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.create.mockRejectedValue(
        new ConflictException('该时间段内已存在 pending 状态的比赛意向，时间重叠'),
      );

      await expect(
        controller.create(createPlayerRequest(), dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate NotFoundException from service (venue/format not found)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.create.mockRejectedValue(
        new NotFoundException('场地不存在: venueId=999'),
      );

      await expect(
        controller.create(createPlayerRequest(), dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // GET /intentions/my
  // ============================================================

  describe('GET /intentions/my (findMyIntentions)', () => {
    const query: QueryIntentionDto = { page: 1, pageSize: 10 };

    it('should return paginated intention list for player', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.findByPlayer.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findMyIntentions(createPlayerRequest(), query);

      expect(playerService.findByUserId).toHaveBeenCalledWith(10);
      expect(intentionService.findByPlayer).toHaveBeenCalledWith(1, query);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should pass query params to service', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.findByPlayer.mockResolvedValue(mockPaginatedResponse);

      const customQuery: QueryIntentionDto = { page: 2, pageSize: 5, status: 'pending' };
      await controller.findMyIntentions(createPlayerRequest(), customQuery);

      expect(intentionService.findByPlayer).toHaveBeenCalledWith(1, customQuery);
    });

    it('should reject venue_manager user with 403', async () => {
      await expect(
        controller.findMyIntentions(createManagerRequest(), query),
      ).rejects.toThrow(ForbiddenException);

      expect(intentionService.findByPlayer).not.toHaveBeenCalled();
    });

    it('should return empty list when no intentions', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      const emptyResponse: PaginatedResponse<IntentionResponse> = {
        page: 1,
        pageSize: 10,
        total: 0,
        list: [],
      };
      intentionService.findByPlayer.mockResolvedValue(emptyResponse);

      const result = await controller.findMyIntentions(createPlayerRequest(), query);

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // PUT /intentions/:id
  // ============================================================

  describe('PUT /intentions/:id (update)', () => {
    const dto: UpdateIntentionDto = { durationMinutes: 180 };

    it('should update intention for owner player', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      const updatedResponse = { ...mockIntentionResponse, durationMinutes: 180 };
      intentionService.update.mockResolvedValue(updatedResponse);

      const result = await controller.update(createPlayerRequest(), 1, dto);

      expect(playerService.findByUserId).toHaveBeenCalledWith(10);
      expect(intentionService.update).toHaveBeenCalledWith(1, 1, dto);
      expect(result.durationMinutes).toBe(180);
    });

    it('should reject venue_manager user with 403', async () => {
      await expect(
        controller.update(createManagerRequest(), 1, dto),
      ).rejects.toThrow(ForbiddenException);

      expect(intentionService.update).not.toHaveBeenCalled();
    });

    it('should propagate ForbiddenException from service (not owner)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.update.mockRejectedValue(
        new ForbiddenException('无权操作该意向'),
      );

      await expect(
        controller.update(createPlayerRequest(), 1, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException from service', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.update.mockRejectedValue(
        new NotFoundException('意向不存在: intentionId=999'),
      );

      await expect(
        controller.update(createPlayerRequest(), 999, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from service (invalid status)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.update.mockRejectedValue(
        new BadRequestException('当前状态为 matched，仅 pending 状态的意向可修改'),
      );

      await expect(
        controller.update(createPlayerRequest(), 1, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate ConflictException from service (time overlap)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.update.mockRejectedValue(
        new ConflictException('修改后的时间段与其他意向重叠'),
      );

      await expect(
        controller.update(createPlayerRequest(), 1, dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ============================================================
  // DELETE /intentions/:id
  // ============================================================

  describe('DELETE /intentions/:id (cancel)', () => {
    it('should cancel intention for owner player', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      const cancelledResponse = { ...mockIntentionResponse, status: 'cancelled' as const };
      intentionService.cancel.mockResolvedValue(cancelledResponse);

      const result = await controller.cancel(createPlayerRequest(), 1);

      expect(playerService.findByUserId).toHaveBeenCalledWith(10);
      expect(intentionService.cancel).toHaveBeenCalledWith(1, 1);
      expect(result.status).toBe('cancelled');
    });

    it('should reject venue_manager user with 403', async () => {
      await expect(
        controller.cancel(createManagerRequest(), 1),
      ).rejects.toThrow(ForbiddenException);

      expect(intentionService.cancel).not.toHaveBeenCalled();
    });

    it('should propagate ForbiddenException from service (not owner)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.cancel.mockRejectedValue(
        new ForbiddenException('无权操作该意向'),
      );

      await expect(
        controller.cancel(createPlayerRequest(), 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException from service', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.cancel.mockRejectedValue(
        new NotFoundException('意向不存在: intentionId=999'),
      );

      await expect(
        controller.cancel(createPlayerRequest(), 999),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BadRequestException from service (invalid status)', async () => {
      playerService.findByUserId.mockResolvedValue(mockPlayerProfile);
      intentionService.cancel.mockRejectedValue(
        new BadRequestException('当前状态为 confirmed，不可取消'),
      );

      await expect(
        controller.cancel(createPlayerRequest(), 1),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
