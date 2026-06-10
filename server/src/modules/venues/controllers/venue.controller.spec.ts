import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { VenueController } from './venue.controller';
import { VenueService } from '../services/venue.service';
import { UnavailableSlotService } from '../services/unavailable-slot.service';
import { VenueManagerProfileService } from '../services/venue-manager-profile.service';
import { CreateVenueDto } from '../dto/create-venue.dto';
import { UpdateVenueDto } from '../dto/update-venue.dto';
import { QueryVenueDto } from '../dto/query-venue.dto';
import { CreateTimeSlotDto } from '../dto/create-time-slot.dto';
import { CreateTimeSlotsDto } from '../dto/create-time-slots.dto';
import { VenueDetail, VenueListItem, VenueTimeSlot } from '@shared/venue';
import { PaginatedResponse } from '@shared/common';
import { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';

// ==================== Mock Types ====================

type MockVenueService = Partial<Record<keyof VenueService, jest.Mock>>;

type MockUnavailableSlotService = Partial<
  Record<keyof UnavailableSlotService, jest.Mock>
>;

type MockVenueManagerProfileService = Partial<
  Record<keyof VenueManagerProfileService, jest.Mock>
>;

// ==================== Test Data Helpers ====================

const venueManagerUser: AuthenticatedUser = {
  userId: 100,
  phone: '13800138000',
  userType: 'venue_manager',
};

const playerUser: AuthenticatedUser = {
  userId: 200,
  phone: '13900139000',
  userType: 'player',
};

const managerProfile = { id: 10, userId: 100, companyName: 'Test Co.' };

function createMockVenueDetail(overrides: Partial<VenueDetail> = {}): VenueDetail {
  return {
    id: 1,
    managerId: 10,
    name: 'Test Basketball Court',
    address: '深圳市福田区测试路1号',
    pricePerHour: 200,
    courtCount: 2,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockVenueListItem(overrides: Partial<VenueListItem> = {}): VenueListItem {
  return {
    id: 1,
    name: 'Test Basketball Court',
    address: '深圳市福田区测试路1号',
    pricePerHour: 200,
    courtCount: 2,
    status: 'active',
    ratingCount: 0,
    ...overrides,
  };
}

function createMockVenueTimeSlot(overrides: Partial<VenueTimeSlot> = {}): VenueTimeSlot {
  return {
    id: 1,
    venueId: 1,
    slotDate: '2026-06-15',
    startTime: '09:00',
    endTime: '11:00',
    isBooked: false,
    ...overrides,
  };
}

function createMockRequest(user: AuthenticatedUser): any {
  return { user };
}

// ==================== Test Suite ====================

describe('VenueController', () => {
  let controller: VenueController;
  let venueService: MockVenueService;
  let unavailableSlotService: MockUnavailableSlotService;
  let venueManagerProfileService: MockVenueManagerProfileService;

  beforeEach(async () => {
    venueService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByManagerId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findTimeSlots: jest.fn(),
      createTimeSlots: jest.fn(),
    };

    unavailableSlotService = {
      getDisplaySlots: jest.fn(),
      createUnavailableSlots: jest.fn(),
      findUnavailableSlots: jest.fn(),
      deleteUnavailableSlot: jest.fn(),
      invalidateCache: jest.fn(),
      invalidateAllCacheForVenue: jest.fn(),
    };

    venueManagerProfileService = {
      findByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueController],
      providers: [
        { provide: VenueService, useValue: venueService },
        { provide: UnavailableSlotService, useValue: unavailableSlotService },
        { provide: VenueManagerProfileService, useValue: venueManagerProfileService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VenueController>(VenueController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==================== POST /venues ====================

  describe('create', () => {
    it('should create venue for venue_manager user', async () => {
      const dto: CreateVenueDto = {
        name: 'Test Court',
        address: 'Test Address',
        pricePerHour: 200,
      };
      const mockVenue = createMockVenueDetail();

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.create!.mockResolvedValue(mockVenue);

      const req = createMockRequest(venueManagerUser);
      const result = await controller.create(req, dto);

      expect(venueManagerProfileService.findByUserId).toHaveBeenCalledWith(100);
      expect(venueService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(mockVenue);
    });

    it('should reject player user with 403 Forbidden', async () => {
      const dto: CreateVenueDto = {
        name: 'Test Court',
        address: 'Test Address',
        pricePerHour: 200,
      };

      const req = createMockRequest(playerUser);

      await expect(controller.create(req, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(venueManagerProfileService.findByUserId).not.toHaveBeenCalled();
      expect(venueService.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when venue manager profile does not exist', async () => {
      const dto: CreateVenueDto = {
        name: 'Test Court',
        address: 'Test Address',
        pricePerHour: 200,
      };

      venueManagerProfileService.findByUserId!.mockResolvedValue(null);

      const req = createMockRequest(venueManagerUser);

      await expect(controller.create(req, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(venueService.create).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      const dto: CreateVenueDto = {
        name: 'Test Court',
        address: 'Test Address',
        pricePerHour: 200,
      };

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.create!.mockRejectedValue(new BadRequestException('Invalid data'));

      const req = createMockRequest(venueManagerUser);

      await expect(controller.create(req, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== GET /venues ====================

  describe('findAll', () => {
    it('should return paginated venue list with default params', async () => {
      const mockResponse: PaginatedResponse<VenueListItem> = {
        page: 1,
        pageSize: 10,
        total: 2,
        list: [
          createMockVenueListItem({ id: 1, name: 'Court A' }),
          createMockVenueListItem({ id: 2, name: 'Court B' }),
        ],
      };

      venueService.findAll!.mockResolvedValue(mockResponse);

      const result = await controller.findAll({});

      expect(venueService.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResponse);
    });

    it('should pass query params to service', async () => {
      const query: QueryVenueDto = {
        page: 2,
        pageSize: 5,
        regionCode: 'shenzhen_futian',
        status: 'active',
      };
      const mockResponse: PaginatedResponse<VenueListItem> = {
        page: 2,
        pageSize: 5,
        total: 0,
        list: [],
      };

      venueService.findAll!.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query);

      expect(venueService.findAll).toHaveBeenCalledWith(query);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });

    it('should return empty list when no venues', async () => {
      const mockResponse: PaginatedResponse<VenueListItem> = {
        page: 1,
        pageSize: 10,
        total: 0,
        list: [],
      };

      venueService.findAll!.mockResolvedValue(mockResponse);

      const result = await controller.findAll({});

      expect(result.list).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ==================== GET /venues/my ====================

  describe('findMyVenues', () => {
    it('should return venues for current venue manager', async () => {
      const mockVenues: VenueListItem[] = [
        createMockVenueListItem({ id: 1, name: 'Court A' }),
        createMockVenueListItem({ id: 2, name: 'Court B' }),
      ];

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.findByManagerId!.mockResolvedValue(mockVenues);

      const req = createMockRequest(venueManagerUser);
      const result = await controller.findMyVenues(req);

      expect(venueManagerProfileService.findByUserId).toHaveBeenCalledWith(100);
      expect(venueService.findByManagerId).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockVenues);
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when venue manager profile does not exist', async () => {
      venueManagerProfileService.findByUserId!.mockResolvedValue(null);

      const req = createMockRequest(venueManagerUser);

      await expect(controller.findMyVenues(req)).rejects.toThrow(
        NotFoundException,
      );
      expect(venueService.findByManagerId).not.toHaveBeenCalled();
    });

    it('should return empty array when manager has no venues', async () => {
      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.findByManagerId!.mockResolvedValue([]);

      const req = createMockRequest(venueManagerUser);
      const result = await controller.findMyVenues(req);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // ==================== GET /venues/:id ====================

  describe('findById', () => {
    it('should return venue detail by id', async () => {
      const mockVenue = createMockVenueDetail({ id: 1 });

      venueService.findById!.mockResolvedValue(mockVenue);

      const result = await controller.findById(1);

      expect(venueService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockVenue);
    });

    it('should propagate NotFoundException from service', async () => {
      venueService.findById!.mockRejectedValue(
        new NotFoundException('场地不存在'),
      );

      await expect(controller.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== PUT /venues/:id ====================

  describe('update', () => {
    it('should update venue for owner venue_manager', async () => {
      const dto: UpdateVenueDto = { name: 'Updated Court' };
      const mockVenue = createMockVenueDetail({ id: 1, name: 'Updated Court' });

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.update!.mockResolvedValue(mockVenue);

      const req = createMockRequest(venueManagerUser);
      const result = await controller.update(req, 1, dto);

      expect(venueManagerProfileService.findByUserId).toHaveBeenCalledWith(100);
      expect(venueService.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual(mockVenue);
    });

    it('should reject player user with 403 Forbidden', async () => {
      const dto: UpdateVenueDto = { name: 'Hacked Court' };

      const req = createMockRequest(playerUser);

      await expect(controller.update(req, 1, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(venueManagerProfileService.findByUserId).not.toHaveBeenCalled();
      expect(venueService.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when venue manager profile does not exist', async () => {
      const dto: UpdateVenueDto = { name: 'Updated Court' };

      venueManagerProfileService.findByUserId!.mockResolvedValue(null);

      const req = createMockRequest(venueManagerUser);

      await expect(controller.update(req, 1, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(venueService.update).not.toHaveBeenCalled();
    });

    it('should propagate ForbiddenException from service', async () => {
      const dto: UpdateVenueDto = { name: 'Updated Court' };

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.update!.mockRejectedValue(
        new ForbiddenException('无权操作该场地'),
      );

      const req = createMockRequest(venueManagerUser);

      await expect(controller.update(req, 1, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should propagate NotFoundException from service', async () => {
      const dto: UpdateVenueDto = { name: 'Updated Court' };

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.update!.mockRejectedValue(
        new NotFoundException('场地不存在'),
      );

      const req = createMockRequest(venueManagerUser);

      await expect(controller.update(req, 999, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== DELETE /venues/:id ====================

  describe('remove', () => {
    it('should delete venue for owner venue_manager', async () => {
      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.remove!.mockResolvedValue(undefined);

      const req = createMockRequest(venueManagerUser);
      await controller.remove(req, 1);

      expect(venueManagerProfileService.findByUserId).toHaveBeenCalledWith(100);
      expect(venueService.remove).toHaveBeenCalledWith(1, 10);
    });

    it('should reject player user with 403 Forbidden', async () => {
      const req = createMockRequest(playerUser);

      await expect(controller.remove(req, 1)).rejects.toThrow(
        ForbiddenException,
      );
      expect(venueManagerProfileService.findByUserId).not.toHaveBeenCalled();
      expect(venueService.remove).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when venue manager profile does not exist', async () => {
      venueManagerProfileService.findByUserId!.mockResolvedValue(null);

      const req = createMockRequest(venueManagerUser);

      await expect(controller.remove(req, 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(venueService.remove).not.toHaveBeenCalled();
    });

    it('should propagate ForbiddenException from service', async () => {
      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.remove!.mockRejectedValue(
        new ForbiddenException('无权操作该场地'),
      );

      const req = createMockRequest(venueManagerUser);

      await expect(controller.remove(req, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==================== GET /venues/:id/slots ====================

  describe('findTimeSlots', () => {
    it('should return display slots for venue', async () => {
      const mockSlots = [
        { startTime: '08:00', endTime: '22:00', status: 'available' as const },
      ];

      unavailableSlotService.getDisplaySlots!.mockResolvedValue(mockSlots);

      const result = await controller.findTimeSlots(1, '2026-06-15');

      expect(unavailableSlotService.getDisplaySlots).toHaveBeenCalledWith(1, '2026-06-15');
      expect(result).toEqual(mockSlots);
      expect(result).toHaveLength(1);
    });

    it('should reject invalid slotDate format', async () => {
      await expect(controller.findTimeSlots(1, '06-15-2026')).rejects.toThrow(
        BadRequestException,
      );
      expect(unavailableSlotService.getDisplaySlots).not.toHaveBeenCalled();
    });

    it('should reject invalid slotDate (non-existent date)', async () => {
      await expect(controller.findTimeSlots(1, '2026-02-30')).rejects.toThrow(
        BadRequestException,
      );
      expect(unavailableSlotService.getDisplaySlots).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when venue does not exist', async () => {
      unavailableSlotService.getDisplaySlots!.mockRejectedValue(
        new NotFoundException('场地不存在'),
      );

      await expect(controller.findTimeSlots(999, '2026-06-15')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject missing slotDate', async () => {
      await expect(controller.findTimeSlots(1, '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== POST /venues/:id/slots ====================

  describe('createTimeSlots', () => {
    it('should create time slots for owner venue_manager', async () => {
      const slotDtos: CreateTimeSlotDto[] = [
        { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
        { slotDate: '2026-06-15', startTime: '14:00', endTime: '16:00' },
      ];
      const dto: CreateTimeSlotsDto = { slots: slotDtos };
      const mockSlots: VenueTimeSlot[] = [
        createMockVenueTimeSlot({ id: 1, venueId: 1, ...slotDtos[0] }),
        createMockVenueTimeSlot({ id: 2, venueId: 1, ...slotDtos[1] }),
      ];

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.findById!.mockResolvedValue(createMockVenueDetail({ id: 1 }));
      venueService.createTimeSlots!.mockResolvedValue(mockSlots);

      const req = createMockRequest(venueManagerUser);
      const result = await controller.createTimeSlots(req, 1, dto);

      expect(venueManagerProfileService.findByUserId).toHaveBeenCalledWith(100);
      expect(venueService.findById).toHaveBeenCalledWith(1);
      expect(venueService.createTimeSlots).toHaveBeenCalledWith(1, 10, slotDtos);
      expect(result).toEqual(mockSlots);
    });

    it('should reject player user with 403 Forbidden', async () => {
      const dto: CreateTimeSlotsDto = {
        slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
      };

      const req = createMockRequest(playerUser);

      await expect(controller.createTimeSlots(req, 1, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(venueManagerProfileService.findByUserId).not.toHaveBeenCalled();
      expect(venueService.findById).not.toHaveBeenCalled();
      expect(venueService.createTimeSlots).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when venue manager profile does not exist', async () => {
      const dto: CreateTimeSlotsDto = {
        slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
      };

      venueManagerProfileService.findByUserId!.mockResolvedValue(null);

      const req = createMockRequest(venueManagerUser);

      await expect(controller.createTimeSlots(req, 1, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(venueService.findById).not.toHaveBeenCalled();
      expect(venueService.createTimeSlots).not.toHaveBeenCalled();
    });

    it('should propagate ForbiddenException from service', async () => {
      const dto: CreateTimeSlotsDto = {
        slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
      };

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.findById!.mockResolvedValue(createMockVenueDetail({ id: 1 }));
      venueService.createTimeSlots!.mockRejectedValue(
        new ForbiddenException('无权操作该场地'),
      );

      const req = createMockRequest(venueManagerUser);

      await expect(controller.createTimeSlots(req, 1, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should propagate BadRequestException for overlapping slots', async () => {
      const dto: CreateTimeSlotsDto = {
        slots: [
          { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
          { slotDate: '2026-06-15', startTime: '10:00', endTime: '12:00' },
        ],
      };

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.findById!.mockResolvedValue(createMockVenueDetail({ id: 1 }));
      venueService.createTimeSlots!.mockRejectedValue(
        new BadRequestException('时段重叠'),
      );

      const req = createMockRequest(venueManagerUser);

      await expect(controller.createTimeSlots(req, 1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate NotFoundException when venue does not exist', async () => {
      const dto: CreateTimeSlotsDto = {
        slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
      };

      venueManagerProfileService.findByUserId!.mockResolvedValue(managerProfile);
      venueService.findById!.mockRejectedValue(
        new NotFoundException('场地不存在'),
      );

      const req = createMockRequest(venueManagerUser);

      await expect(controller.createTimeSlots(req, 999, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(venueService.createTimeSlots).not.toHaveBeenCalled();
    });
  });
});
