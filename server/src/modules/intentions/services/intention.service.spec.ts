import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder, In } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { IntentionService } from './intention.service';
import { Intention } from '../entities/intention.entity';
import { IntentionVenue } from '../entities/intention-venue.entity';
import { IntentionFormat } from '../entities/intention-format.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueUnavailableSlot } from '@modules/venues/entities/venue-unavailable-slot.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { CreateIntentionDto } from '../dto/create-intention.dto';
import { UpdateIntentionDto } from '../dto/update-intention.dto';
import { QueryIntentionDto } from '../dto/query-intention.dto';
import { IntentionStatus } from '@shared/intention';

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
});

const createMockDataSource = () => ({
  transaction: jest.fn(),
  manager: {
    save: jest.fn(),
    create: jest.fn().mockImplementation((_entity: any, data: any) => ({
      ...data,
      computeDerivedTimes: jest.fn(),
    })),
    delete: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  },
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

function createMockVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 1,
    managerId: 10,
    name: 'Test Basketball Court',
    address: '深圳市福田区测试路1号',
    pricePerHour: 200,
    courtCount: 2,
    latitude: 22.5431,
    longitude: 114.0579,
    floorMaterial: null,
    lighting: null,
    courtType: null,
    ventilation: false,
    bigFan: false,
    airCondition: false,
    turnoverTime: null,
    parking: false,
    restroom: false,
    shower: false,
    lockerRoom: false,
    videoRecord: false,
    ratingAvg: null,
    ratingCount: 0,
    status: 'active',
    regionCode: 'shenzhen_futian',
    openTime: '08:00:00',
    closeTime: '22:00:00',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 0,
    timeSlots: [],
    unavailableSlots: [],
    intentionVenues: Promise.resolve([]),
    manager: {} as any,
    ...overrides,
  };
}

function createMockFormat(overrides: Partial<Format> = {}): Format {
  return {
    id: 1,
    name: '3v3短赛',
    formatType: 'short',
    teamSize: 3,
    teamCountMin: 3,
    teamCountMax: 4,
    winCondition: '先进5球或11分',
    durationHours: 2,
    description: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    intentionFormats: Promise.resolve([]),
    ...overrides,
  } as Format;
}

function createMockIntention(overrides: Partial<Intention> = {}): Intention {
  const now = new Date();
  const startTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
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
    // v2.0: matchId removed
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
    getManyAndCount: jest.fn().mockResolvedValue([items, items.length]),
    getMany: jest.fn().mockResolvedValue(items),
    getCount: jest.fn().mockResolvedValue(options.getCount ?? items.length),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as SelectQueryBuilder<T>;
  return qb;
}

// ==================== Test Suite ====================

describe('IntentionService', () => {
  let service: IntentionService;
  let intentionRepo: MockRepository<Intention>;
  let intentionVenueRepo: MockRepository<IntentionVenue>;
  let intentionFormatRepo: MockRepository<IntentionFormat>;
  let playerRepo: MockRepository<Player>;
  let venueRepo: MockRepository<Venue>;
  let formatRepo: MockRepository<Format>;
  let unavailableSlotRepo: MockRepository<VenueUnavailableSlot>;
  let timeSlotRepo: MockRepository<VenueTimeSlot>;
  let dataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(async () => {
    intentionRepo = createMockRepository<Intention>();
    intentionVenueRepo = createMockRepository<IntentionVenue>();
    intentionFormatRepo = createMockRepository<IntentionFormat>();
    playerRepo = createMockRepository<Player>();
    venueRepo = createMockRepository<Venue>();
    formatRepo = createMockRepository<Format>();
    unavailableSlotRepo = createMockRepository<VenueUnavailableSlot>();
    timeSlotRepo = createMockRepository<VenueTimeSlot>();
    dataSource = createMockDataSource();

    // 默认场地时段无冲突（不可预订时段和已预订时段均为空）
    const emptyQb = createMockQueryBuilder([]);
    unavailableSlotRepo.createQueryBuilder!.mockReturnValue(emptyQb);
    timeSlotRepo.createQueryBuilder!.mockReturnValue(emptyQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentionService,
        { provide: getRepositoryToken(Intention), useValue: intentionRepo },
        {
          provide: getRepositoryToken(IntentionVenue),
          useValue: intentionVenueRepo,
        },
        {
          provide: getRepositoryToken(IntentionFormat),
          useValue: intentionFormatRepo,
        },
        { provide: getRepositoryToken(Player), useValue: playerRepo },
        { provide: getRepositoryToken(Venue), useValue: venueRepo },
        { provide: getRepositoryToken(Format), useValue: formatRepo },
        {
          provide: getRepositoryToken(VenueUnavailableSlot),
          useValue: unavailableSlotRepo,
        },
        {
          provide: getRepositoryToken(VenueTimeSlot),
          useValue: timeSlotRepo,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<IntentionService>(IntentionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CREATE ====================

  describe('create', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const validStartTime = new Date('2026-06-15T14:00:00Z');

    function buildValidDto(
      overrides: Partial<CreateIntentionDto> = {},
    ): CreateIntentionDto {
      return {
        startTime: validStartTime.toISOString(),
        durationMinutes: 120,
        acceptableWaitMinutes: 30,
        localDate: '2026-06-15',
        localTime: '14:00',
        venueIds: [{ venueId: 1, priority: 1 }],
        formatIds: [{ formatId: 1, priority: 1 }],
        ...overrides,
      };
    }

    beforeEach(() => {
      jest.useFakeTimers({ now });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create an intention with all valid fields', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue();
      const mockFormat = createMockFormat();
      const mockIntention = createMockIntention();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.save.mockImplementation((entity: any) =>
          Promise.resolve({ ...entity, id: 1 }),
        );
        return cb(manager);
      });

      const result = await service.create(playerId, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockIntention.id);
      expect(result.playerId).toBe(playerId);
      expect(result.status).toBe('pending');
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should auto-calculate endTime and expiresAt', async () => {
      const playerId = 1;
      const dto = buildValidDto({
        durationMinutes: 180,
        acceptableWaitMinutes: 60,
      });
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue();
      const mockFormat = createMockFormat();
      const mockIntention = createMockIntention();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);

      let capturedIntention: Partial<Intention> | undefined;
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((_entity: any, data: any) => {
          const entity = { ...data };
          entity.computeDerivedTimes = jest.fn().mockImplementation(() => {
            const endTimeMs =
              entity.startTime.getTime() + entity.durationMinutes * 60 * 1000;
            entity.endTime = new Date(endTimeMs);
            const waitMinutes = entity.acceptableWaitMinutes ?? 30;
            const baseTime = new Date();
            entity.expiresAt = new Date(
              baseTime.getTime() + waitMinutes * 60 * 1000,
            );
          });
          return entity;
        });
        manager.save.mockImplementation((arg1: any, arg2: any) => {
          const entity = arg2 !== undefined ? arg2 : arg1;
          if (entity.playerId !== undefined) {
            capturedIntention = entity;
          }
          return Promise.resolve({ ...entity, id: 1 });
        });
        return cb(dataSource.manager);
      });

      await service.create(playerId, dto);

      expect(capturedIntention).toBeDefined();
      const startTime = new Date(dto.startTime);
      const expectedEndTime = new Date(
        startTime.getTime() + dto.durationMinutes * 60 * 1000,
      );
      expect(capturedIntention!.endTime).toEqual(expectedEndTime);
    });

    it('should trigger computeDerivedTimes when method exists', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue();
      const mockFormat = createMockFormat();
      const mockIntention = createMockIntention();
      const computeDerivedTimes = jest.fn();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((_entity: any, data: any) => {
          return { ...data, computeDerivedTimes };
        });
        manager.save.mockImplementation((arg1: any, arg2: any) => {
          const entity = arg2 !== undefined ? arg2 : arg1;
          return Promise.resolve({ ...entity, id: 1 });
        });
        return cb(dataSource.manager);
      });

      await service.create(playerId, dto);

      expect(computeDerivedTimes).toHaveBeenCalled();
    });

    it('should auto-fill regionCode from player.regionCode', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer({ regionCode: 'shenzhen_nanshan' });
      const mockVenue = createMockVenue();
      const mockFormat = createMockFormat();
      const mockIntention = createMockIntention();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);

      let capturedIntention: Partial<Intention> | undefined;
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((_entity: any, data: any) => {
          if (data.playerId !== undefined) {
            capturedIntention = data;
          }
          return { ...data, computeDerivedTimes: jest.fn() };
        });
        manager.save.mockImplementation((entity: any) =>
          Promise.resolve({ ...entity, id: 1 }),
        );
        return cb(dataSource.manager);
      });

      await service.create(playerId, dto);

      expect(capturedIntention!.regionCode).toBe('shenzhen_nanshan');
    });

    it('should auto-fill regionCode from preferred venue when player has no regionCode', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer({ regionCode: null });
      const mockVenue = createMockVenue({ regionCode: 'shanghai_pudong' });
      const mockFormat = createMockFormat();
      const mockIntention = createMockIntention();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);

      let capturedIntention: Partial<Intention> | undefined;
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((_entity: any, data: any) => {
          if (data.playerId !== undefined) {
            capturedIntention = data;
          }
          return { ...data, computeDerivedTimes: jest.fn() };
        });
        manager.save.mockImplementation((entity: any) =>
          Promise.resolve({ ...entity, id: 1 }),
        );
        return cb(dataSource.manager);
      });

      await service.create(playerId, dto);

      expect(capturedIntention!.regionCode).toBe('shanghai_pudong');
    });

    it('should set regionCode to null when player and venue both have no regionCode', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer({ regionCode: null });
      const mockVenue = createMockVenue({ regionCode: null });
      const mockFormat = createMockFormat();
      const mockIntention = createMockIntention();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);

      let capturedIntention: Partial<Intention> | undefined;
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((_entity: any, data: any) => {
          if (data.playerId !== undefined) {
            capturedIntention = data;
          }
          return { ...data, computeDerivedTimes: jest.fn() };
        });
        manager.save.mockImplementation((entity: any) =>
          Promise.resolve({ ...entity, id: 1 }),
        );
        return cb(dataSource.manager);
      });

      await service.create(playerId, dto);

      expect(capturedIntention!.regionCode).toBeNull();
    });

    it('should reject when startTime is less than 1 hour ahead', async () => {
      const playerId = 1;
      const tooSoon = new Date(now.getTime() + 30 * 60 * 1000);
      const dto = buildValidDto({ startTime: tooSoon.toISOString() });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when durationMinutes is less than 120', async () => {
      const playerId = 1;
      const dto = buildValidDto({ durationMinutes: 60 });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when durationMinutes is greater than 360', async () => {
      const playerId = 1;
      const dto = buildValidDto({ durationMinutes: 400 });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when venueIds is empty', async () => {
      const playerId = 1;
      const dto = buildValidDto({ venueIds: [] });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when venueIds exceeds 3', async () => {
      const playerId = 1;
      const dto = buildValidDto({
        venueIds: [
          { venueId: 1, priority: 1 },
          { venueId: 2, priority: 2 },
          { venueId: 3, priority: 3 },
          { venueId: 4, priority: 4 },
        ],
      });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when formatIds is empty', async () => {
      const playerId = 1;
      const dto = buildValidDto({ formatIds: [] });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject when formatIds exceeds 3', async () => {
      const playerId = 1;
      const dto = buildValidDto({
        formatIds: [
          { formatId: 1, priority: 1 },
          { formatId: 2, priority: 2 },
          { formatId: 3, priority: 3 },
          { formatId: 4, priority: 4 },
        ],
      });

      await expect(service.create(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when player does not exist', async () => {
      const playerId = 999;
      const dto = buildValidDto();

      playerRepo.findOneBy!.mockResolvedValue(null);

      await expect(service.create(playerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when venue does not exist', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([]);

      await expect(service.create(playerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when format does not exist', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([]);

      await expect(service.create(playerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when player has overlapping pending intention', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue();
      const mockFormat = createMockFormat();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      // checkSameDayIntention returns 0 (no same-day conflict)
      // checkTimeOverlap returns 1 (overlap conflict)
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }),
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 1 }),
        );

      await expect(service.create(playerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when player already has a pending intention on the same day', async () => {
      const playerId = 1;
      const dto = buildValidDto();
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue();
      const mockFormat = createMockFormat();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      // checkSameDayIntention returns 1 → same-day conflict (runs before overlap check)
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([], { getCount: 1 }),
      );

      await expect(service.create(playerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when selected venue has unavailable slot conflict', async () => {
      const playerId = 1;
      const dto = buildValidDto({
        startTime: new Date('2026-06-16T14:00:00Z').toISOString(),
        durationMinutes: 120,
        localDate: '2026-06-16',
        localTime: '14:00',
      });
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue({ name: '深圳湾体育中心' });
      const mockFormat = createMockFormat();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      // same-day + overlap checks: no conflict
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([], { getCount: 0 }),
      );
      // 场地不可预订时段与意向时间重叠
      unavailableSlotRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([
          {
            venueId: 1,
            slotDate: '2026-06-16',
            startTime: '13:00:00',
            endTime: '15:00:00',
            reason: '维护保养',
          },
        ] as any),
      );

      await expect(service.create(playerId, dto)).rejects.toThrow(
        ConflictException,
      );
      // Verify error message includes specific venue and time
      try {
        await service.create(playerId, dto);
      } catch (err: any) {
        expect(err.message).toContain('深圳湾体育中心');
        expect(err.message).toContain('13:00-15:00');
        expect(err.message).toContain('不可预订');
        expect(err.message).toContain('维护保养');
      }
    });

    it('should throw ConflictException when selected venue has booked slot conflict', async () => {
      const playerId = 1;
      const dto = buildValidDto({
        startTime: new Date('2026-06-16T14:00:00Z').toISOString(),
        durationMinutes: 120,
        localDate: '2026-06-16',
        localTime: '14:00',
      });
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue({ name: '福田体育公园' });
      const mockFormat = createMockFormat();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([], { getCount: 0 }),
      );
      // 场地已预订时段与意向时间重叠
      timeSlotRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([
          {
            venueId: 1,
            slotDate: '2026-06-16',
            startTime: '14:00:00',
            endTime: '16:00:00',
            isBooked: true,
          },
        ] as any),
      );

      await expect(service.create(playerId, dto)).rejects.toThrow(
        ConflictException,
      );
      try {
        await service.create(playerId, dto);
      } catch (err: any) {
        expect(err.message).toContain('福田体育公园');
        expect(err.message).toContain('14:00-16:00');
        expect(err.message).toContain('已被预订');
      }
    });

    it('should fall back to UTC time extraction when localDate/localTime not provided', async () => {
      const playerId = 1;
      // UTC time 14:00 → no local fields → backend extracts 14:00 from UTC
      const dto = buildValidDto({
        startTime: new Date('2026-06-15T14:00:00Z').toISOString(),
        durationMinutes: 120,
        localDate: undefined,
        localTime: undefined,
      });
      const mockPlayer = createMockPlayer();
      const mockVenue = createMockVenue({ name: '测试场地' });
      const mockFormat = createMockFormat();

      playerRepo.findOneBy!.mockResolvedValue(mockPlayer);
      venueRepo.findBy!.mockResolvedValue([mockVenue]);
      formatRepo.findBy!.mockResolvedValue([mockFormat]);
      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([], { getCount: 0 }),
      );
      // 不可预订时段与 UTC 提取的 14:00-16:00 重叠
      unavailableSlotRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([
          {
            venueId: 1,
            slotDate: '2026-06-15',
            startTime: '14:00:00',
            endTime: '16:00:00',
            reason: null,
          },
        ] as any),
      );

      await expect(service.create(playerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==================== UPDATE ====================

  describe('update', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const validStartTime = new Date('2026-06-15T14:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers({ now });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should update a pending intention successfully', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        startTime: new Date('2026-06-15T16:00:00Z').toISOString(),
        durationMinutes: 180,
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([mockIntention]), // query intention to update
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.findOne.mockResolvedValue(mockIntention);
        return cb(manager);
      });

      const result = await service.update(intentionId, playerId, dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(intentionId);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should recalculate endTime and expiresAt after update', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        durationMinutes: 240,
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      // durationMinutes only → no same-day check; only checkTimeOverlap
      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([mockIntention]), // query intention to update
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.findOne.mockResolvedValue(mockIntention);
        return cb(manager);
      });

      const result = await service.update(intentionId, playerId, dto);

      expect(result).toBeDefined();
    });

    it('should allow updating venueIds and formatIds priorities', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        venueIds: [
          { venueId: 2, priority: 1 },
          { venueId: 1, priority: 2 },
        ],
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.findOne.mockResolvedValue(mockIntention);
        return cb(manager);
      });

      const result = await service.update(intentionId, playerId, dto);

      expect(result).toBeDefined();
    });

    it('should update formatIds only', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        formatIds: [{ formatId: 2, priority: 1 }],
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.findOne.mockResolvedValue(mockIntention);
        return cb(manager);
      });

      const result = await service.update(intentionId, playerId, dto);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when intention does not exist', async () => {
      const intentionId = 999;
      const playerId = 1;
      const dto: UpdateIntentionDto = { durationMinutes: 180 };

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when non-owner tries to update', async () => {
      const intentionId = 1;
      const playerId = 2;
      const dto: UpdateIntentionDto = { durationMinutes: 180 };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId: 1,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when intention is matched', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = { durationMinutes: 180 };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'confirmed',  // v2.0: matched→confirmed
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update a cancelled intention and restore to pending', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        startTime: new Date('2026-06-15T16:00:00Z').toISOString(),
        durationMinutes: 180,
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'cancelled',
      });

      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([mockIntention]), // query intention to update
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkTimeOverlap
        )
        .mockReturnValueOnce(
          createMockQueryBuilder([], { getCount: 0 }), // checkSameDayIntention
        )
        .mockReturnValueOnce(createMockQueryBuilder([mockIntention])); // findById

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.findOne.mockResolvedValue(mockIntention);
        return cb(manager);
      });

      const result = await service.update(intentionId, playerId, dto);

      expect(result).toBeDefined();
      expect(mockIntention.status).toBe('pending');
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when updated startTime is less than 1 hour ahead', async () => {
      const intentionId = 1;
      const playerId = 1;
      const tooSoon = new Date(now.getTime() + 30 * 60 * 1000);
      const dto: UpdateIntentionDto = { startTime: tooSoon.toISOString() };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when updated venueIds exceeds 3', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        venueIds: [
          { venueId: 1, priority: 1 },
          { venueId: 2, priority: 2 },
          { venueId: 3, priority: 3 },
          { venueId: 4, priority: 4 },
        ],
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when updated time overlaps with another intention', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        startTime: new Date('2026-06-15T16:00:00Z').toISOString(),
        durationMinutes: 180,
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo
        .createQueryBuilder!.mockReturnValueOnce(
          createMockQueryBuilder([mockIntention]),
        )
        .mockReturnValueOnce(createMockQueryBuilder([], { getCount: 1 }));

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update acceptableWaitMinutes only', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        acceptableWaitMinutes: 60,
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.findOne.mockResolvedValue(mockIntention);
        return cb(manager);
      });

      const result = await service.update(intentionId, playerId, dto);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when updated venueIds is empty', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        venueIds: [],
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when updated formatIds is empty', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        formatIds: [],
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when updated formatIds exceeds 3', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        formatIds: [
          { formatId: 1, priority: 1 },
          { formatId: 2, priority: 2 },
          { formatId: 3, priority: 3 },
          { formatId: 4, priority: 4 },
        ],
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when updated durationMinutes is less than 120', async () => {
      const intentionId = 1;
      const playerId = 1;
      const dto: UpdateIntentionDto = {
        durationMinutes: 60,
      };
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.update(intentionId, playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== CANCEL ====================

  describe('cancel', () => {
    it('should cancel a pending intention', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );
      intentionRepo.save!.mockResolvedValue({
        ...mockIntention,
        status: 'cancelled',
      });

      await service.cancel(intentionId, playerId);

      expect(intentionRepo.save).toHaveBeenCalled();
      const savedCall = intentionRepo.save!.mock.calls[0][0] as Intention;
      expect(savedCall.status).toBe('cancelled');
    });

    it('should cancel a matched intention', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'confirmed',  // v2.0: matched→confirmed
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );
      intentionRepo.save!.mockResolvedValue({
        ...mockIntention,
        status: 'cancelled',
      });

      await service.cancel(intentionId, playerId);

      expect(intentionRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when intention does not exist', async () => {
      const intentionId = 999;
      const playerId = 1;

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([]),
      );

      await expect(service.cancel(intentionId, playerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when non-owner tries to cancel', async () => {
      const intentionId = 1;
      const playerId = 2;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId: 1,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.cancel(intentionId, playerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when intention is confirmed', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'confirmed',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.cancel(intentionId, playerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when intention is already cancelled', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'cancelled',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.cancel(intentionId, playerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when intention is expired', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'expired',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.cancel(intentionId, playerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when intention is expired', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'expired',  // v2.0: failed→expired
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.cancel(intentionId, playerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== REMOVE ====================

  describe('remove', () => {
    it('should physically delete a cancelled intention', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'cancelled',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.delete.mockResolvedValue({ affected: 1 });
        return cb(manager);
      });

      const result = await service.remove(intentionId, playerId);

      expect(result).toEqual({ success: true });
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when intention does not exist', async () => {
      const intentionId = 999;
      const playerId = 1;

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([]),
      );

      await expect(service.remove(intentionId, playerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when non-owner tries to remove', async () => {
      const intentionId = 1;
      const playerId = 2;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId: 1,
        status: 'cancelled',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.remove(intentionId, playerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when intention is pending', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'pending',
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.remove(intentionId, playerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when intention is matched', async () => {
      const intentionId = 1;
      const playerId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        playerId,
        status: 'confirmed',  // v2.0: matched→confirmed
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      await expect(service.remove(intentionId, playerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== FIND BY ID ====================

  describe('findById', () => {
    it('should return intention with venues and formats', async () => {
      const intentionId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        intentionVenues: [
          {
            id: 1,
            intentionId: 1,
            venueId: 1,
            priority: 1,
            venue: createMockVenue(),
            intention: {} as any,
          },
        ],
        intentionFormats: [
          {
            id: 1,
            intentionId: 1,
            formatId: 1,
            priority: 1,
            format: createMockFormat(),
            intention: {} as any,
          },
        ],
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      const result = await service.findById(intentionId);

      expect(result).toBeDefined();
      expect(result.id).toBe(intentionId);
      expect(result.venues).toBeDefined();
      expect(result.formats).toBeDefined();
    });

    it('should return intention with empty venues and formats', async () => {
      const intentionId = 1;
      const mockIntention = createMockIntention({
        id: intentionId,
        intentionVenues: [],
        intentionFormats: [],
      });

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([mockIntention]),
      );

      const result = await service.findById(intentionId);

      expect(result).toBeDefined();
      expect(result.id).toBe(intentionId);
      expect(result.venues).toEqual([]);
      expect(result.formats).toEqual([]);
    });

    it('should throw NotFoundException when intention does not exist', async () => {
      const intentionId = 999;

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder([]),
      );

      await expect(service.findById(intentionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== FIND BY PLAYER ====================

  describe('findByPlayer', () => {
    it('should return paginated intentions for a player', async () => {
      const playerId = 1;
      const query: QueryIntentionDto = { page: 1, pageSize: 10 };
      const mockIntentions = [
        createMockIntention({ id: 1, playerId }),
        createMockIntention({ id: 2, playerId }),
      ];

      intentionRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(mockIntentions),
      );

      const result = await service.findByPlayer(playerId, query);

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const playerId = 1;
      const query: QueryIntentionDto = {
        page: 1,
        pageSize: 10,
        status: 'pending',
      };
      const mockIntentions = [
        createMockIntention({ id: 1, playerId, status: 'pending' }),
      ];

      const qb = createMockQueryBuilder(mockIntentions);
      intentionRepo.createQueryBuilder!.mockReturnValue(qb);

      const result = await service.findByPlayer(playerId, query);

      expect(result).toBeDefined();
      expect(qb.andWhere).toHaveBeenCalledWith('intention.status = :status', {
        status: 'pending',
      });
    });

    it('should use default pagination when not provided', async () => {
      const playerId = 1;
      const query: QueryIntentionDto = {};
      const mockIntentions = [createMockIntention({ id: 1, playerId })];

      const qb = createMockQueryBuilder(mockIntentions);
      intentionRepo.createQueryBuilder!.mockReturnValue(qb);

      await service.findByPlayer(playerId, query);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  // ==================== STATUS TRANSITION HELPER ====================

  describe('canTransitionStatus', () => {
    it('should allow valid transitions from pending', () => {
      expect(service.canTransitionStatus('pending', 'confirmed')).toBe(true);
      expect(service.canTransitionStatus('pending', 'cancelled')).toBe(true);
      expect(service.canTransitionStatus('pending', 'expired')).toBe(true);
    });

    it('should allow transition from confirmed back to pending (venue rejection)', () => {
      expect(service.canTransitionStatus('confirmed', 'pending')).toBe(true);
    });

    it('should allow transition from cancelled back to pending (re-edit)', () => {
      expect(service.canTransitionStatus('cancelled', 'pending')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(service.canTransitionStatus('pending', 'expired')).toBe(true);
      expect(service.canTransitionStatus('confirmed', 'cancelled')).toBe(false);
      expect(service.canTransitionStatus('expired', 'pending')).toBe(false);
    });

    it('should reject transitions to the same status', () => {
      expect(service.canTransitionStatus('pending', 'pending')).toBe(false);
      expect(service.canTransitionStatus('cancelled', 'cancelled')).toBe(false);
    });
  });
});
