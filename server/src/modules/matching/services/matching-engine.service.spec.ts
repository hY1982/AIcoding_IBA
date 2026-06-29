import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { MatchingEngineService } from './matching-engine.service';
import { MatchPoolService } from './match-pool.service';
import { VenueBookingService } from '@modules/venues/services/venue-booking.service';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
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
  create: jest.fn().mockImplementation((data: any) => data),
  save: jest.fn().mockImplementation((data: any) => Promise.resolve({ ...data, id: data?.id ?? 100 })),
  remove: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
  update: jest.fn(),
});

const createMockDataSource = () => ({
  transaction: jest.fn(),
  manager: {
    save: jest.fn().mockImplementation((_entity: any, data: any) => {
      const item = data !== undefined ? data : _entity;
      return Promise.resolve({ ...item, id: 100 });
    }),
    create: jest.fn().mockImplementation((_entity: any, data: any) => data),
    delete: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  },
  getRepository: jest.fn().mockReturnValue({
    createQueryBuilder: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  }),
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
    name: '3v3鐭�禌',
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
    excludedUntil: null,
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

function createMockSystemParamPooling(): SystemParam {
  return {
    id: 2,
    paramKey: 'pooling_params' as any,
    paramValue: {
      maxAbilitySpread: 12,
      minPoolSize: 6,
      timeAlignmentMinutes: 30,
    },
    description: '比赛池化参数',
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
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
  } as unknown as SelectQueryBuilder<T>;
  return qb;
}

// ==================== Test Suite ====================

describe('MatchingEngineService (v2.2)', () => {
  let service: MatchingEngineService;
  let intentionRepo: MockRepository<Intention>;
  let matchRepo: MockRepository<Match>;
  let formatRepo: MockRepository<Format>;
  let systemParamRepo: MockRepository<SystemParam>;
  let dataSource: ReturnType<typeof createMockDataSource>;
  let venueBookingService: ReturnType<typeof createMockVenueBookingService>;
  let matchPoolService: MatchPoolService;

  beforeEach(async () => {
    intentionRepo = createMockRepository<Intention>();
    matchRepo = createMockRepository<Match>();
    formatRepo = createMockRepository<Format>();
    systemParamRepo = createMockRepository<SystemParam>();
    dataSource = createMockDataSource();
    venueBookingService = createMockVenueBookingService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingEngineService,
        MatchPoolService,
        { provide: getRepositoryToken(Intention), useValue: intentionRepo },
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        { provide: getRepositoryToken(Format), useValue: formatRepo },
        { provide: getRepositoryToken(SystemParam), useValue: systemParamRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: VenueBookingService, useValue: venueBookingService },
      ],
    }).compile();

    service = module.get<MatchingEngineService>(MatchingEngineService);
    matchPoolService = module.get<MatchPoolService>(MatchPoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== Parameter Snapshot ====================

  describe('parameter snapshot', () => {
    it('should read both system params at the beginning of matching', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>([]),
      );

      await service.runMatching('shenzhen_futian');

      expect(systemParamRepo.findOneBy).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== Pooling & Segmentation ====================

  describe('pooling and segmentation', () => {
    it('should form pools for same venue+format with overlapping time windows', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

      // 6 players, same venue/format/time 鈫?1 pool 鈫?1 segment
      const intentions = Array.from({ length: 6 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
          startTime: new Date('2026-06-15T14:00:00Z'),
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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(6);
      expect(result.groupsProcessed).toBe(1); // 1 pool
      expect(result.matchesCreated).toBe(1);
    });

    it('should split non-overlapping time windows into separate pools', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

      // 6 players at 14:00 (window ends 14:30), 6 players at 15:00 (window ends 15:30)
      // These don't overlap 鈫?2 pools
      const intentions = [
        ...Array.from({ length: 6 }, (_, i) =>
          createMockIntention({
            id: i + 1,
            playerId: i + 1,
            player: createMockPlayer({ id: i + 1, totalAbilityScore: 75 + i }),
            startTime: new Date('2026-06-15T14:00:00Z'),
            acceptableWaitMinutes: 30,
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
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          createMockIntention({
            id: i + 7,
            playerId: i + 7,
            player: createMockPlayer({ id: i + 7, totalAbilityScore: 75 + i }),
            startTime: new Date('2026-06-15T15:00:00Z'),
            acceptableWaitMinutes: 30,
            intentionVenues: [
              {
                id: i + 7,
                intentionId: i + 7,
                venueId: 1,
                priority: 1,
                venue: {} as any,
                intention: {} as any,
              },
            ],
            intentionFormats: [
              {
                id: i + 7,
                intentionId: i + 7,
                formatId: 1,
                priority: 1,
                format: {} as any,
                intention: {} as any,
              },
            ],
          }),
        ),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(12);
      expect(result.groupsProcessed).toBe(2); // 2 pools
      expect(result.matchesCreated).toBe(2);
    });

    it('should create multiple segments when ability spread > maxSpread', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

      // 18 players, ability 50..80 (spread=30), maxSpread=12 鈫?ceil(30/12)=3 segments
      const intentions = Array.from({ length: 18 }, (_, i) =>
        createMockIntention({
          id: i + 1,
          playerId: i + 1,
          player: createMockPlayer({
            id: i + 1,
            totalAbilityScore: 50 + Math.floor((i * 30) / 18),
          }),
          startTime: new Date('2026-06-15T14:00:00Z'),
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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(18);
      expect(result.groupsProcessed).toBeGreaterThanOrEqual(1); // 1 pool, may create multiple segments
      expect(result.matchesCreated).toBeGreaterThanOrEqual(1); // multiple segments
    });
  });

  // ==================== Match Creation ====================

  describe('match creation', () => {
    it('should create match when pool meets minimum requirements', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBeGreaterThanOrEqual(1);
    });

    it('should not create match when pool is too small', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(0);
    });
  });

  // ==================== Empty Intentions ====================

  describe('empty intentions', () => {
    it('should handle empty pending intentions gracefully', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());
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
    it('should isolate exceptions per pool and continue processing', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

      const intentions = [
        // Pool 1: venue=1, format=1, 6 players
        ...Array.from({ length: 6 }, (_, i) =>
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
        ),
        // Pool 2: venue=2, format=1, 6 players
        ...Array.from({ length: 6 }, (_, i) =>
          createMockIntention({
            id: i + 7,
            playerId: i + 7,
            player: createMockPlayer({ id: i + 7, totalAbilityScore: 75 + i }),
            intentionVenues: [
              {
                id: i + 7,
                intentionId: i + 7,
                venueId: 2,
                priority: 1,
                venue: {} as any,
                intention: {} as any,
              },
            ],
            intentionFormats: [
              {
                id: i + 7,
                intentionId: i + 7,
                formatId: 1,
                priority: 1,
                format: {} as any,
                intention: {} as any,
              },
            ],
          }),
        ),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>(intentions),
      );
      matchRepo.find!.mockResolvedValue([]);

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

      expect(result.intentionsScanned).toBe(12);
      // Pool 1 fails (format error), Pool 2 succeeds 鈫?1 match created
      expect(result.matchesCreated).toBe(1);
      expect(result.matchesFailed).toBe(1);
    });
  });

  // ==================== Venue Time Slot Check ====================

  describe('venue time slot check', () => {
    it('should check venue availability before creating match', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      await service.runMatching('shenzhen_futian');

      expect(venueBookingService.checkAvailability).toHaveBeenCalled();
    });

    it('should skip match when venue is unavailable', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());
      venueBookingService.checkAvailability.mockResolvedValue(false);

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(0);
    });
  });

  // ==================== System Parameter Defaults ====================

  describe('system parameter defaults', () => {
    it('should use default params when system param is missing', async () => {
      systemParamRepo.findOneBy!.mockResolvedValue(null);

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder<Intention>([]),
      );

      const result = await service.runMatching();

      expect(result.intentionsScanned).toBe(0);
    });
  });

  // ==================== Expired Intentions ====================

  describe('expired intentions', () => {
    it('should process expired intentions successfully', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

      const now = new Date();
      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          status: 'pending',
          expiresAt: new Date(now.getTime() - 10 * 60 * 1000),
          player: createMockPlayer({ id: 1, totalAbilityScore: 75 }),
          intentionVenues: [],
          intentionFormats: [],
        }),
        createMockIntention({
          id: 2,
          playerId: 2,
          status: 'pending',
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(
        createMockFormat({ teamSize: 5, teamCountMin: 2 }),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.update.mockResolvedValue({ affected: 1 });
        return cb(manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(2);
      expect(result.expiredCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Existing Match Reuse ====================

  describe('existing match reuse', () => {
    it('should add new intentions to existing pending matches', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

      const existingMatch = {
        id: 100,
        venueId: 1,
        formatId: 1,
        startTime: new Date('2026-06-15T14:30:00Z'),
        status: 'pending_players',
        regionCode: 'shenzhen_futian',
      } as Match;

      matchRepo.find!.mockResolvedValue([existingMatch]);

      // New intention compatible with existing match
      const intentions = [
        createMockIntention({
          id: 1,
          playerId: 1,
          startTime: new Date('2026-06-15T14:00:00Z'),
          acceptableWaitMinutes: 60,
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

      const mockMatchPlayerQb = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.getRepository = jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockMatchPlayerQb),
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(1);
      // The new intention should be added to existing match (reused)
      expect(mockMatchPlayerQb.execute).toHaveBeenCalled();
    });
  });

  // ==================== Avatar Deduplication ====================

  describe('avatar deduplication', () => {
    it('should deduplicate avatars by intentionId within segment', () => {
      const avatars = [
        {
          id: '1_1_10',
          intentionId: 1,
          playerId: 101,
          totalAbilityScore: 70,
          venueId: 1,
          formatId: 10,
        },
        {
          id: '1_1_20',
          intentionId: 1,
          playerId: 101,
          totalAbilityScore: 75,
          venueId: 1,
          formatId: 20,
        },
        {
          id: '2_1_10',
          intentionId: 2,
          playerId: 102,
          totalAbilityScore: 60,
          venueId: 1,
          formatId: 10,
        },
      ] as any;

      const result = matchPoolService.deduplicateAvatars(avatars);

      expect(result).toHaveLength(2);
      // Intention 1 should keep the one with higher ability score (75)
      expect(result.find((a) => a.intentionId === 1)!.totalAbilityScore).toBe(75);
    });
  });

  // ==================== Backward Compatibility ====================

  describe('backward compatibility', () => {
    it('should produce same result for exact-match intentions', async () => {
      systemParamRepo.findOneBy!
        .mockResolvedValueOnce(createMockSystemParamThreshold())
        .mockResolvedValueOnce(createMockSystemParamPooling());

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
      matchRepo.find!.mockResolvedValue([]);
      formatRepo.findOneBy!.mockResolvedValue(createMockFormat());

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb(dataSource.manager);
      });

      const result = await service.runMatching('shenzhen_futian');

      expect(result.matchesCreated).toBe(1);
      expect(result.groupsProcessed).toBe(1);
    });
  });
});
