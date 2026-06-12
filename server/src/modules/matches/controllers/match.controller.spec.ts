import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchConfirmationService, AlreadyConfirmedException } from '../services/match-confirmation.service';
import { MatchQueryService } from '../services/match-query.service';
import { MessageService } from '@modules/messages/services/message.service';
import { PlayerService } from '@modules/players/services/player.service';

describe('MatchController', () => {
  let controller: MatchController;
  let mockQueryService: any;
  let mockConfirmationService: any;
  let mockMessageService: any;
  let mockPlayerService: any;

  const mockPlayerProfile = { id: 42, userId: 100 } as any;

  function createMockReq(
    userType: string = 'player',
    userId: number = 100,
  ): any {
    return { user: { userId, userType } };
  }

  beforeEach(async () => {
    mockQueryService = {
      findMyMatches: jest.fn().mockResolvedValue({ page: 1, pageSize: 10, total: 0, list: [] }),
      findMatchDetail: jest.fn().mockResolvedValue({ id: 1 }),
    };
    mockConfirmationService = {
      confirmParticipation: jest.fn().mockResolvedValue({
        success: true, matchId: 1, playerId: 42,
        orderNo: 'ORD001', status: 'confirmed',
        matchStatus: 'pending_confirmation', message: '确认成功',
      }),
      declineParticipation: jest.fn().mockResolvedValue(undefined),
    };
    mockMessageService = {
      getMessageHistory: jest.fn().mockResolvedValue({ page: 1, pageSize: 20, total: 0, list: [] }),
      sendMessage: jest.fn().mockResolvedValue({ id: 1, content: 'hello' }),
    };
    mockPlayerService = {
      findByUserId: jest.fn().mockResolvedValue(mockPlayerProfile),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchController],
      providers: [
        { provide: MatchQueryService, useValue: mockQueryService },
        { provide: MatchConfirmationService, useValue: mockConfirmationService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: PlayerService, useValue: mockPlayerService },
      ],
    }).compile();

    controller = module.get<MatchController>(MatchController);
  });

  // ==================== 角色校验 ====================

  describe('Role validation (assertPlayerRole)', () => {
    it('should throw ForbiddenException for non-player user', async () => {
      await expect(
        controller.findMyMatches(createMockReq('venue_manager'), {} as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when player profile not found', async () => {
      mockPlayerService.findByUserId.mockResolvedValue(null);

      await expect(
        controller.findMyMatches(createMockReq('player'), {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== findMyMatches ====================

  describe('findMyMatches', () => {
    it('should delegate to MatchQueryService with correct params', async () => {
      const query = { page: 1, pageSize: 10 };
      await controller.findMyMatches(createMockReq(), query as any);

      expect(mockQueryService.findMyMatches).toHaveBeenCalledWith(42, query);
    });
  });

  // ==================== findMatchDetail ====================

  describe('findMatchDetail', () => {
    it('should delegate to MatchQueryService with correct params', async () => {
      await controller.findMatchDetail(createMockReq(), 7);

      expect(mockQueryService.findMatchDetail).toHaveBeenCalledWith(7, 42);
    });
  });

  // ==================== confirmParticipation ====================

  describe('confirmParticipation', () => {
    it('should delegate to MatchConfirmationService with correct params', async () => {
      await controller.confirmParticipation(createMockReq(), 5);

      expect(mockConfirmationService.confirmParticipation).toHaveBeenCalledWith(5, 42);
    });

    it('should propagate service exceptions (non-idempotent)', async () => {
      mockConfirmationService.confirmParticipation.mockRejectedValue(
        new ConflictException('已拒绝参赛，无法重新确认'),
      );

      await expect(
        controller.confirmParticipation(createMockReq(), 5),
      ).rejects.toThrow(ConflictException);
    });

    it('should return alreadyConfirmed for repeated confirm (idempotency)', async () => {
      mockConfirmationService.confirmParticipation.mockRejectedValue(
        new AlreadyConfirmedException(),
      );

      const result = await controller.confirmParticipation(createMockReq(), 5);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('alreadyConfirmed', true);
    });
  });

  // ==================== declineParticipation ====================

  describe('declineParticipation', () => {
    it('should return success object after service call', async () => {
      const result = await controller.declineParticipation(createMockReq(), 5);

      expect(mockConfirmationService.declineParticipation).toHaveBeenCalledWith(5, 42);
      expect(result).toEqual({ success: true, message: '已拒绝参赛' });
    });
  });

  // ==================== getMessageHistory ====================

  describe('getMessageHistory', () => {
    it('should pass userId (not playerId) to MessageService', async () => {
      const query = { page: 1, pageSize: 20 };
      await controller.getMessageHistory(createMockReq(), 5, query as any);

      expect(mockMessageService.getMessageHistory).toHaveBeenCalledWith(5, 100, query);
    });
  });

  // ==================== sendMessage ====================

  describe('sendMessage', () => {
    it('should pass userId + dto to MessageService', async () => {
      const dto = { content: 'hello', messageType: 'text' as const };
      await controller.sendMessage(createMockReq(), 5, dto as any);

      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(5, 100, dto);
    });
  });

  // ==================== assertPlayerRole on all endpoints ====================

  describe('All endpoints call assertPlayerRole', () => {
    it('should call assertPlayerRole for all 6 endpoints', async () => {
      const req = createMockReq();

      await controller.findMyMatches(req, {} as any);
      await controller.findMatchDetail(req, 1);
      await controller.confirmParticipation(req, 1);
      await controller.declineParticipation(req, 1);
      await controller.getMessageHistory(req, 1, {} as any);
      await controller.sendMessage(req, 1, { content: 'x' } as any);

      // findByUserId is called by assertPlayerRole, once per endpoint
      expect(mockPlayerService.findByUserId).toHaveBeenCalledTimes(6);
    });
  });
});
