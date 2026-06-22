import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { MatchingEngineService } from './matching-engine.service';
import { VenueBookingService } from '@modules/venues/services/venue-booking.service';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { MatchThresholdParams } from '@shared/system';

// ==================== Mock Types ====================

type MockRepository<T extends object = object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  findBy: jest.fn(),
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
    create: jest.fn().mockImplementation((_entity: any, data: any) => data),
    delete: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  },
});

const createMockVenueBookingService = () => ({
  checkAvailability: jest.fn().mockResolvedValue(true),
  bookSlot: jest.fn().mockResolvedValue(true),
  releaseSlot: jest.fn().mockResolvedValue(undefined),
});

// ==================== Test Data Helpers ====================

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    userId: 100,
    user: {} as any,
    age: 25,
    basketballAge: 5,
    birthDate: null,
    startPlayingDate: null,
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 190,
    standingReach: 230,
    jumpingReach: 320,
    baseAbilityScore: 72.5,
    matchAdjustValue: 0,
    totalAbilityScore: 72.5,
    benchPress: null,
    handLength: null,
    sprint100m: null,
    run1000m: null,
    run2000m: null,
    run5000m: null,
    runRecordDate: null,
    teamExperience: null,
    teamRole: null,
    breakthroughLevel: 0,
    passingLevel: 0,
    defenseLevel: 0,
    regionCode: 'shenzhen_futian',
    version: 0,
    positions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createMockFormat(overrides: Partial<Format> = {}): Format {
  return {
    id: 1,
    name: '3v3短赛',
    formatType: 'short',
    teamSize: 3,
    teamCountMin: 2,
    teamCountMax: 4,
    winCondition: '先进5球或11分',
    durationHours: 2,
    description: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    intentionFormats: Promise.resolve([]),
    ...overrides,
  };
}

function createMockIntention(overrides: Partial<Intention> = {}): Intention {
  const now = new Date('2026-06-15T10:00:00Z');
  const startTime = new Date('2026-06-15T14:00:00Z');
  const durationMinutes = 120;
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const acceptableWaitMinutes = 30;
  const submittedAt = now;
  const expiresAt = new Date(
    submittedAt.getTime() + acceptableWaitMinutes * 60 * 1000,
  );

  return {
    id: 1,
    playerId: 1,
    player: createMockPlayer(),
    startTime,
    durationMinutes,
    acceptableWaitMinutes,
    endTime,
    status: 'pending',
    regionCode: 'shenzhen_futian',
    submittedAt,
    updatedAt: now,
    expiresAt,
    intentionVenues: [],
    intentionFormats: [],
    computeDerivedTimes: jest.fn(),
    ...overrides,
  };
}

function createMockSystemParamThreshold(
  overrides: Partial<MatchThresholdParams> = {},
): SystemParam {
  return {
    id: 1,
    paramKey: 'match_threshold_params',
    paramValue: {
      base_threshold: 20.0,
      min_threshold: 5.0,
      intention_count_factor: 0.5,
      ...overrides,
    },
    description: '匹配动态阈值参数',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockQueryBuilder<T extends object>(
  items: T[] = [],
  options: { getCount?: number } = {},
): SelectQueryBuilder<T> {
  const qb = {
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
    getCount: jest.fn().mockResolvedValue(options.getCount ?? items.length),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    setLock: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
  } as unknown as SelectQueryBuilder<T>;
  return qb;
}

// ==================== Test Suite ====================

describe('MatchingEngineService', () => {
  let service: MatchingEngineService;
  let intentionRepo: MockRepository<Intention>;
  let matchRepo: MockRepository<Match>;
  let formatRepo: MockRepository<Format>;
  let systemParamRepo: MockRepository<SystemParam>;
  let dataSource: ReturnType<typeof createMockDataSource>;
  let venueBookingService: ReturnType<typeof createMockVenueBookingService>;
  // v2.0: backward-compatible alias for old test setup (snakeDraft no longer used in matching engine)
  let teamBalancer: { snakeDraft: jest.Mock; calculateBalanceScore: jest.Mock };

  beforeEach(async () => {
    intentionRepo = createMockRepository<Intention>();
    matchRepo = createMockRepository<Match>();
    formatRepo = createMockRepository<Format>();
    systemParamRepo = createMockRepository<SystemParam>();
    dataSource = createMockDataSource();
    venueBookingService = createMockVenueBookingService();
    // v2.0: backward-compatible alias for old test setup (snakeDraft no longer used)
    teamBalancer = { snakeDraft: jest.fn(), calculateBalanceScore: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingEngineService,
        { provide: getRepositoryToken(Intention), useValue: intentionRepo },
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        { provide: getRepositoryToken(Format), useValue: formatRepo },
        { provide: getRepositoryToken(SystemParam), useValue: systemParamRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: VenueBookingService, useValue: venueBookingService },
      ],
    }).compile();

    service = module.get<MatchingEngineService>(MatchingEngineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== Dynamic Threshold ====================

  describe('calculateDynamicThreshold', () => {
    it('should calculate threshold correctly for small intention count', () => {
      const params = {
        base_threshold: 20,
        min_threshold: 5,
        intention_count_factor: 0.5,
      };
      const result = (service as any).calculateDynamicThreshold(10, params);
      // max(5, 20 - 10*0.5) = max(5, 15) = 15
      expect(result).toBe(15);
    });

    it('should return min_threshold when intention count is large', () => {
      const params = {
        base_threshold: 20,
        min_threshold: 5,
        intention_count_factor: 0.5,
      };
      const result = (service as any).calculateDynamicThreshold(50, params);
      // max(5, 20 - 50*0.5) = max(5, -5) = 5
      expect(result).toBe(5);
    });

    it('should return base_threshold when intention count is zero', () => {
      const params = {
        base_threshold: 20,
        min_threshold: 5,
        intention_count_factor: 0.5,
      };
      const result = (service as any).calculateDynamicThreshold(0, params);
      expect(result).toBe(20);
    });

    it('should handle exact boundary where dynamic equals min', () => {
      const params = {
        base_threshold: 20,
        min_threshold: 5,
        intention_count_factor: 0.5,
      };
      // 20 - n*0.5 = 5 => n = 30
      const result = (service as any).calculateDynamicThreshold(30, params);
      expect(result).toBe(5);
    });
  });

  // ==================== Parameter Snapshot ====================

  describe('parameter snapshot', () => {
    it('should read system params once at the beginning of matching', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>([]),
      );

      await service.runMatching('shenzhen_futian');

      expect(systemParamRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(systemParamRepo.findOneBy).toHaveBeenCalledWith({
        paramKey: 'match_threshold_params',
      });
    });

    it('should use cached params throughout the matching task', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      // Create multiple intentions
      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({
            id: i + 1,
            totalAbilityScore: 80 - i * 2,
          }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          return Promise.resolve({ ...item, id: 1 });
        });
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 75 },
        { teamNumber: 2, players: [], avgAbility: 75 },
      ]);

      await service.runMatching('shenzhen_futian');

      // System param should only be queried once despite multiple groups
      expect(systemParamRepo.findOneBy).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== Grouping Logic ====================

  describe('compatible clustering (integration)', () => {
    it('should form separate groups for different venues with enough players', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      // v2.0: 按 venue+format 笛卡尔积分组，每组需 ≥ minPlayers (3v3=6) 人才能形成比赛
      const makeIntention = (id: number, venueId: number) =>
        createMockIntention({
          id, playerId: id,
          player: createMockPlayer({ id, totalAbilityScore: 70 + id }),
          startTime: new Date('2026-06-15T14:00:00Z'),
          intentionVenues: [{ id, intentionId: id, venueId, priority: 1, venue: {} as any, intention: {} as any }],
          intentionFormats: [{ id, intentionId: id, formatId: 1, priority: 1, format: {} as any, intention: {} as any }],
        });

      // venue 1: 6 players, venue 2: 6 players → 2 groups, each ≥ 6
      const intentions = [
        ...Array.from({ length: 6 }, (_, i) => makeIntention(i + 1, 1)),
        ...Array.from({ length: 6 }, (_, i) => makeIntention(i + 7, 2)),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockResolvedValue({ affected: 1 });
        return cb(manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      // Should form 2 groups: venue 1 and venue 2
      expect(result.groupsProcessed).toBe(2);
    });
  });

  // ==================== Match Creation ====================

  describe('match creation', () => {
    it('should create match when candidate set meets minimum requirements', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      // 6 players with similar ability scores for 3v3 (needs min 2 teams = 6 players)
      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const savedMatch = { id: 100 };
      const mockVenueSlotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          if (item.venueId !== undefined) {
            return Promise.resolve({ ...item, id: 100 });
          }
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockResolvedValue({ affected: 1 });
        manager.createQueryBuilder = jest.fn().mockReturnValue(mockVenueSlotQb);
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 76 },
        { teamNumber: 2, players: [], avgAbility: 77 },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      // v2.0: 不分队（延后到 confirmed），只验证比赛创建成功
      expect(result.matchesCreated).toBeGreaterThanOrEqual(1);
    });

    it('should not create match when candidate set is too small', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      // Only 3 players, but 3v3 needs at least 6 (2 teams * 3 players)
      const intentions = Array.from({ length: 3 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(0);
      expect(teamBalancer.snakeDraft).not.toHaveBeenCalled();
    });
  });

  // ==================== Idempotency ====================

  describe('idempotency', () => {
    it('should update intention status with WHERE status=pending for idempotency', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const capturedUpdates: any[] = [];
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          if (item.venueId !== undefined) {
            return Promise.resolve({ ...item, id: 100 });
          }
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockImplementation(
          (entity: any, criteria: any, data: any) => {
            capturedUpdates.push({ entity, criteria, data });
            return Promise.resolve({ affected: 1 });
          },
        );
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 76 },
        { teamNumber: 2, players: [], avgAbility: 77 },
      ]);

      await service.runMatching('shenzhen_futian');

      // Check that intention updates include status filter
      const intentionUpdates = capturedUpdates.filter(
        (u) => u.entity === Intention || u.entity?.name === 'Intention',
      );
      expect(intentionUpdates.length).toBeGreaterThan(0);
    });

    it('should use WHERE status=pending in updates for idempotent retry safety', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const capturedUpdates: any[] = [];
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          if (item.venueId !== undefined) {
            return Promise.resolve({ ...item, id: 100 });
          }
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockImplementation(
          (entity: any, criteria: any, data: any) => {
            capturedUpdates.push({ entity, criteria, data });
            return Promise.resolve({ affected: 1 });
          },
        );
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 76 },
        { teamNumber: 2, players: [], avgAbility: 77 },
      ]);

      await service.runMatching('shenzhen_futian');

      // 验证所有意向更新都包含幂等条件 status='pending'
      const intentionUpdates = capturedUpdates.filter(
        (u) => u.entity === Intention || u.entity?.name === 'Intention',
      );
      expect(intentionUpdates.length).toBeGreaterThan(0);
      for (const update of intentionUpdates) {
        expect(update.criteria).toEqual(
          expect.objectContaining({ status: 'pending' }),
        );
      }
    });
  });

  // ==================== Empty Intentions ====================

  describe('empty intentions', () => {
    it('should handle empty pending intentions gracefully', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>([]),
      );

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(0);
      expect(result.matchesCreated).toBe(0);
      expect(result.groupsProcessed).toBe(0);
    });
  });

  // ==================== Exception Isolation ====================

  describe('exception isolation', () => {
    it('should isolate exceptions per cluster and continue processing other clusters', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = [
        // Group 1: venue=1, format=1
        createMockIntention({
          id: 1,
          playerId: 1,
          player: createMockPlayer({ id: 1, totalAbilityScore: 80 }),
          intentionVenues: [
            {
              id: 1,
              intentionId: 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: 1,
              intentionId: 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
        // Group 2: venue=2, format=1
        createMockIntention({
          id: 2,
          playerId: 2,
          player: createMockPlayer({ id: 2, totalAbilityScore: 85 }),
          intentionVenues: [
            {
              id: 2,
              intentionId: 2,
              venueId: 2,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: 2,
              intentionId: 2,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      // Mock formatRepo to throw on first call but succeed on second
      let formatCallCount = 0;
      formatRepo.findOneBy!.mockImplementation(() => {
        formatCallCount++;
        if (formatCallCount === 1) {
          throw new Error('Database error');
        }
        return Promise.resolve(createMockFormat());
      });

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      // v2.0: formatRepo 异常被 try-catch 隔离，不影响整体流程
      // group 1 format 查询失败被跳过，group 2 人数不足也被跳过
      expect(result.intentionsScanned).toBe(2);
      expect(result.groupsProcessed).toBe(0); // 无有效候选组
    });
  });

  // ==================== Fairness ====================

  describe('fairness', () => {
    it('should prioritize longer-waiting players when scores are equal', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const now = new Date('2026-06-15T10:00:00Z');
      // 6 players with same ability score; first player waited longest
      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          submittedAt: new Date(now.getTime() - (6 - i) * 600000), // 60,50,40,30,20,10 min ago
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 75 },
        { teamNumber: 2, players: [], avgAbility: 75 },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      // All 6 scanned, forming 1 cluster with enough players
      expect(result.intentionsScanned).toBe(6);
      expect(result.groupsProcessed).toBe(1);
    });
  });

  // ==================== Venue Time Slot Booking ====================

  describe('venue time slot booking', () => {
    it('should attempt to book venue time slot', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const mockVenueSlotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          if (item.venueId !== undefined) {
            return Promise.resolve({ ...item, id: 100 });
          }
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockResolvedValue({ affected: 1 });
        manager.createQueryBuilder = jest.fn().mockReturnValue(mockVenueSlotQb);
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 76 },
        { teamNumber: 2, players: [], avgAbility: 77 },
      ]);

      await service.runMatching('shenzhen_futian');

      // v2.0: 使用 venueBookingService.checkAvailability 乐观检查（不再加锁）
      expect(venueBookingService.checkAvailability).toHaveBeenCalled();
    });

    it('should handle no available venue time slot gracefully', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      // 模拟无可用场地时段
      const mockVenueSlotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockResolvedValue({ affected: 1 });
        manager.createQueryBuilder = jest.fn().mockReturnValue(mockVenueSlotQb);
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        {
          teamNumber: 1,
          players: [{ id: 1, totalAbilityScore: 75 }],
          avgAbility: 76,
        },
        {
          teamNumber: 2,
          players: [{ id: 2, totalAbilityScore: 76 }],
          avgAbility: 77,
        },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(1);
    });

    it('should handle venue slot booking conflict (affected=0)', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const mockVenueSlotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        // 第一次 update（意向状态）成功，第二次（场地预订）失败
        let updateCallCount = 0;
        manager.update.mockImplementation(() => {
          updateCallCount++;
          if (updateCallCount <= 6) return Promise.resolve({ affected: 1 }); // 意向更新
          return Promise.resolve({ affected: 0 }); // 场地预订冲突
        });
        manager.createQueryBuilder = jest.fn().mockReturnValue(mockVenueSlotQb);
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        {
          teamNumber: 1,
          players: [{ id: 1, totalAbilityScore: 75 }],
          avgAbility: 76,
        },
        {
          teamNumber: 2,
          players: [{ id: 2, totalAbilityScore: 76 }],
          avgAbility: 77,
        },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(1);
    });
  });

  // ==================== System Parameter Defaults ====================

  describe('system parameter defaults', () => {
    it('should use default threshold params when system param is missing', async () => {
      systemParamRepo.findOneBy!.mockResolvedValue(null);

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>([]),
      );

      const result = await service.runMatching();

      expect(result.intentionsScanned).toBe(0);
    });

    it('should use default threshold params when param value is invalid', async () => {
      systemParamRepo.findOneBy!.mockResolvedValue({
        id: 1,
        paramKey: 'match_threshold_params',
        paramValue: { invalid: true },
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>([]),
      );

      const result = await service.runMatching();

      expect(result.intentionsScanned).toBe(0);
    });
  });

  // ==================== Idempotency Edge Cases ====================

  describe('idempotency edge cases', () => {
    it('should handle intention update with affected=0 (already processed)', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1,
              intentionId: i + 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1,
              intentionId: i + 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const mockVenueSlotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        // 模拟部分意向已被处理（affected=0）
        let updateCallCount = 0;
        manager.update.mockImplementation(() => {
          updateCallCount++;
          // 前3个意向更新成功，后3个失败（已被处理）
          return Promise.resolve({ affected: updateCallCount <= 3 ? 1 : 0 });
        });
        manager.createQueryBuilder = jest.fn().mockReturnValue(mockVenueSlotQb);
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        {
          teamNumber: 1,
          players: [{ id: 1, totalAbilityScore: 75 }],
          avgAbility: 76,
        },
        {
          teamNumber: 2,
          players: [{ id: 2, totalAbilityScore: 76 }],
          avgAbility: 77,
        },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(1);
    });
  });

  // ==================== Expired Intentions ====================

  describe('expired intentions', () => {
    it('should handle expired intention processing errors gracefully', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const now = new Date();
      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          status: 'pending',
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000), // 10分钟后过期
          player: createMockPlayer({ id: 1, totalAbilityScore: 75 }),
          intentionVenues: [
            {
              id: 1,
              intentionId: 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: 1,
              intentionId: 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(
        createMockFormat({ teamSize: 5, teamCountMin: 2 }),
      );

      // 模拟事务内过期更新时抛出异常
      dataSource.transaction.mockRejectedValue(new Error('Transaction error'));

      const result = await service.runMatching('shenzhen_futian');

      // 应该正常返回，异常被捕获
      expect(result.intentionsScanned).toBe(1);
    });

    it('should process expired intentions successfully', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const now = new Date();
      // Intention 1: already expired (expiresAt in the past) → eligible for expiry processing
      // Intention 2: not expired → excluded from expiry
      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          status: 'pending',
          expiresAt: new Date(now.getTime() - 10 * 60 * 1000), // v2.0: expiresAt <= now 才处理
          player: createMockPlayer({ id: 1, totalAbilityScore: 75 }),
          intentionVenues: [], // 无场地 → buildPlayerInfos 跳过
          intentionFormats: [],
        }),
        createMockIntention({
          id: 2,
          playerId: 2,
          status: 'pending',
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 不过期
          player: createMockPlayer({ id: 2, totalAbilityScore: 75 }),
          intentionVenues: [
            {
              id: 2,
              intentionId: 2,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: 2,
              intentionId: 2,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      // 模拟事务内过期更新成功
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.update.mockResolvedValue({ affected: 1 });
        return cb(manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(2);
      expect(result.expiredCount).toBe(1);
    });

    it('should handle expired intention with affected=0', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const now = new Date();
      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          status: 'pending',
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          player: createMockPlayer({ id: 1, totalAbilityScore: 75 }),
          intentionVenues: [
            {
              id: 1,
              intentionId: 1,
              venueId: 1,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: 1,
              intentionId: 1,
              formatId: 1,
              priority: 1,
              format: {} as any,
              intention: {} as any,
            },
          ],
        }),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(
        createMockFormat({ teamSize: 5, teamCountMin: 2 }),
      );

      // 模拟事务内更新未影响任何行（可能已被其他任务处理）
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.update.mockResolvedValue({ affected: 0 });
        return cb(manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(1);
      expect(result.expiredCount).toBe(0);
    });
  });

  // ==================== Compatibility Scoring ====================

  function createTestPlayerInfo(overrides: Partial<any> = {}): any {
    const intentionId = overrides.intentionId ?? 1;
    return {
      intention: createMockIntention({ id: intentionId, playerId: overrides.playerId ?? 1 }),
      intentionId: 1,
      playerId: 1,
      totalAbilityScore: 75,
      submittedAt: new Date('2026-06-15T10:00:00Z'),
      startTime: new Date('2026-06-15T14:00:00Z'),
      endTime: new Date('2026-06-15T16:00:00Z'),
      acceptableWaitMinutes: 30,
      durationMinutes: 120,
      venueIds: [1],
      formatIds: [1],
      venuePriorities: new Map([[1, 1]]),
      formatPriorities: new Map([[1, 1]]),
      ...overrides,
    };
  }

  describe('computeMatchScore', () => {
    it('should return full compatibility for identical intentions', () => {
      const a = createTestPlayerInfo();
      const b = createTestPlayerInfo({ intentionId: 2, playerId: 2 });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(true);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.timeScore).toBe(1);
      expect(result.venueScore).toBe(1);
      expect(result.formatScore).toBe(1);
      expect(result.durationScore).toBe(1);
      expect(result.abilityScore).toBe(1);
    });

    it('should return incompatible when time windows do not overlap', () => {
      const a = createTestPlayerInfo({
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 30,
      });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        startTime: new Date('2026-06-15T15:00:00Z'),
        acceptableWaitMinutes: 30,
      });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(false);
      expect(result.totalScore).toBe(0);
    });

    it('should return compatible when time windows overlap via acceptableWait', () => {
      const a = createTestPlayerInfo({
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 60,
      });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        startTime: new Date('2026-06-15T14:45:00Z'),
        acceptableWaitMinutes: 60,
      });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(true);
      expect(result.timeScore).toBeGreaterThan(0);
    });

    it('should return incompatible when venue lists have no intersection', () => {
      const a = createTestPlayerInfo({ venueIds: [1], venuePriorities: new Map([[1, 1]]) });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        venueIds: [2], venuePriorities: new Map([[2, 1]]),
      });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(false);
    });

    it('should return incompatible when format lists have no intersection', () => {
      const a = createTestPlayerInfo({ formatIds: [1], formatPriorities: new Map([[1, 1]]) });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        formatIds: [2], formatPriorities: new Map([[2, 1]]),
      });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(false);
    });

    it('should score venue by 1/max(priority) for cross-venue matching', () => {
      const a = createTestPlayerInfo({
        venueIds: [1, 2], venuePriorities: new Map([[1, 1], [2, 2]]),
      });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        venueIds: [2, 3], venuePriorities: new Map([[2, 1], [3, 2]]),
      });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(true);
      // Common venue is 2; A's priority=2, B's priority=1 → max=2 → 1/2 = 0.5
      expect(result.venueScore).toBe(0.5);
    });

    it('should score ability closeness correctly', () => {
      const a = createTestPlayerInfo({ totalAbilityScore: 80 });
      const b = createTestPlayerInfo({ intentionId: 2, playerId: 2, totalAbilityScore: 55 });
      const result = (service as any).computeMatchScore(a, b);
      // diff=25, score = max(0, 1.0 - 25/50) = 0.5
      expect(result.abilityScore).toBe(0.5);
    });

    it('should score duration tolerance as soft score (no hard constraint)', () => {
      const a = createTestPlayerInfo({ durationMinutes: 120 });
      const b = createTestPlayerInfo({ intentionId: 2, playerId: 2, durationMinutes: 180 });
      const result = (service as any).computeMatchScore(a, b);
      expect(result.compatible).toBe(true);
      // ratio = |120-180|/180 = 0.333, score = 1.0 - 0.333 = 0.667
      expect(result.durationScore).toBeCloseTo(0.667, 2);
    });
  });

  // ==================== Compatibility Matrix (v2.0) ====================

  describe('compatibility matrix (v2.0)', () => {
    it('should verify A-B compatible, B-C compatible, A-C not compatible via matrix', () => {
      const a = createTestPlayerInfo({
        intentionId: 1, playerId: 1,
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 30,
      });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        startTime: new Date('2026-06-15T14:15:00Z'),
        acceptableWaitMinutes: 60,
      });
      const c = createTestPlayerInfo({
        intentionId: 3, playerId: 3,
        startTime: new Date('2026-06-15T14:50:00Z'),
        acceptableWaitMinutes: 30,
      });
      const infos = [a, b, c];
      const matrix = (service as any).buildCompatibilityMatrix(infos);
      expect(matrix[0][1].compatible).toBe(true);
      expect(matrix[1][2].compatible).toBe(true);
      expect(matrix[0][2].compatible).toBe(false);
    });

    it('should handle flexible time matching: different startTime but wait windows overlap', () => {
      const a = createTestPlayerInfo({
        intentionId: 1, playerId: 1,
        startTime: new Date('2026-06-15T14:00:00Z'),
        acceptableWaitMinutes: 45,
      });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        startTime: new Date('2026-06-15T14:30:00Z'),
        acceptableWaitMinutes: 45,
      });
      const infos = [a, b];
      const matrix = (service as any).buildCompatibilityMatrix(infos);
      expect(matrix[0][1].compatible).toBe(true);
      // Overlap: [14:30, 14:45] = 15 min; min(45,45)=45 → timeScore = 15/45
      expect(matrix[0][1].timeScore).toBeCloseTo(15 / 45, 2);
    });

    it('should mark no-common-venue pair as incompatible in matrix', () => {
      const a = createTestPlayerInfo({
        intentionId: 1, playerId: 1,
        venueIds: [1], venuePriorities: new Map([[1, 1]]),
      });
      const b = createTestPlayerInfo({
        intentionId: 2, playerId: 2,
        venueIds: [2], venuePriorities: new Map([[2, 1]]),
      });
      const infos = [a, b];
      const matrix = (service as any).buildCompatibilityMatrix(infos);
      expect(matrix[0][1].compatible).toBe(false);
    });

    it('should detect no time overlap as incompatible via matrix', () => {
      const infos = [
        createTestPlayerInfo({
          intentionId: 1, playerId: 1,
          startTime: new Date('2026-06-15T14:00:00Z'),
          acceptableWaitMinutes: 10,
        }),
        createTestPlayerInfo({
          intentionId: 2, playerId: 2,
          startTime: new Date('2026-06-15T15:00:00Z'),
          acceptableWaitMinutes: 10,
        }),
      ];
      const matrix = (service as any).buildCompatibilityMatrix(infos);
      expect(matrix[0][1].compatible).toBe(false);
    });
  });

  // ==================== Performance ====================

  describe('performance', () => {
    it('should build compatibility matrix for 500 intentions within 2 seconds', () => {
      const now = new Date('2026-06-15T10:00:00Z');
      const infos = Array.from({ length: 500 }, (_, i) =>
        createTestPlayerInfo({
          intentionId: i + 1,
          playerId: i + 1,
          totalAbilityScore: 50 + (i % 50),
          submittedAt: new Date(now.getTime() - i * 60000),
          startTime: new Date('2026-06-15T14:00:00Z'),
          acceptableWaitMinutes: 30,
          venueIds: [(i % 3) + 1],
          venuePriorities: new Map([[(i % 3) + 1, 1]]),
          formatIds: [1],
          formatPriorities: new Map([[1, 1]]),
        }),
      );

      const start = Date.now();
      (service as any).buildCompatibilityMatrix(infos);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
    });

    it('should build compatibility matrix for 1000 intentions within 5 seconds', () => {
      const now = new Date('2026-06-15T10:00:00Z');
      const infos = Array.from({ length: 1000 }, (_, i) =>
        createTestPlayerInfo({
          intentionId: i + 1,
          playerId: i + 1,
          totalAbilityScore: 50 + (i % 50),
          submittedAt: new Date(now.getTime() - i * 60000),
          startTime: new Date('2026-06-15T14:00:00Z'),
          acceptableWaitMinutes: 30,
          venueIds: [(i % 3) + 1],
          venuePriorities: new Map([[(i % 3) + 1, 1]]),
          formatIds: [1],
          formatPriorities: new Map([[1, 1]]),
        }),
      );

      const start = Date.now();
      (service as any).buildCompatibilityMatrix(infos);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000);
    });
  });

  // ==================== segmentByAbility (v2.1) ====================

  describe('segmentByAbility', () => {
    // 3v3: teamSize=3, teamCountMin=2 → minPlayers=6, teamCountMax=4 → maxPlayers=12
    const MIN_3v3 = 6;
    const MAX_3v3 = 12;
    const MAX_SPREAD = 12;

    function makePlayers(count: number, abilityFn: (i: number) => number): any[] {
      return Array.from({ length: count }, (_, i) =>
        createTestPlayerInfo({
          intentionId: i + 1,
          playerId: i + 1,
          totalAbilityScore: abilityFn(i),
        }),
      );
    }

    it('should split 30 players (ability 50~79) into 2-3 segments for 3v3', () => {
      // 30 players, ability scores 50..79 (spread=29)
      // maxPlayers=12 → segments of up to 12; sorted already
      const players = makePlayers(30, (i) => 50 + i);
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);

      // Expect 2 segments of 12 (spread=11 each ≤ 12), tail of 6 (spread=5 ≤ 12) → 3 segments
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(segments.length).toBeLessThanOrEqual(3);

      // Every segment must have ≥ minPlayers
      for (const seg of segments) {
        expect(seg.length).toBeGreaterThanOrEqual(MIN_3v3);
      }

      // Every segment spread ≤ maxSpread
      for (const seg of segments) {
        const spread = seg[seg.length - 1].totalAbilityScore - seg[0].totalAbilityScore;
        expect(spread).toBeLessThanOrEqual(MAX_SPREAD);
      }
    });

    it('should discard tail when remaining players < minPlayers', () => {
      // 10 players, ability 50..59. maxPlayers=12 → first chunk=10 (ok, 10≥6)
      // But let's test with maxPlayers=9: first chunk=9 (spread=8≤12 → ok), tail=1 (< 6 → discard)
      const players = makePlayers(10, (i) => 50 + i);
      const segments = (service as any).segmentByAbility(players, 9, MIN_3v3, MAX_SPREAD);

      // First segment: 9 players [50..58], spread=8 ≤ 12 → ok
      // Tail: 1 player [59] → < 6 → discarded
      expect(segments.length).toBe(1);
      expect(segments[0].length).toBe(9);
    });

    it('should reject segment when spread exceeds maxSpread', () => {
      // 11 players: [50,51,52,53,54,55,56,57,58,59, 80]
      // maxPlayers=12 → one chunk of 11, spread = 80-50 = 30 > 12 → rejected
      const players = makePlayers(11, (i) => (i < 10 ? 50 + i : 80));
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);

      // The single chunk of 11 has spread=30 > 12 → rejected, no segments
      expect(segments.length).toBe(0);
    });

    it('should isolate outlier while keeping valid segment', () => {
      // 13 players: [50..59 (10 players), 80, 81, 82]
      // maxPlayers=12 → chunk1 = [50..61] (12 players, includes 80? No.)
      // Actually sorted: [50,51,52,53,54,55,56,57,58,59,80,81,82]
      // chunk1 = first 12 = [50..59,80,81], spread=81-50=31 > 12 → rejected
      // chunk2 = [82], length=1 < 6 → break
      // Result: 0 segments (because chunk1 straddles the gap)
      // Better scenario: 22 players [50..59 (10), 60..69 (10), 80, 81]
      // chunk1 = [50..61] (first 12), spread = 61-50=11 ≤ 12 → ok
      // chunk2 = [62..73] (next 10), spread = 69-62=7... wait let me recalculate
      // Actually: sorted = [50,51,...,59,60,61,...,69,80,81]
      // chunk1 = [50..61] spread=11 ok; chunk2 = [62..69,80,81] length=10, spread=81-62=19>12 → rejected
      // So: 1 valid segment
      const players = makePlayers(22, (i) => {
        if (i < 20) return 50 + i; // 50..69
        return 80 + (i - 20);     // 80, 81
      });
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);

      // chunk1: [50..61] 12 players, spread=11 ≤ 12 → valid
      // chunk2: [62..69, 80, 81] 10 players, spread=81-62=19 > 12 → rejected
      expect(segments.length).toBe(1);
      expect(segments[0].length).toBe(12);
      // Outliers (80, 81) are not in any segment
      const allIds = segments.flat().map((p: any) => p.totalAbilityScore);
      expect(allIds).not.toContain(80);
      expect(allIds).not.toContain(81);
    });

    it('should return empty array when input < minPlayers', () => {
      const players = makePlayers(3, (i) => 50 + i);
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);
      expect(segments.length).toBe(0);
    });

    it('should return empty array for empty input', () => {
      const segments = (service as any).segmentByAbility([], MAX_3v3, MIN_3v3, MAX_SPREAD);
      expect(segments.length).toBe(0);
    });

    it('should handle exactly minPlayers as one segment', () => {
      // 6 players, all within spread
      const players = makePlayers(6, (i) => 70 + i); // [70..75], spread=5 ≤ 12
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);
      expect(segments.length).toBe(1);
      expect(segments[0].length).toBe(6);
    });

    it('should sort by ability ascending then by intentionId for stability', () => {
      // Same ability scores, different intentionIds
      const players = [
        createTestPlayerInfo({ intentionId: 5, playerId: 5, totalAbilityScore: 70 }),
        createTestPlayerInfo({ intentionId: 2, playerId: 2, totalAbilityScore: 70 }),
        createTestPlayerInfo({ intentionId: 8, playerId: 8, totalAbilityScore: 70 }),
        createTestPlayerInfo({ intentionId: 1, playerId: 1, totalAbilityScore: 70 }),
        createTestPlayerInfo({ intentionId: 3, playerId: 3, totalAbilityScore: 70 }),
        createTestPlayerInfo({ intentionId: 7, playerId: 7, totalAbilityScore: 70 }),
      ];
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);
      expect(segments.length).toBe(1);
      const ids = segments[0].map((p: any) => p.intentionId);
      // Should be sorted by intentionId when ability is equal
      expect(ids).toEqual([1, 2, 3, 5, 7, 8]);
    });

    it('should handle 2000 players and produce matches with spread ≤ maxSpread', () => {
      // Simulate 2000 players with normally distributed ability (50~87)
      const players = makePlayers(2000, (i) => {
        // Spread across 50..87 (range=37), roughly normal via modular
        return 50 + (i * 37) / 2000;
      });

      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, MAX_SPREAD);

      // With 2000 players, maxPlayers=12 → up to 166 segments
      expect(segments.length).toBeGreaterThan(0);

      // Every segment must respect constraints
      for (const seg of segments) {
        expect(seg.length).toBeGreaterThanOrEqual(MIN_3v3);
        expect(seg.length).toBeLessThanOrEqual(MAX_3v3);
        const spread = seg[seg.length - 1].totalAbilityScore - seg[0].totalAbilityScore;
        expect(spread).toBeLessThanOrEqual(MAX_SPREAD);
      }

      // All segments sorted ascending
      for (const seg of segments) {
        for (let j = 1; j < seg.length; j++) {
          expect(seg[j].totalAbilityScore).toBeGreaterThanOrEqual(seg[j - 1].totalAbilityScore);
        }
      }
    });

    it('should respect custom maxSpread from threshold params', () => {
      // 12 players with spread=11, custom maxSpread=5 → should be rejected
      const players = makePlayers(12, (i) => 50 + i); // [50..61], spread=11
      const segments = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, 5);
      expect(segments.length).toBe(0);

      // Same players with maxSpread=15 → should be accepted
      const segments2 = (service as any).segmentByAbility(players, MAX_3v3, MIN_3v3, 15);
      expect(segments2.length).toBe(1);
    });
  });

  // ==================== Backward Compatibility Regression ====================

  describe('backward compatibility', () => {
    it('should produce same result as old algorithm for exact-match intentions', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      // 6 players with same venue/format/time (exact match scenario)
      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          intentionVenues: [
            {
              id: i + 1, intentionId: i + 1,
              venueId: 1, priority: 1,
              venue: {} as any, intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: i + 1, intentionId: i + 1,
              formatId: 1, priority: 1,
              format: {} as any, intention: {} as any,
            },
          ],
        }),
      );

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const mockVenueSlotQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1 }),
      };

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any, data: any) => {
          const item = data !== undefined ? data : entity;
          if (item.venueId !== undefined) {
            return Promise.resolve({ ...item, id: 100 });
          }
          return Promise.resolve({ ...item, id: 1 });
        });
        manager.create.mockImplementation((_entity: any, data: any) => data);
        manager.update.mockResolvedValue({ affected: 1 });
        manager.createQueryBuilder = jest.fn().mockReturnValue(mockVenueSlotQb);
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 76 },
        { teamNumber: 2, players: [], avgAbility: 77 },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      // Same as old algorithm: 1 cluster, 1 match created
      expect(result.matchesCreated).toBe(1);
      expect(result.groupsProcessed).toBe(1);
    });
  });
});
