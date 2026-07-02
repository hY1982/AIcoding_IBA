import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  SelectQueryBuilder,
  EntityManager,
} from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { MatchConfirmationService } from './match-confirmation.service';
import { Match } from '../entities/match.entity';
import { MatchPlayer } from '../entities/match-player.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { NotificationService } from '@modules/notifications/services/notification.service';
import { PAYMENT_PROVIDER } from '@modules/payments/interfaces/payment-provider.interface';
import { GROUP_CHAT_PROVIDER } from '../interfaces/group-chat-provider.interface';

// ==================== Mock Types ====================

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
  update: jest.fn(),
});

const createMockDataSource = () => ({
  transaction: jest.fn(),
  manager: {
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  },
});

const createMockQueryBuilder = <T extends object>(items: T[] = []) => {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(items[0] ?? null),
    getMany: jest.fn().mockResolvedValue(items),
    getManyAndCount: jest.fn().mockResolvedValue([items, items.length]),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  return qb as unknown as jest.Mocked<SelectQueryBuilder<T>>;
};

// ==================== Mock Data Helpers ====================

function createMockMatch(overrides: Partial<Match> = {}): Match {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  return {
    id: 1,
    venueId: 10,
    formatId: 20,
    startTime: twoHoursLater,
    endTime: new Date(twoHoursLater.getTime() + 2 * 60 * 60 * 1000),
    status: 'pending_players',
    teamCount: 3,
    playersPerTeam: 3,
    requiredPlayers: 9,
    confirmedPlayers: 0,
    version: 1,
    depositAmount: '50.00',
    groupChatId: null,
    regionCode: 'shenzhen_futian',
    confirmDeadline: null,
    venueConfirmDeadline: null,
    cancelledReason: null,
    minPlayers: 6,
    createdAt: now,
    updatedAt: now,
    matchPlayers: Promise.resolve([]),
    matchTeams: Promise.resolve([]),
    messages: Promise.resolve([]),
    venue: {} as any,
    format: {} as any,
    ...overrides,
  };
}

function createMockMatchPlayer(
  overrides: Partial<MatchPlayer> = {},
): MatchPlayer {
  return {
    id: 1,
    matchId: 1,
    playerId: 100,
    teamNumber: 1,
    intentionId: 1,
    confirmedAt: null,
    depositPaid: false,
    depositOrderNo: null,
    status: 'invited',
    match: {} as any,
    player: {} as any,
    intention: null,
    get isConfirmed() {
      return this.status === 'confirmed';
    },
    ...overrides,
  };
}

function createMockFormat(overrides: Partial<Format> = {}): Format {
  return {
    id: 20,
    name: '3v3 Short',
    formatType: 'short',
    teamSize: 3,
    teamCountMin: 2,
    teamCountMax: 4,
    winCondition: null,
    durationHours: 2,
    description: null,
    isActive: true,
    createdAt: new Date(),
    intentionFormats: Promise.resolve([]),
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('MatchConfirmationService', () => {
  let service: MatchConfirmationService;
  let matchRepo: MockRepository<Match>;
  let matchPlayerRepo: MockRepository<MatchPlayer>;
  let slotRepo: MockRepository<VenueTimeSlot>;
  let notificationService: jest.Mocked<NotificationService>;
  let formatRepo: MockRepository<Format>;
  let dataSource: ReturnType<typeof createMockDataSource>;
  let paymentService: jest.Mocked<any>;
  let groupChatService: jest.Mocked<any>;

  beforeEach(async () => {
    matchRepo = createMockRepository();
    matchPlayerRepo = createMockRepository();
    slotRepo = createMockRepository();
    notificationService = {
      createNotification: jest.fn(),
      batchCreateNotifications: jest.fn(),
      sendNotification: jest.fn(),
      findByUser: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;
    formatRepo = createMockRepository();
    dataSource = createMockDataSource();

    paymentService = {
      createOrder: jest.fn(),
      processPayment: jest.fn(),
      handleCallback: jest.fn(),
      queryOrder: jest.fn(),
      closeOrder: jest.fn(),
    };

    groupChatService = {
      createGroupChat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchConfirmationService,
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        { provide: getRepositoryToken(MatchPlayer), useValue: matchPlayerRepo },
        { provide: getRepositoryToken(VenueTimeSlot), useValue: slotRepo },
        { provide: NotificationService, useValue: notificationService },
        { provide: getRepositoryToken(Format), useValue: formatRepo },
        { provide: PAYMENT_PROVIDER, useValue: paymentService },
        { provide: GROUP_CHAT_PROVIDER, useValue: groupChatService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MatchConfirmationService>(MatchConfirmationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CONFIRM PARTICIPATION ====================

  describe('confirmParticipation', () => {
    it('should confirm participation before deadline (three-phase flow)', async () => {
      const matchId = 1;
      const playerId = 100;
      const mockMatch = createMockMatch({ id: matchId });
      const mockPlayer = createMockMatchPlayer({ matchId, playerId });
      const mockFormat = createMockFormat();
      let transactionCallCount = 0;

      dataSource.transaction.mockImplementation(async (cb: any) => {
        transactionCallCount++;
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) return Promise.resolve(mockPlayer);
            if (entity === Format) return Promise.resolve(mockFormat);
            return Promise.resolve(null);
          }),
          count: jest.fn().mockResolvedValue(1),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
        };
        return cb(manager);
      });

      paymentService.createOrder.mockResolvedValue({
        orderNo: 'mock_1234567890_0001',
        amount: '50.00',
        expireAt: new Date(Date.now() + 15 * 60 * 1000),
        status: 'pending',
      });

      paymentService.processPayment.mockResolvedValue({
        success: true,
        orderNo: 'mock_1234567890_0001',
        paidAt: new Date(),
      });

      const result = await service.confirmParticipation(matchId, playerId);

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('mock_1234567890_0001');
      expect(result.status).toBe('confirmed');
      expect(paymentService.createOrder).toHaveBeenCalled();
      expect(paymentService.processPayment).toHaveBeenCalled();
      expect(transactionCallCount).toBe(2); // Phase 1 + Phase 3
    });

    it('should rollback orderNo when payment fails', async () => {
      const matchId = 1;
      const playerId = 100;
      const mockMatch = createMockMatch({ id: matchId });
      const mockPlayer = createMockMatchPlayer({ matchId, playerId });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockResolvedValue(mockPlayer),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      paymentService.createOrder.mockResolvedValue({
        orderNo: 'mock_1234567890_0001',
        amount: '50.00',
        expireAt: new Date(Date.now() + 15 * 60 * 1000),
        status: 'pending',
      });

      paymentService.processPayment.mockResolvedValue({
        success: false,
        orderNo: 'mock_1234567890_0001',
        errorMessage: '余额不足',
      });

      await expect(
        service.confirmParticipation(matchId, playerId),
      ).rejects.toThrow(BadRequestException);

      expect(matchPlayerRepo.update).toHaveBeenCalledWith(
        { matchId, playerId },
        { depositOrderNo: null },
      );
    });

    it('should throw BadRequestException after deadline', async () => {
      const matchId = 1;
      const playerId = 100;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
      });
      const mockPlayer = createMockMatchPlayer({ matchId, playerId });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) return Promise.resolve(mockPlayer);
            return Promise.resolve(null);
          }),
        };
        return cb(manager);
      });

      await expect(
        service.confirmParticipation(matchId, playerId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when already confirmed', async () => {
      const matchId = 1;
      const playerId = 100;
      const mockMatch = createMockMatch({ id: matchId });
      const mockPlayer = createMockMatchPlayer({
        matchId,
        playerId,
        status: 'confirmed',
        depositPaid: true,
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) return Promise.resolve(mockPlayer);
            return Promise.resolve(null);
          }),
        };
        return cb(manager);
      });

      await expect(
        service.confirmParticipation(matchId, playerId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when already declined', async () => {
      const matchId = 1;
      const playerId = 100;
      const mockMatch = createMockMatch({ id: matchId });
      const mockPlayer = createMockMatchPlayer({
        matchId,
        playerId,
        status: 'withdrawn',  // v2.0: declined→withdrawn
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) return Promise.resolve(mockPlayer);
            return Promise.resolve(null);
          }),
        };
        return cb(manager);
      });

      await expect(
        service.confirmParticipation(matchId, playerId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([])),
        };
        return cb(manager);
      });

      await expect(service.confirmParticipation(999, 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when player not invited', async () => {
      const matchId = 1;
      const mockMatch = createMockMatch({ id: matchId });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockResolvedValue(null),
        };
        return cb(manager);
      });

      await expect(service.confirmParticipation(matchId, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== DECLINE PARTICIPATION ====================

  describe('declineParticipation', () => {
    it('should decline participation when invited (within transaction)', async () => {
      const matchId = 1;
      const playerId = 100;
      const mockMatch = createMockMatch({ id: matchId });
      const mockPlayer = createMockMatchPlayer({
        matchId,
        playerId,
        status: 'invited',
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockResolvedValue(mockPlayer),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      await service.declineParticipation(matchId, playerId);

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException when match not pending', async () => {
      const matchId = 1;
      const mockMatch = createMockMatch({ id: matchId, status: 'confirmed' });
      const mockPlayer = createMockMatchPlayer({
        matchId,
        playerId: 100,
        status: 'invited',
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockResolvedValue(mockPlayer),
        };
        return cb(manager);
      });

      await expect(service.declineParticipation(matchId, 100)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when already confirmed', async () => {
      const mockMatch = createMockMatch({ id: 1 });
      const mockPlayer = createMockMatchPlayer({ status: 'confirmed' });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockResolvedValue(mockPlayer),
        };
        return cb(manager);
      });

      await expect(service.declineParticipation(1, 100)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when player not found', async () => {
      const mockMatch = createMockMatch({ id: 1 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockResolvedValue(null),
        };
        return cb(manager);
      });

      await expect(service.declineParticipation(1, 100)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== CLOSE MATCH ====================

  describe('closeMatch', () => {
    it('should close a pending_players match with insufficient_players reason', async () => {
      const matchId = 1;
      const mockMatch = createMockMatch({ id: matchId, status: 'pending_players' });
      const mockPlayer = createMockMatchPlayer({ matchId, playerId: 100, status: 'confirmed', depositPaid: true, depositOrderNo: 'order_123' });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([mockMatch])),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) return Promise.resolve([mockPlayer]);
            return Promise.resolve([]);
          }),
          findOne: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      const result = await service.closeMatch(matchId, 'insufficient_players');

      expect(result.success).toBe(true);
      expect(result.message).toBe('比赛已关闭: insufficient_players');
    });

    it('should throw NotFoundException when match does not exist', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([])),
        };
        return cb(manager);
      });

      await expect(service.closeMatch(999, 'time_expired')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when match is already confirmed', async () => {
      const mockMatch = createMockMatch({ id: 1, status: 'confirmed' });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([mockMatch])),
        };
        return cb(manager);
      });

      await expect(service.closeMatch(1, 'venue_unavailable')).rejects.toThrow(ConflictException);
    });
  });

  // ==================== FINALIZE MATCH ====================

  describe('finalizeMatch', () => {
    it('should confirm match when enough players', async () => {
      const matchId = 1;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        confirmedPlayers: 6,
      });
      const mockFormat = createMockFormat({ teamCountMin: 2, teamSize: 3 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockImplementation((entity: any) => {
            const qb = createMockQueryBuilder([mockMatch]);
            if (entity === VenueTimeSlot) {
              (qb.getOne as jest.Mock).mockResolvedValue({
                id: 1,
                venueId: 10,
                slotDate: '2026-01-01',
                startTime: '10:00:00',
                endTime: '12:00:00',
                isBooked: false,
                matchId: null,
              });
            }
            return qb;
          }),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === Format) return Promise.resolve(mockFormat);
            if (entity === Venue) return Promise.resolve({ managerId: 50 });
            if (entity === VenueManager)
              return Promise.resolve({ userId: 200 });
            return Promise.resolve(null);
          }),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) {
              return Promise.resolve([
                createMockMatchPlayer({
                  matchId,
                  playerId: 101,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 102,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 103,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 104,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 105,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 106,
                  status: 'confirmed',
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
          count: jest.fn().mockResolvedValue(6),
          create: jest.fn().mockImplementation((entity: any, data: any) => ({
            id: 1,
            ...data,
          })),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      groupChatService.createGroupChat.mockResolvedValue(
        'match_1_1234567890_abc123',
      );
      matchPlayerRepo.find!.mockResolvedValue([
        createMockMatchPlayer({ matchId, playerId: 101, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 102, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 103, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 104, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 105, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 106, status: 'confirmed' }),
      ]);

      const result = await service.finalizeMatch(matchId);

      expect(result.status).toBe('confirmed');
      expect(result.confirmedPlayers).toBe(6);
      expect(result.requiredPlayers).toBe(6);
      expect(result.groupChatId).toBe('match_1_1234567890_abc123');
    });

    it('should fail match when not enough players', async () => {
      const matchId = 1;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        confirmedPlayers: 2,
      });
      const mockFormat = createMockFormat({ teamCountMin: 2, teamSize: 3 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === Format) return Promise.resolve(mockFormat);
            return Promise.resolve(null);
          }),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) {
              return Promise.resolve([
                createMockMatchPlayer({
                  matchId,
                  playerId: 101,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 102,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 103,
                  status: 'invited',
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
          count: jest.fn().mockResolvedValue(2),
          create: jest.fn().mockImplementation((entity: any, data: any) => ({
            id: 1,
            ...data,
          })),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      matchPlayerRepo.find!.mockResolvedValue([
        createMockMatchPlayer({ matchId, playerId: 101, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 102, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 103, status: 'invited' }),
      ]);

      const result = await service.finalizeMatch(matchId);

      expect(result.status).toBe('pending_players');  // v2.0: failed→pending_players (人数不足不触发failed)
      expect(result.confirmedPlayers).toBe(2);
      expect(result.requiredPlayers).toBe(6);
    });

    it('should throw BadRequestException when deadline not passed', async () => {
      const matchId = 1;
      const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: futureStart,
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
        };
        return cb(manager);
      });

      await expect(service.finalizeMatch(matchId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when match not pending', async () => {
      const matchId = 1;
      const pastDeadline = new Date(Date.now() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        status: 'confirmed',
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
        };
        return cb(manager);
      });

      await expect(service.finalizeMatch(matchId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException when match does not exist', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([])),
        };
        return cb(manager);
      });

      await expect(service.finalizeMatch(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== FINALIZE PENDING MATCHES ====================

  describe('finalizePendingMatches', () => {
    it('should process all pending matches past deadline', async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);

      const pendingMatches = [
        createMockMatch({ id: 1, startTime: pastDeadline }),
        createMockMatch({ id: 2, startTime: pastDeadline }),
      ];

      matchRepo.find!.mockResolvedValue(pendingMatches);

      const finalizeMock = jest.spyOn(service, 'finalizeMatch');
      finalizeMock
        .mockResolvedValueOnce({
          matchId: 1,
          status: 'confirmed',
          confirmedPlayers: 6,
          requiredPlayers: 6,
          groupChatId: 'gc_1',
        })
        .mockResolvedValueOnce({
          matchId: 2,
          status: 'expired',
          confirmedPlayers: 2,
          requiredPlayers: 6,
        });

      const result = await service.finalizePendingMatches();

      expect(result.processed).toBe(2);
      expect(result.confirmed).toBe(1);
      expect(result.failed).toBe(1);

      finalizeMock.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);

      const pendingMatches = [
        createMockMatch({ id: 1, startTime: pastDeadline }),
      ];

      matchRepo.find!.mockResolvedValue(pendingMatches);

      const finalizeMock = jest.spyOn(service, 'finalizeMatch');
      finalizeMock.mockRejectedValue(new Error('Database error'));

      const result = await service.finalizePendingMatches();

      expect(result.processed).toBe(1);
      expect(result.confirmed).toBe(0);
      expect(result.failed).toBe(1);

      finalizeMock.mockRestore();
    });
  });

  // ==================== HANDLE PAYMENT CALLBACK ====================

  describe('handlePaymentCallback', () => {
    it('should handle successful callback and update MatchPlayer', async () => {
      const orderNo = 'mock_123';
      const matchId = 1;
      const playerId = 100;
      const mockPlayer = createMockMatchPlayer({
        matchId,
        playerId,
        depositOrderNo: orderNo,
        depositPaid: false,
        status: 'invited',
      });

      paymentService.handleCallback.mockResolvedValue({
        orderNo,
        success: true,
        processed: true,
        message: '处理成功',
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) return Promise.resolve(mockPlayer);
            if (entity === Match)
              return Promise.resolve(createMockMatch({ id: matchId }));
            return Promise.resolve(null);
          }),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          count: jest.fn().mockResolvedValue(1),
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder()),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
        };
        return cb(manager);
      });

      const result = await service.handlePaymentCallback({
        orderNo,
        status: 'success',
      });

      expect(result.success).toBe(true);
      expect(paymentService.handleCallback).toHaveBeenCalled();
    });

    it('should handle duplicate callback', async () => {
      paymentService.handleCallback.mockResolvedValue({
        orderNo: 'mock_123',
        success: true,
        processed: false,
        message: '回调已处理',
      });

      const result = await service.handlePaymentCallback({
        orderNo: 'mock_123',
        status: 'success',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('回调已处理');
    });

    it('should handle failed callback', async () => {
      paymentService.handleCallback.mockResolvedValue({
        orderNo: 'mock_123',
        success: false,
        processed: false,
        message: '订单不存在',
      });

      const result = await service.handlePaymentCallback({
        orderNo: 'mock_123',
        status: 'failed',
      });

      expect(result.success).toBe(false);
    });
  });

  // ==================== RECONCILE PAYMENT STATUS ====================

  describe('reconcilePaymentStatus', () => {
    it('should return true when already paid', async () => {
      const mockPlayer = createMockMatchPlayer({
        matchId: 1,
        playerId: 100,
        depositPaid: true,
      });

      matchPlayerRepo.findOne!.mockResolvedValue(mockPlayer);

      const result = await service.reconcilePaymentStatus(1, 100);

      expect(result).toBe(true);
    });

    it('should reconcile when order is paid', async () => {
      const mockPlayer = createMockMatchPlayer({
        matchId: 1,
        playerId: 100,
        depositPaid: false,
        depositOrderNo: 'mock_123',
      });

      matchPlayerRepo.findOne!.mockResolvedValue(mockPlayer);
      paymentService.queryOrder.mockResolvedValue({
        orderNo: 'mock_123',
        status: 'paid',
        amount: '50.00',
        createdAt: new Date(),
      });
      matchPlayerRepo.update!.mockResolvedValue({ affected: 1 });

      const result = await service.reconcilePaymentStatus(1, 100);

      expect(result).toBe(true);
      expect(paymentService.queryOrder).toHaveBeenCalledWith('mock_123');
      expect(matchPlayerRepo.update).toHaveBeenCalled();
    });

    it('should return false when order not paid', async () => {
      const mockPlayer = createMockMatchPlayer({
        matchId: 1,
        playerId: 100,
        depositPaid: false,
        depositOrderNo: 'mock_123',
      });

      matchPlayerRepo.findOne!.mockResolvedValue(mockPlayer);
      paymentService.queryOrder.mockResolvedValue({
        orderNo: 'mock_123',
        status: 'pending',
        amount: '50.00',
        createdAt: new Date(),
      });

      const result = await service.reconcilePaymentStatus(1, 100);

      expect(result).toBe(false);
    });

    it('should return false when no orderNo', async () => {
      const mockPlayer = createMockMatchPlayer({
        matchId: 1,
        playerId: 100,
        depositPaid: false,
        depositOrderNo: null,
      });

      matchPlayerRepo.findOne!.mockResolvedValue(mockPlayer);

      const result = await service.reconcilePaymentStatus(1, 100);

      expect(result).toBe(false);
    });

    it('should throw NotFoundException when player not found', async () => {
      matchPlayerRepo.findOne!.mockResolvedValue(null);

      await expect(service.reconcilePaymentStatus(1, 100)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== NOTIFICATIONS ====================

  describe('notifications', () => {
    it('should call batchCreateNotifications when match confirmed', async () => {
      const matchId = 1;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        confirmedPlayers: 6,
      });
      const mockFormat = createMockFormat({ teamCountMin: 2, teamSize: 3 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockImplementation((entity: any) => {
            const qb = createMockQueryBuilder([mockMatch]);
            if (entity === VenueTimeSlot) {
              (qb.getOne as jest.Mock).mockResolvedValue({
                id: 1,
                venueId: 10,
                slotDate: '2026-01-01',
                startTime: '10:00:00',
                endTime: '12:00:00',
                isBooked: false,
                matchId: null,
              });
            }
            return qb;
          }),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === Format) return Promise.resolve(mockFormat);
            if (entity === Venue) return Promise.resolve({ managerId: 50 });
            if (entity === VenueManager)
              return Promise.resolve({ userId: 200 });
            return Promise.resolve(null);
          }),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) {
              return Promise.resolve([
                createMockMatchPlayer({
                  matchId,
                  playerId: 101,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 102,
                  status: 'confirmed',
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
          count: jest.fn().mockResolvedValue(6),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      groupChatService.createGroupChat.mockResolvedValue('gc_123');
      matchPlayerRepo.find!.mockResolvedValue([
        createMockMatchPlayer({ matchId, playerId: 101, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 102, status: 'confirmed' }),
      ]);
      notificationService.batchCreateNotifications.mockResolvedValue([]);
      notificationService.createNotification.mockResolvedValue({} as any);

      // Mock dataSource.manager.findOne for notifyVenueManager (outside transaction)
      dataSource.manager.findOne
        .mockResolvedValueOnce({ managerId: 50 }) // Venue
        .mockResolvedValueOnce({ userId: 200 }); // VenueManager

      await service.finalizeMatch(matchId);

      expect(notificationService.batchCreateNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [101, 102],
          type: 'match_success',
          title: '比赛已确认',
        }),
      );
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 200,
          type: 'match_success',
          title: '新比赛预订确认',
        }),
      );
    });

    it('should call createNotification for each player when match failed', async () => {
      const matchId = 1;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        confirmedPlayers: 2,
      });
      const mockFormat = createMockFormat({ teamCountMin: 2, teamSize: 3 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(createMockQueryBuilder([mockMatch])),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === Format) return Promise.resolve(mockFormat);
            return Promise.resolve(null);
          }),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) {
              return Promise.resolve([
                createMockMatchPlayer({
                  matchId,
                  playerId: 101,
                  status: 'confirmed',
                }),
                createMockMatchPlayer({
                  matchId,
                  playerId: 102,
                  status: 'invited',
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
          count: jest.fn().mockResolvedValue(2),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      matchPlayerRepo.find!.mockResolvedValue([
        createMockMatchPlayer({ matchId, playerId: 101, status: 'confirmed' }),
        createMockMatchPlayer({ matchId, playerId: 102, status: 'invited' }),
      ]);
      notificationService.createNotification.mockResolvedValue({} as any);

      await service.finalizeMatch(matchId);

      expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 101,
          type: 'match_failed',
          title: '比赛人数不足，已取消',
        }),
      );
    });

    it('should not notify venue manager when venue not found', async () => {
      const matchId = 1;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        confirmedPlayers: 6,
      });
      const mockFormat = createMockFormat({ teamCountMin: 2, teamSize: 3 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockImplementation((entity: any) => {
            const qb = createMockQueryBuilder([mockMatch]);
            if (entity === VenueTimeSlot) {
              (qb.getOne as jest.Mock).mockResolvedValue({
                id: 1,
                venueId: 10,
                slotDate: '2026-01-01',
                startTime: '10:00:00',
                endTime: '12:00:00',
                isBooked: false,
                matchId: null,
              });
            }
            return qb;
          }),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === Format) return Promise.resolve(mockFormat);
            if (entity === Venue) return Promise.resolve(null); // venue not found
            return Promise.resolve(null);
          }),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) {
              return Promise.resolve([
                createMockMatchPlayer({
                  matchId,
                  playerId: 101,
                  status: 'confirmed',
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
          count: jest.fn().mockResolvedValue(6),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      groupChatService.createGroupChat.mockResolvedValue('gc_123');
      matchPlayerRepo.find!.mockResolvedValue([
        createMockMatchPlayer({ matchId, playerId: 101, status: 'confirmed' }),
      ]);
      notificationService.batchCreateNotifications.mockResolvedValue([]);

      await service.finalizeMatch(matchId);

      expect(notificationService.batchCreateNotifications).toHaveBeenCalled();
      // venue manager notification should NOT be called because venue not found
      expect(notificationService.createNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '新比赛预订确认' }),
      );
    });

    it('should retry notification on failure', async () => {
      const matchId = 1;
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 30 * 60 * 1000);
      const mockMatch = createMockMatch({
        id: matchId,
        startTime: pastDeadline,
        confirmedPlayers: 6,
      });
      const mockFormat = createMockFormat({ teamCountMin: 2, teamSize: 3 });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          createQueryBuilder: jest.fn().mockImplementation((entity: any) => {
            const qb = createMockQueryBuilder([mockMatch]);
            if (entity === VenueTimeSlot) {
              (qb.getOne as jest.Mock).mockResolvedValue({
                id: 1,
                venueId: 10,
                slotDate: '2026-01-01',
                startTime: '10:00:00',
                endTime: '12:00:00',
                isBooked: false,
                matchId: null,
              });
            }
            return qb;
          }),
          findOne: jest.fn().mockImplementation((entity: any) => {
            if (entity === Format) return Promise.resolve(mockFormat);
            if (entity === Venue) return Promise.resolve({ managerId: 50 });
            if (entity === VenueManager)
              return Promise.resolve({ userId: 200 });
            return Promise.resolve(null);
          }),
          find: jest.fn().mockImplementation((entity: any) => {
            if (entity === MatchPlayer) {
              return Promise.resolve([
                createMockMatchPlayer({
                  matchId,
                  playerId: 101,
                  status: 'confirmed',
                }),
              ]);
            }
            return Promise.resolve([]);
          }),
          count: jest.fn().mockResolvedValue(6),
          save: jest
            .fn()
            .mockImplementation((_, entity) => Promise.resolve(entity)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        return cb(manager);
      });

      groupChatService.createGroupChat.mockResolvedValue('gc_123');
      matchPlayerRepo.find!.mockResolvedValue([
        createMockMatchPlayer({ matchId, playerId: 101, status: 'confirmed' }),
      ]);

      // First 2 calls fail, 3rd succeeds
      notificationService.batchCreateNotifications
        .mockRejectedValueOnce(new Error('DB error 1'))
        .mockRejectedValueOnce(new Error('DB error 2'))
        .mockResolvedValueOnce([]);

      const result = await service.finalizeMatch(matchId);

      expect(result.status).toBe('confirmed');
      expect(
        notificationService.batchCreateNotifications,
      ).toHaveBeenCalledTimes(3);
    });
  });
});
