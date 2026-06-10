import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UnavailableSlotService } from './unavailable-slot.service';
import { VenueUnavailableSlot } from '../entities/venue-unavailable-slot.entity';
import { Venue } from '../entities/venue.entity';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';

// ==================== Mock Types ====================

type MockRepository<T> = {
  find: jest.Mock;
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  create: jest.Mock;
};

type MockDataSource = {
  transaction: jest.Mock;
};

// ==================== Test Data ====================

function createMockVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 1,
    managerId: 10,
    name: 'Test Court',
    address: 'Test Address',
    pricePerHour: 200,
    courtCount: 2,
    latitude: null,
    longitude: null,
    floorMaterial: null,
    lighting: null,
    courtType: null,
    ventilation: false,
    bigFan: false,
    airCondition: false,
    turnoverTime: 15,
    parking: false,
    restroom: false,
    shower: false,
    lockerRoom: false,
    videoRecord: false,
    ratingAvg: null,
    ratingCount: 0,
    status: 'active',
    regionCode: null,
    openTime: '08:00:00',
    closeTime: '22:00:00',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
    timeSlots: [],
    unavailableSlots: [],
    intentionVenues: Promise.resolve([]),
    manager: {} as any,
    ...overrides,
  };
}

function createMockUnavailableSlot(
  overrides: Partial<VenueUnavailableSlot> = {},
): VenueUnavailableSlot {
  return {
    id: 1,
    venueId: 1,
    slotDate: '2026-06-15',
    startTime: '09:00:00',
    endTime: '11:00:00',
    reason: '维护',
    createdAt: new Date(),
    venue: createMockVenue(),
    ...overrides,
  };
}

function createMockTimeSlot(overrides: Partial<VenueTimeSlot> = {}): VenueTimeSlot {
  return {
    id: 1,
    venueId: 1,
    slotDate: '2026-06-15',
    startTime: '14:00:00',
    endTime: '16:00:00',
    isBooked: true,
    matchId: 100,
    createdAt: new Date(),
    venue: createMockVenue(),
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('UnavailableSlotService', () => {
  let service: UnavailableSlotService;
  let unavailableRepo: MockRepository<VenueUnavailableSlot>;
  let venueRepo: MockRepository<Venue>;
  let timeSlotRepo: MockRepository<VenueTimeSlot>;
  let dataSource: MockDataSource;

  beforeEach(async () => {
    unavailableRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
    };

    venueRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
    };

    timeSlotRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => {
        const manager = {
          create: jest.fn((entity, data) => data),
          save: jest.fn(async (_entity, data) =>
            Array.isArray(data)
              ? data.map((d, i) => ({ id: i + 1, ...d }))
              : { id: 1, ...data },
          ),
        };
        return cb(manager as any);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnavailableSlotService,
        { provide: getRepositoryToken(VenueUnavailableSlot), useValue: unavailableRepo },
        { provide: getRepositoryToken(Venue), useValue: venueRepo },
        { provide: getRepositoryToken(VenueTimeSlot), useValue: timeSlotRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<UnavailableSlotService>(UnavailableSlotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== createUnavailableSlots ====================

  describe('createUnavailableSlots', () => {
    it('should create unavailable slots successfully', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([]);

      const slots = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00', reason: '维护' },
      ];

      const result = await service.createUnavailableSlots(1, 10, slots);

      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBe('09:00');
      expect(result[0].endTime).toBe('11:15'); // 含翻场时间
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should reject non-owner manager', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue({ managerId: 99 }));

      await expect(
        service.createUnavailableSlots(1, 10, [
          { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when venue not found', async () => {
      venueRepo.findOneBy!.mockResolvedValue(null);

      await expect(
        service.createUnavailableSlots(1, 10, [
          { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        ]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject startTime >= endTime', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());

      await expect(
        service.createUnavailableSlots(1, 10, [
          { slotDate: '2026-06-15', startTime: '11:00', endTime: '09:00' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-15-minute granularity', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());

      await expect(
        service.createUnavailableSlots(1, 10, [
          { slotDate: '2026-06-15', startTime: '09:10', endTime: '11:00' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject slots outside business hours', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());

      await expect(
        service.createUnavailableSlots(1, 10, [
          { slotDate: '2026-06-15', startTime: '07:00', endTime: '09:00' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlapping slots with existing', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([
        createMockUnavailableSlot({ startTime: '09:00:00', endTime: '11:00:00' }),
      ]);

      await expect(
        service.createUnavailableSlots(1, 10, [
          { slotDate: '2026-06-15', startTime: '10:00', endTime: '12:00' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should split cross-day slots with turnover time', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue({ turnoverTime: 30, openTime: '00:00:00', closeTime: '24:00:00' }));
      unavailableRepo.find!.mockResolvedValue([]);

      const slots = [
        { slotDate: '2026-06-15', startTime: '23:00', endTime: '23:45' },
      ];

      const result = await service.createUnavailableSlots(1, 10, slots);

      // 23:45 + 30min = 00:15 (跨天)
      // 应创建两条记录
      expect(result).toHaveLength(2);
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  // ==================== getDisplaySlots ====================

  describe('getDisplaySlots', () => {
    it('should return full-day available when no blocked slots', async () => {
      venueRepo.findOne!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([]);
      timeSlotRepo.find!.mockResolvedValue([]);

      const result = await service.getDisplaySlots(1, '2026-06-15');

      // 非营业时间 00:00-08:00 unavailable
      // 营业时间 08:00-22:00 available
      // 非营业时间 22:00-24:00 unavailable
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ startTime: '00:00', endTime: '08:00', status: 'unavailable', reason: '非营业时间' });
      expect(result[1]).toEqual({ startTime: '08:00', endTime: '22:00', status: 'available' });
      expect(result[2]).toEqual({ startTime: '22:00', endTime: '24:00', status: 'unavailable', reason: '非营业时间' });
    });

    it('should merge unavailable and booked slots with correct priority', async () => {
      venueRepo.findOne!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([
        createMockUnavailableSlot({ startTime: '09:00:00', endTime: '11:00:00', reason: '维护' }),
      ]);
      timeSlotRepo.find!.mockResolvedValue([
        createMockTimeSlot({ startTime: '14:00:00', endTime: '16:00:00', isBooked: true }),
      ]);

      const result = await service.getDisplaySlots(1, '2026-06-15');

      // 00:00-08:00 unavailable (非营业时间)
      // 08:00-09:00 available
      // 09:00-11:00 unavailable (维护)
      // 11:00-14:00 available
      // 14:00-16:00 booked
      // 16:00-22:00 available
      // 22:00-24:00 unavailable (非营业时间)
      expect(result).toHaveLength(7);
      expect(result[2]).toEqual({ startTime: '09:00', endTime: '11:00', status: 'unavailable', reason: '维护' });
      expect(result[4]).toEqual({ startTime: '14:00', endTime: '16:00', status: 'booked' });
    });

    it('should give booked priority over unavailable when overlapping', async () => {
      venueRepo.findOne!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([
        createMockUnavailableSlot({ startTime: '10:00:00', endTime: '12:00:00', reason: '维护' }),
      ]);
      timeSlotRepo.find!.mockResolvedValue([
        createMockTimeSlot({ startTime: '09:00:00', endTime: '11:00:00', isBooked: true }),
      ]);

      const result = await service.getDisplaySlots(1, '2026-06-15');

      // 合并后：09:00-12:00 应为 booked（优先级更高）
      const blockedSlot = result.find((s) => s.startTime === '09:00');
      expect(blockedSlot?.status).toBe('booked');
    });

    it('should use cache for repeated calls', async () => {
      venueRepo.findOne!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([]);
      timeSlotRepo.find!.mockResolvedValue([]);

      await service.getDisplaySlots(1, '2026-06-15');
      await service.getDisplaySlots(1, '2026-06-15');

      // 第二次应从缓存读取，不查数据库
      expect(venueRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when venue does not exist', async () => {
      venueRepo.findOne!.mockResolvedValue(null);

      await expect(service.getDisplaySlots(999, '2026-06-15')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== findUnavailableSlots ====================

  describe('findUnavailableSlots', () => {
    it('should return unavailable slots for venue', async () => {
      unavailableRepo.find!.mockResolvedValue([
        createMockUnavailableSlot(),
      ]);

      const result = await service.findUnavailableSlots(1);

      expect(result).toHaveLength(1);
      expect(unavailableRepo.find).toHaveBeenCalledWith({
        where: { venueId: 1 },
        order: { slotDate: 'ASC', startTime: 'ASC' },
      });
    });

    it('should filter by slotDate', async () => {
      unavailableRepo.find!.mockResolvedValue([]);

      await service.findUnavailableSlots(1, '2026-06-15');

      expect(unavailableRepo.find).toHaveBeenCalledWith({
        where: { venueId: 1, slotDate: '2026-06-15' },
        order: { slotDate: 'ASC', startTime: 'ASC' },
      });
    });
  });

  // ==================== deleteUnavailableSlot ====================

  describe('deleteUnavailableSlot', () => {
    it('should delete unavailable slot successfully', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());
      unavailableRepo.findOne!.mockResolvedValue(createMockUnavailableSlot());

      await service.deleteUnavailableSlot(1, 1, 10);

      expect(unavailableRepo.remove).toHaveBeenCalled();
    });

    it('should reject non-owner manager', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue({ managerId: 99 }));

      await expect(service.deleteUnavailableSlot(1, 1, 10)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when slot not found', async () => {
      venueRepo.findOneBy!.mockResolvedValue(createMockVenue());
      unavailableRepo.findOne!.mockResolvedValue(null);

      await expect(service.deleteUnavailableSlot(999, 1, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== Cache ====================

  describe('cache', () => {
    it('should invalidate cache for specific date', async () => {
      venueRepo.findOne!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([]);
      timeSlotRepo.find!.mockResolvedValue([]);

      await service.getDisplaySlots(1, '2026-06-15');
      service.invalidateCache(1, '2026-06-15');
      await service.getDisplaySlots(1, '2026-06-15');

      // 缓存清除后应重新查询
      expect(venueRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should invalidate all cache for venue', async () => {
      venueRepo.findOne!.mockResolvedValue(createMockVenue());
      unavailableRepo.find!.mockResolvedValue([]);
      timeSlotRepo.find!.mockResolvedValue([]);

      await service.getDisplaySlots(1, '2026-06-15');
      await service.getDisplaySlots(1, '2026-06-16');
      service.invalidateAllCacheForVenue(1);
      await service.getDisplaySlots(1, '2026-06-15');
      await service.getDisplaySlots(1, '2026-06-16');

      expect(venueRepo.findOne).toHaveBeenCalledTimes(4);
    });
  });
});
