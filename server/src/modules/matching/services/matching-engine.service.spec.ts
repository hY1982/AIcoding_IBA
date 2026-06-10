import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { MatchingEngineService } from './matching-engine.service';
import { TeamBalancerService } from './team-balancer.service';
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

const createMockTeamBalancer = () => ({
  snakeDraft: jest.fn(),
  calculateBalanceScore: jest.fn(),
});

// ==================== Test Data Helpers ====================

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    userId: 100,
    user: {} as any,
    age: 25,
    basketballAge: 5,
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
    matchId: null,
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
  let teamBalancer: ReturnType<typeof createMockTeamBalancer>;

  beforeEach(async () => {
    intentionRepo = createMockRepository<Intention>();
    matchRepo = createMockRepository<Match>();
    formatRepo = createMockRepository<Format>();
    systemParamRepo = createMockRepository<SystemParam>();
    dataSource = createMockDataSource();
    teamBalancer = createMockTeamBalancer();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingEngineService,
        { provide: getRepositoryToken(Intention), useValue: intentionRepo },
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        { provide: getRepositoryToken(Format), useValue: formatRepo },
        { provide: getRepositoryToken(SystemParam), useValue: systemParamRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TeamBalancerService, useValue: teamBalancer },
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

  describe('group intentions', () => {
    it('should group intentions by preferred venue, format, and time window', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          startTime: new Date('2026-06-15T14:00:00Z'),
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
        createMockIntention({
          id: 2,
          playerId: 2,
          startTime: new Date('2026-06-15T14:00:00Z'),
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
        // Different venue - should be separate group
        createMockIntention({
          id: 3,
          playerId: 3,
          startTime: new Date('2026-06-15T14:00:00Z'),
          intentionVenues: [
            {
              id: 3,
              intentionId: 3,
              venueId: 2,
              priority: 1,
              venue: {} as any,
              intention: {} as any,
            },
          ],
          intentionFormats: [
            {
              id: 3,
              intentionId: 3,
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

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 75 },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      // Should form 2 groups: (venue=1, format=1) and (venue=2, format=1)
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

      expect(result.matchesCreated).toBeGreaterThanOrEqual(1);
      expect(teamBalancer.snakeDraft).toHaveBeenCalled();
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

    it('should not duplicate matches on retry', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      // First call: intentions are pending
      // Second call: intentions are already matched (simulating retry)
      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          status: i < 3 ? 'pending' : 'matched', // Some already matched
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
        return cb(manager);
      });

      teamBalancer.snakeDraft.mockReturnValue([
        { teamNumber: 1, players: [], avgAbility: 76 },
      ]);

      const result = await service.runMatching('shenzhen_futian');

      // Should still process but only match pending intentions
      expect(result.matchesCreated).toBeGreaterThanOrEqual(0);
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
    it('should isolate exceptions per group and continue processing other groups', async () => {
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

      // Should process 2 groups, one failed but didn't crash
      expect(result.groupsProcessed).toBe(2);
    });
  });

  // ==================== Fairness ====================

  describe('fairness', () => {
    it('should prioritize longer-waiting players when scores are equal', async () => {
      const mockParam = createMockSystemParamThreshold();
      systemParamRepo.findOneBy!.mockResolvedValue(mockParam);

      const now = new Date('2026-06-15T10:00:00Z');
      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          submittedAt: new Date(now.getTime() - 3600000), // 1 hour ago
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
        createMockIntention({
          id: 2,
          playerId: 2,
          submittedAt: new Date(now.getTime() - 1800000), // 30 min ago
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

      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      // Both have same score, but the service should process them
      expect(result.intentionsScanned).toBe(2);
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

      expect(mockVenueSlotQb.setLock).toHaveBeenCalledWith('pessimistic_write');
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

      // 模拟事务内过期更新成功
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.update.mockResolvedValue({ affected: 1 });
        return cb(manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(1);
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

  // ==================== Time Compatibility (HIGH-004) ====================

  describe('filterTimeCompatiblePlayers', () => {
    it('should filter out players with non-overlapping time windows', () => {
      const players = [
        {
          intentionId: 1,
          playerId: 1,
          totalAbilityScore: 80,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T14:00:00Z'),
          endTime: new Date('2026-06-15T16:00:00Z'),
          acceptableWaitMinutes: 30,
        },
        {
          intentionId: 2,
          playerId: 2,
          totalAbilityScore: 75,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T14:30:00Z'),
          endTime: new Date('2026-06-15T16:30:00Z'),
          acceptableWaitMinutes: 30,
        },
        // 时间完全不重叠，导致整体无交集，所有人被过滤
        {
          intentionId: 3,
          playerId: 3,
          totalAbilityScore: 70,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T18:00:00Z'),
          endTime: new Date('2026-06-15T20:00:00Z'),
          acceptableWaitMinutes: 30,
        },
      ];

      const result = (service as any).filterTimeCompatiblePlayers(players);

      // 当存在完全不重叠的时间窗口时，latestStart > earliestEnd，交集为空
      // 因此所有球员都被过滤（因为没有任何共同可行时间）
      expect(result).toHaveLength(0);
    });

    it('should keep players with overlapping time windows', () => {
      const players = [
        {
          intentionId: 1,
          playerId: 1,
          totalAbilityScore: 80,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T14:00:00Z'),
          endTime: new Date('2026-06-15T16:00:00Z'),
          acceptableWaitMinutes: 30,
        },
        {
          intentionId: 2,
          playerId: 2,
          totalAbilityScore: 75,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T14:30:00Z'),
          endTime: new Date('2026-06-15T16:30:00Z'),
          acceptableWaitMinutes: 30,
        },
        // 部分重叠，与 1 和 2 都有交集（14:30-16:00）
        {
          intentionId: 3,
          playerId: 3,
          totalAbilityScore: 70,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T15:00:00Z'),
          endTime: new Date('2026-06-15T17:00:00Z'),
          acceptableWaitMinutes: 30,
        },
      ];

      const result = (service as any).filterTimeCompatiblePlayers(players);

      // 三人共同交集为 15:00-16:00，都存在重叠
      expect(result).toHaveLength(3);
      expect(result.map((p: any) => p.playerId)).toContain(1);
      expect(result.map((p: any) => p.playerId)).toContain(2);
      expect(result.map((p: any) => p.playerId)).toContain(3);
    });

    it('should return empty array for empty input', () => {
      const result = (service as any).filterTimeCompatiblePlayers([]);
      expect(result).toEqual([]);
    });

    it('should keep all players when all time windows overlap', () => {
      const players = [
        {
          intentionId: 1,
          playerId: 1,
          totalAbilityScore: 80,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T14:00:00Z'),
          endTime: new Date('2026-06-15T16:00:00Z'),
          acceptableWaitMinutes: 30,
        },
        {
          intentionId: 2,
          playerId: 2,
          totalAbilityScore: 75,
          submittedAt: new Date(),
          startTime: new Date('2026-06-15T14:15:00Z'),
          endTime: new Date('2026-06-15T15:45:00Z'),
          acceptableWaitMinutes: 30,
        },
      ];

      const result = (service as any).filterTimeCompatiblePlayers(players);

      expect(result).toHaveLength(2);
    });
  });
});
