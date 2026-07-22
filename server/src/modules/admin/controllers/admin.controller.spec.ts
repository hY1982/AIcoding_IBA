import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  const mockAdminService = {
    findPlayers: jest.fn(),
    findVenues: jest.fn(),
    findMatches: jest.fn(),
    getStats: jest.fn(),
    findSystemParams: jest.fn(),
    updateSystemParam: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPlayers', () => {
    it('should return player list', async () => {
      const mockResult = {
        page: 1,
        pageSize: 10,
        total: 0,
        list: [],
      };
      mockAdminService.findPlayers.mockResolvedValue(mockResult);

      const result = await controller.getPlayers({ page: 1, pageSize: 10 });
      expect(result).toEqual(mockResult);
      expect(mockAdminService.findPlayers).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    });
  });

  describe('getVenues', () => {
    it('should return venue list', async () => {
      const mockResult = { page: 1, pageSize: 10, total: 0, list: [] };
      mockAdminService.findVenues.mockResolvedValue(mockResult);

      const result = await controller.getVenues({ page: 1, pageSize: 10 });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMatches', () => {
    it('should return match list', async () => {
      const mockResult = { page: 1, pageSize: 10, total: 0, list: [] };
      mockAdminService.findMatches.mockResolvedValue(mockResult);

      const result = await controller.getMatches({ page: 1, pageSize: 10 });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getStats', () => {
    it('should return platform stats', async () => {
      const mockStats = {
        totalPlayers: 100,
        totalVenueManagers: 10,
        totalVenues: 15,
        todayMatches: 5,
        pendingIntentions: 20,
        weeklyMatchTrend: [],
        matchStatusDistribution: [],
      };
      mockAdminService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getSystemParams', () => {
    it('should return system params', async () => {
      const mockParams = [{ id: 1, paramKey: 'test', paramValue: {}, description: null }];
      mockAdminService.findSystemParams.mockResolvedValue(mockParams);

      const result = await controller.getSystemParams();
      expect(result).toEqual(mockParams);
    });
  });

  describe('updateSystemParam', () => {
    it('should update system param', async () => {
      const mockParam = { id: 1, paramKey: 'test', paramValue: { new: true } };
      mockAdminService.updateSystemParam.mockResolvedValue(mockParam);

      const result = await controller.updateSystemParam('test', {
        paramValue: { new: true },
      });
      expect(result).toEqual(mockParam);
      expect(mockAdminService.updateSystemParam).toHaveBeenCalledWith('test', { new: true }, undefined);
    });
  });
});
