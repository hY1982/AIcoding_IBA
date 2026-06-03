import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { VenueService } from './venue.service';
import { Venue } from '../entities/venue.entity';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { CreateVenueDto } from '../dto/create-venue.dto';
import { UpdateVenueDto } from '../dto/update-venue.dto';
import { QueryVenueDto } from '../dto/query-venue.dto';
import { CreateTimeSlotDto } from '../dto/create-time-slot.dto';

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
});

const createMockDataSource = () => ({
  transaction: jest.fn(),
  manager: {
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  },
});

// ==================== Test Data Helpers ====================

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
    floorMaterial: 'wood',
    lighting: 'LED',
    courtType: 'indoor',
    ventilation: true,
    bigFan: true,
    airCondition: true,
    turnoverTime: 15,
    parking: true,
    restroom: true,
    shower: true,
    lockerRoom: true,
    videoRecord: false,
    ratingAvg: null,
    ratingCount: 0,
    status: 'active',
    regionCode: 'shenzhen_futian',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 0,
    timeSlots: [],
    intentionVenues: Promise.resolve([]),
    manager: {
      id: 10,
      userId: 100,
      user: {} as any,
      companyName: 'Test Sports Co.',
      contactName: '李四',
      contactPhone: '15000150001',
      venues: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    } as unknown as VenueManager,
    ...overrides,
  } as Venue;
}

function createMockVenueTimeSlot(overrides: Partial<VenueTimeSlot> = {}): VenueTimeSlot {
  return {
    id: 1,
    venueId: 1,
    slotDate: '2026-06-15',
    startTime: '09:00:00',
    endTime: '11:00:00',
    isBooked: false,
    matchId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    venue: createMockVenue(),
    ...overrides,
  } as VenueTimeSlot;
}

function createMockQueryBuilder<T extends object>(items: T[] = []) {
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
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
  return qb as unknown as jest.Mocked<SelectQueryBuilder<T>>;
}

// ==================== Test Suite ====================

describe('VenueService', () => {
  let service: VenueService;
  let venueRepo: MockRepository<Venue>;
  let slotRepo: MockRepository<VenueTimeSlot>;
  let dataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(async () => {
    venueRepo = createMockRepository();
    slotRepo = createMockRepository();
    dataSource = createMockDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenueService,
        {
          provide: getRepositoryToken(Venue),
          useValue: venueRepo,
        },
        {
          provide: getRepositoryToken(VenueTimeSlot),
          useValue: slotRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<VenueService>(VenueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CREATE ====================

  describe('create', () => {
    it('should create a venue with all fields for a venue manager', async () => {
      const managerId = 10;
      const dto: CreateVenueDto = {
        name: 'Test Basketball Court',
        address: '深圳市福田区测试路1号',
        pricePerHour: 200,
        courtCount: 2,
        latitude: 22.5431,
        longitude: 114.0579,
        floorMaterial: 'wood',
        lighting: 'LED',
        courtType: 'indoor',
        ventilation: true,
        bigFan: true,
        airCondition: true,
        turnoverTime: 15,
        parking: true,
        restroom: true,
        shower: true,
        lockerRoom: true,
        videoRecord: false,
        regionCode: 'shenzhen_futian',
      };

      const mockVenue = createMockVenue();

      venueRepo.create!.mockReturnValue(mockVenue);
      venueRepo.save!.mockResolvedValue(mockVenue);

      // Mock findById for return value
      const qb = createMockQueryBuilder([mockVenue]);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.create(managerId, dto);

      expect(venueRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          managerId,
          name: dto.name,
          address: dto.address,
          pricePerHour: dto.pricePerHour,
          courtCount: dto.courtCount,
          latitude: dto.latitude,
          longitude: dto.longitude,
          floorMaterial: dto.floorMaterial,
          lighting: dto.lighting,
          courtType: dto.courtType,
          ventilation: dto.ventilation,
          bigFan: dto.bigFan,
          airCondition: dto.airCondition,
          turnoverTime: dto.turnoverTime,
          parking: dto.parking,
          restroom: dto.restroom,
          shower: dto.shower,
          lockerRoom: dto.lockerRoom,
          videoRecord: dto.videoRecord,
          regionCode: dto.regionCode,
          status: 'active',
        }),
      );
      expect(venueRepo.save).toHaveBeenCalledWith(mockVenue);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should create a venue with minimal fields', async () => {
      const managerId = 10;
      const dto: CreateVenueDto = {
        name: 'Minimal Court',
        address: 'Minimal Address',
        pricePerHour: 150,
      };

      const mockVenue = createMockVenue({
        name: 'Minimal Court',
        address: 'Minimal Address',
        pricePerHour: 150,
        courtCount: 1,
        latitude: null,
        longitude: null,
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
        regionCode: null,
      });

      venueRepo.create!.mockReturnValue(mockVenue);
      venueRepo.save!.mockResolvedValue(mockVenue);

      const qb = createMockQueryBuilder([mockVenue]);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.create(managerId, dto);

      expect(venueRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          managerId,
          name: dto.name,
          address: dto.address,
          pricePerHour: dto.pricePerHour,
          courtCount: 1,
          status: 'active',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should reject pricePerHour <= 0', async () => {
      const managerId = 10;
      const dto: CreateVenueDto = {
        name: 'Bad Court',
        address: 'Bad Address',
        pricePerHour: 0,
      };

      await expect(service.create(managerId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject courtCount < 1', async () => {
      const managerId = 10;
      const dto: CreateVenueDto = {
        name: 'Bad Court',
        address: 'Bad Address',
        pricePerHour: 100,
        courtCount: 0,
      };

      await expect(service.create(managerId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ==================== FIND ALL ====================

  describe('findAll', () => {
    it('should return paginated venue list with default params', async () => {
      const mockVenues = [
        createMockVenue({ id: 1, name: 'Court A' }),
        createMockVenue({ id: 2, name: 'Court B' }),
      ];

      const qb = createMockQueryBuilder(mockVenues);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const query: QueryVenueDto = {};
      const result = await service.findAll(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(2);
      expect(result.list).toHaveLength(2);
      expect(result.list[0].name).toBe('Court A');
    });

    it('should filter by regionCode', async () => {
      const mockVenues = [createMockVenue({ id: 1, regionCode: 'shenzhen_futian' })];

      const qb = createMockQueryBuilder(mockVenues);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const query: QueryVenueDto = { regionCode: 'shenzhen_futian' };
      await service.findAll(query);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'venue.regionCode = :regionCode',
        { regionCode: 'shenzhen_futian' },
      );
    });

    it('should filter by status', async () => {
      const mockVenues = [createMockVenue({ id: 1, status: 'active' })];

      const qb = createMockQueryBuilder(mockVenues);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const query: QueryVenueDto = { status: 'active' };
      await service.findAll(query);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'venue.status = :status',
        { status: 'active' },
      );
    });

    it('should apply custom pagination', async () => {
      const mockVenues = [createMockVenue({ id: 3, name: 'Court C' })];

      const qb = createMockQueryBuilder(mockVenues);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const query: QueryVenueDto = { page: 2, pageSize: 5 };
      const result = await service.findAll(query);

      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });
  });

  // ==================== FIND BY ID ====================

  describe('findById', () => {
    it('should return venue detail with time slots', async () => {
      const mockVenue = createMockVenue({
        id: 1,
        timeSlots: [
          createMockVenueTimeSlot({ id: 1, venueId: 1 }),
          createMockVenueTimeSlot({ id: 2, venueId: 1 }),
        ],
      });

      const qb = createMockQueryBuilder([mockVenue]);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.findById(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect((result as any).timeSlots).toHaveLength(2);
    });

    it('should throw NotFoundException for non-existent venue', async () => {
      const qb = createMockQueryBuilder([]);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== UPDATE ====================

  describe('update', () => {
    it('should allow owner manager to update venue', async () => {
      const venueId = 1;
      const managerId = 10;
      const dto: UpdateVenueDto = {
        name: 'Updated Court Name',
        pricePerHour: 250,
      };

      const existingVenue = createMockVenue({ id: venueId, managerId });
      const updatedVenue = createMockVenue({
        id: venueId,
        managerId,
        name: 'Updated Court Name',
        pricePerHour: 250,
      });

      venueRepo.findOneBy!.mockResolvedValue(existingVenue);
      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb({
          createQueryBuilder: () => ({
            update: () => ({
              set: () => ({
                where: () => ({
                  andWhere: () => ({
                    execute: jest.fn().mockResolvedValue({ affected: 1 }),
                  }),
                }),
              }),
            }),
          }),
        });
      });

      const qb = createMockQueryBuilder([updatedVenue]);
      venueRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.update(venueId, managerId, dto);

      expect(result.name).toBe('Updated Court Name');
      expect(result.pricePerHour).toBe(250);
    });

    it('should throw ForbiddenException when non-owner tries to update', async () => {
      const venueId = 1;
      const ownerManagerId = 10;
      const otherManagerId = 20;
      const dto: UpdateVenueDto = { name: 'Hacked Name' };

      const existingVenue = createMockVenue({ id: venueId, managerId: ownerManagerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      await expect(service.update(venueId, otherManagerId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when venue does not exist', async () => {
      venueRepo.findOneBy!.mockResolvedValue(null);

      await expect(service.update(999, 10, { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject pricePerHour <= 0 on update', async () => {
      const venueId = 1;
      const managerId = 10;
      const dto: UpdateVenueDto = {
        pricePerHour: 0,
      };

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      await expect(service.update(venueId, managerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject courtCount < 1 on update', async () => {
      const venueId = 1;
      const managerId = 10;
      const dto: UpdateVenueDto = {
        courtCount: 0,
      };

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      await expect(service.update(venueId, managerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when update affects 0 rows (concurrent modification)', async () => {
      const venueId = 1;
      const managerId = 10;
      const dto: UpdateVenueDto = { name: 'Updated Name' };

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb({
          createQueryBuilder: () => ({
            update: () => ({
              set: () => ({
                where: () => ({
                  andWhere: () => ({
                    execute: jest.fn().mockResolvedValue({ affected: 0 }),
                  }),
                }),
              }),
            }),
          }),
        });
      });

      await expect(service.update(venueId, managerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==================== REMOVE ====================

  describe('remove', () => {
    it('should allow owner manager to delete venue', async () => {
      const venueId = 1;
      const managerId = 10;

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);
      venueRepo.remove!.mockResolvedValue(existingVenue);

      await service.remove(venueId, managerId);

      expect(venueRepo.remove).toHaveBeenCalledWith(existingVenue);
    });

    it('should throw ForbiddenException when non-owner tries to delete', async () => {
      const venueId = 1;
      const ownerManagerId = 10;
      const otherManagerId = 20;

      const existingVenue = createMockVenue({ id: venueId, managerId: ownerManagerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      await expect(service.remove(venueId, otherManagerId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when venue does not exist', async () => {
      venueRepo.findOneBy!.mockResolvedValue(null);

      await expect(service.remove(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== TIME SLOTS ====================

  describe('createTimeSlots', () => {
    it('should allow owner manager to create time slots', async () => {
      const venueId = 1;
      const managerId = 10;
      const dtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        { slotDate: '2026-06-15', startTime: '14:00', endTime: '16:00' },
      ];

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      const mockSlots = dtos.map((dto, i) =>
        createMockVenueTimeSlot({
          id: i + 1,
          venueId,
          slotDate: dto.slotDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
        }),
      );

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          create: jest.fn().mockImplementation((_entity, data) => data),
          save: jest.fn().mockResolvedValue(mockSlots),
        };
        return cb(manager);
      });

      const result = await service.createTimeSlots(venueId, managerId, dtos);

      expect(result).toHaveLength(2);
      expect(result[0].slotDate).toBe('2026-06-15');
      expect(result[0].startTime).toBe('09:00');
    });

    it('should throw ForbiddenException when non-owner creates time slots', async () => {
      const venueId = 1;
      const ownerManagerId = 10;
      const otherManagerId = 20;
      const dtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
      ];

      const existingVenue = createMockVenue({ id: venueId, managerId: ownerManagerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      await expect(
        service.createTimeSlots(venueId, otherManagerId, dtos),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when venue does not exist', async () => {
      venueRepo.findOneBy!.mockResolvedValue(null);

      await expect(
        service.createTimeSlots(999, 10, [
          { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findTimeSlots', () => {
    it('should return all time slots for a venue', async () => {
      const venueId = 1;
      const mockSlots = [
        createMockVenueTimeSlot({ id: 1, venueId, slotDate: '2026-06-15' }),
        createMockVenueTimeSlot({ id: 2, venueId, slotDate: '2026-06-16' }),
      ];

      slotRepo.find!.mockResolvedValue(mockSlots);

      const result = await service.findTimeSlots(venueId);

      expect(slotRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { venueId },
          order: { slotDate: 'ASC', startTime: 'ASC' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should filter time slots by date', async () => {
      const venueId = 1;
      const slotDate = '2026-06-15';
      const mockSlots = [
        createMockVenueTimeSlot({ id: 1, venueId, slotDate }),
      ];

      slotRepo.find!.mockResolvedValue(mockSlots);

      const result = await service.findTimeSlots(venueId, slotDate);

      expect(slotRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { venueId, slotDate },
          order: { slotDate: 'ASC', startTime: 'ASC' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // ==================== TIME SLOT OVERLAP VALIDATION ====================

  describe('createTimeSlots overlap validation', () => {
    it('should reject overlapping time slots on same date', async () => {
      const venueId = 1;
      const managerId = 10;
      const dtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        { slotDate: '2026-06-15', startTime: '10:00', endTime: '12:00' }, // 重叠
      ];

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      await expect(
        service.createTimeSlots(venueId, managerId, dtos),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow adjacent but non-overlapping time slots', async () => {
      const venueId = 1;
      const managerId = 10;
      const dtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        { slotDate: '2026-06-15', startTime: '11:00', endTime: '13:00' }, // 相邻但不重叠
      ];

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          create: jest.fn().mockImplementation((_entity, data) => data),
          save: jest.fn().mockResolvedValue(dtos.map((dto, i) =>
            createMockVenueTimeSlot({ id: i + 1, venueId, ...dto }),
          )),
        };
        return cb(manager);
      });

      const result = await service.createTimeSlots(venueId, managerId, dtos);

      expect(result).toHaveLength(2);
    });

    it('should allow same time on different dates', async () => {
      const venueId = 1;
      const managerId = 10;
      const dtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        { slotDate: '2026-06-16', startTime: '09:00', endTime: '11:00' },
      ];

      const existingVenue = createMockVenue({ id: venueId, managerId });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = {
          create: jest.fn().mockImplementation((_entity, data) => data),
          save: jest.fn().mockResolvedValue(dtos.map((dto, i) =>
            createMockVenueTimeSlot({ id: i + 1, venueId, ...dto }),
          )),
        };
        return cb(manager);
      });

      const result = await service.createTimeSlots(venueId, managerId, dtos);

      expect(result).toHaveLength(2);
    });
  });

  // ==================== OPTIMISTIC LOCK ====================

  describe('update optimistic lock', () => {
    it('should throw ConflictException when version mismatch', async () => {
      const venueId = 1;
      const managerId = 10;
      const dto: UpdateVenueDto = { name: 'Updated Name' };

      const existingVenue = createMockVenue({ id: venueId, managerId, version: 1 });
      venueRepo.findOneBy!.mockResolvedValue(existingVenue);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        return cb({
          createQueryBuilder: () => ({
            update: () => ({
              set: () => ({
                where: () => ({
                  andWhere: () => ({
                    execute: jest.fn().mockResolvedValue({ affected: 0 }),
                  }),
                }),
              }),
            }),
          }),
        });
      });

      await expect(service.update(venueId, managerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
