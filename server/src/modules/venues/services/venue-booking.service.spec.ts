import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VenueBookingService } from './venue-booking.service';
import { VenueTimeSlot } from '../entities/venue-time-slot.entity';
import { VenueUnavailableSlot } from '../entities/venue-unavailable-slot.entity';

// ==================== Mock Types ====================

type MockRepository<T extends object = object> = Partial<
  Record<keyof import('typeorm').Repository<T>, jest.Mock>
>;

const createMockRepository = <T extends object>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createMockQueryBuilder = <T extends object>(items: T[] = []) => {
  const qb = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(items),
    getOne: jest.fn().mockResolvedValue(items[0] ?? null),
  };
  return qb as unknown as jest.Mocked<
    import('typeorm').SelectQueryBuilder<T>
  >;
};

// ==================== Test Suite ====================

describe('VenueBookingService', () => {
  let service: VenueBookingService;
  let slotRepo: MockRepository<VenueTimeSlot>;
  let unavailableSlotRepo: MockRepository<VenueUnavailableSlot>;

  beforeEach(async () => {
    slotRepo = createMockRepository();
    unavailableSlotRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenueBookingService,
        { provide: getRepositoryToken(VenueTimeSlot), useValue: slotRepo },
        {
          provide: getRepositoryToken(VenueUnavailableSlot),
          useValue: unavailableSlotRepo,
        },
      ],
    }).compile();

    service = module.get<VenueBookingService>(VenueBookingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== BOOK SLOT ====================

  describe('bookSlot', () => {
    const venueId = 1;
    const slotDate = '2026-06-15';
    const startTime = '14:00:00';
    const endTime = '16:00:00';
    const matchId = 10;

    it('should successfully book a slot when no conflicts exist', async () => {
      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([])),
        create: jest.fn().mockImplementation((_, data) => ({ id: 1, ...data })),
        save: jest.fn().mockResolvedValue({ id: 1 }),
      };

      const result = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        matchId,
      );

      expect(result).toBe(true);
      expect(mockManager.create).toHaveBeenCalledWith(VenueTimeSlot, {
        venueId,
        slotDate,
        startTime,
        endTime,
        isBooked: true,
        matchId,
      });
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should reject booking when a booked slot overlaps', async () => {
      const existingSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '15:00:00',
        endTime: '17:00:00',
        isBooked: true,
        matchId: 99, // different match
      };

      const mockManager = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(createMockQueryBuilder([existingSlot as any])) // booked slots
          .mockReturnValueOnce(createMockQueryBuilder([])), // unavailable slots (should not reach)
        create: jest.fn(),
        save: jest.fn(),
      };

      const result = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        matchId,
      );

      expect(result).toBe(false);
      expect(mockManager.create).not.toHaveBeenCalled();
    });

    it('should allow re-booking for the same matchId', async () => {
      const existingSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '14:00:00',
        endTime: '16:00:00',
        isBooked: true,
        matchId: matchId, // same match
      };

      const mockManager = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(createMockQueryBuilder([existingSlot as any]))
          .mockReturnValueOnce(createMockQueryBuilder([])),
        create: jest.fn().mockImplementation((_, data) => ({ id: 1, ...data })),
        save: jest.fn().mockResolvedValue({ id: 1 }),
      };

      const result = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        matchId,
      );

      expect(result).toBe(true);
    });

    it('should reject booking when an unavailable slot overlaps', async () => {
      const unavailableSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '13:00:00',
        endTime: '15:00:00',
      };

      const mockManager = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(createMockQueryBuilder([])) // booked slots
          .mockReturnValueOnce(
            createMockQueryBuilder([unavailableSlot as any]),
          ), // unavailable slots
        create: jest.fn(),
        save: jest.fn(),
      };

      const result = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        matchId,
      );

      expect(result).toBe(false);
    });

    it('should allow booking when slots are adjacent (no overlap)', async () => {
      // Existing slot ends exactly when new one starts
      const adjacentSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '12:00:00',
        endTime: '14:00:00', // ends when new starts
        isBooked: true,
        matchId: 99,
      };

      const mockManager = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(createMockQueryBuilder([adjacentSlot as any]))
          .mockReturnValueOnce(createMockQueryBuilder([])),
        create: jest.fn().mockImplementation((_, data) => ({ id: 1, ...data })),
        save: jest.fn().mockResolvedValue({ id: 1 }),
      };

      const result = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        matchId,
      );

      expect(result).toBe(true);
    });
  });

  // ==================== RELEASE SLOT ====================

  describe('releaseSlot', () => {
    it('should delete booked slot by matchId', async () => {
      const mockManager = {
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      await service.releaseSlot(mockManager as any, 10);

      expect(mockManager.delete).toHaveBeenCalledWith(VenueTimeSlot, {
        matchId: 10,
      });
    });

    it('should not throw when no slot exists for matchId (idempotent)', async () => {
      const mockManager = {
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      await expect(
        service.releaseSlot(mockManager as any, 999),
      ).resolves.toBeUndefined();
    });
  });

  // ==================== CHECK AVAILABILITY ====================

  describe('checkAvailability', () => {
    const venueId = 1;
    const slotDate = '2026-06-15';
    const startTime = '14:00:00';
    const endTime = '16:00:00';

    it('should return true when no conflicts exist', async () => {
      slotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(createMockQueryBuilder([])) as any;
      unavailableSlotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(createMockQueryBuilder([])) as any;

      const result = await service.checkAvailability(
        venueId,
        slotDate,
        startTime,
        endTime,
      );

      expect(result).toBe(true);
    });

    it('should return false when a booked slot overlaps', async () => {
      const bookedSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '15:00:00',
        endTime: '17:00:00',
        isBooked: true,
        matchId: 99,
      };

      slotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(
          createMockQueryBuilder([bookedSlot as any]),
        ) as any;

      const result = await service.checkAvailability(
        venueId,
        slotDate,
        startTime,
        endTime,
      );

      expect(result).toBe(false);
    });

    it('should return false when an unavailable slot overlaps', async () => {
      const unavailableSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '13:00:00',
        endTime: '15:00:00',
      };

      slotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(createMockQueryBuilder([])) as any;
      unavailableSlotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(
          createMockQueryBuilder([unavailableSlot as any]),
        ) as any;

      const result = await service.checkAvailability(
        venueId,
        slotDate,
        startTime,
        endTime,
      );

      expect(result).toBe(false);
    });

    it('should return true when slots are exactly adjacent (no overlap)', async () => {
      const adjacentSlot = {
        id: 1,
        venueId,
        slotDate,
        startTime: '16:00:00', // starts when query ends
        endTime: '18:00:00',
        isBooked: true,
        matchId: 99,
      };

      slotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(
          createMockQueryBuilder([adjacentSlot as any]),
        ) as any;
      unavailableSlotRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(createMockQueryBuilder([])) as any;

      const result = await service.checkAvailability(
        venueId,
        slotDate,
        startTime,
        endTime,
      );

      expect(result).toBe(true);
    });
  });

  // ==================== CONCURRENCY ====================

  describe('concurrency', () => {
    it('should handle concurrent booking attempts (only one succeeds)', async () => {
      const venueId = 1;
      const slotDate = '2026-06-15';
      const startTime = '14:00:00';
      const endTime = '16:00:00';

      // Simulate two matches competing for the same slot
      // First call: no conflicts (succeeds)
      // Second call: conflict with first (fails)
      const slotAfterFirstBooking = {
        id: 1,
        venueId,
        slotDate,
        startTime,
        endTime,
        isBooked: true,
        matchId: 10,
      };

      let callCount = 0;
      const mockManager = {
        createQueryBuilder: jest.fn().mockImplementation(() => {
          callCount++;
          // First pair of calls (booked + unavailable): empty (first booking)
          // Second pair: has the first booking (second booking attempt)
          if (callCount <= 2) {
            return createMockQueryBuilder([]);
          }
          return createMockQueryBuilder([slotAfterFirstBooking as any]);
        }),
        create: jest.fn().mockImplementation((_, data) => ({ id: 1, ...data })),
        save: jest.fn().mockResolvedValue({ id: 1 }),
      };

      const result1 = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        10,
      );
      const result2 = await service.bookSlot(
        mockManager as any,
        venueId,
        slotDate,
        startTime,
        endTime,
        20,
      );

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });
});
