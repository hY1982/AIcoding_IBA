import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AdminService } from './admin.service';
import { Player } from '@modules/players/entities/player.entity';
import { User } from '@modules/users/entities/user.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';

describe('AdminService', () => {
  let service: AdminService;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };

  const mockRepository = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn(() => mockRepository),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findPlayers', () => {
    it('should return paginated player list', async () => {
      const mockUser = {
        id: 1,
        phone: '13800138000',
        nickname: 'TestPlayer',
        realName: '张三',
        status: 'active',
      } as User;

      const mockPlayer = {
        id: 1,
        userId: 1,
        age: 25,
        basketballAge: 5,
        gender: 'male' as const,
        height: 180,
        baseAbilityScore: 75.5,
        matchAdjustValue: 0,
        totalAbilityScore: 75.5,
        regionCode: 'shenzhen',
        user: mockUser,
        positions: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      } as unknown as Player;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockPlayer], 1]);

      const result = await service.findPlayers({ page: 1, pageSize: 10 });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(1);
      expect(result.list).toHaveLength(1);
      expect(result.list[0].phoneRaw).toBe('13800138000');
      expect(result.list[0].realNameRaw).toBe('张三');
      expect(result.list[0].phone).toBe('138****8000');
    });

    it('should apply keyword filter', async () => {
      await service.findPlayers({ keyword: 'test', page: 1, pageSize: 10 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.any(Object),
      );
    });
  });

  describe('findVenues', () => {
    it('should return paginated venue list', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findVenues({ page: 1, pageSize: 10 });

      expect(result.page).toBe(1);
      expect(result.list).toEqual([]);
    });
  });

  describe('findMatches', () => {
    it('should return paginated match list with venue and format names', async () => {
      const mockMatch = {
        id: 1,
        venueId: 1,
        formatId: 1,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T12:00:00Z'),
        status: 'pending_players',
        teamCount: 2,
        playersPerTeam: 3,
        requiredPlayers: 6,
        confirmedPlayers: 0,
        depositAmount: '50.00',
        venue: { name: 'Test Venue' },
        format: { name: '3v3短赛' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Match;

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockMatch], 1]);

      const result = await service.findMatches({ page: 1, pageSize: 10 });

      expect(result.list[0].venueName).toBe('Test Venue');
      expect(result.list[0].formatName).toBe('3v3短赛');
    });
  });

  describe('getStats', () => {
    it('should return platform statistics', async () => {
      mockRepository.count
        .mockResolvedValueOnce(100)  // players
        .mockResolvedValueOnce(10)   // venueManagers
        .mockResolvedValueOnce(15)   // venues
        .mockResolvedValueOnce(50);  // pendingIntentions

      const result = await service.getStats();

      expect(result.totalPlayers).toBe(100);
      expect(result.totalVenueManagers).toBe(10);
      expect(result.totalVenues).toBe(15);
      expect(result.pendingIntentions).toBe(50);
      expect(result.weeklyMatchTrend).toHaveLength(7);
    });
  });

  describe('findSystemParams', () => {
    it('should return all system params', async () => {
      const mockParams = [
        { id: 1, paramKey: 'base_ability_weights', paramValue: {}, description: 'test' },
      ] as SystemParam[];
      mockRepository.find.mockResolvedValue(mockParams);

      const result = await service.findSystemParams();

      expect(result).toEqual(mockParams);
    });
  });

  describe('updateSystemParam', () => {
    it('should update existing param', async () => {
      const existingParam = {
        id: 1,
        paramKey: 'base_ability_weights',
        paramValue: { old: true },
        description: 'old desc',
      } as SystemParam;

      mockRepository.findOne.mockResolvedValue(existingParam);
      mockRepository.save.mockResolvedValue({
        ...existingParam,
        paramValue: { new: true },
      });

      const result = await service.updateSystemParam('base_ability_weights', { new: true });

      expect(result.paramValue).toEqual({ new: true });
    });

    it('should create new param if not exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        paramKey: 'new_param',
        paramValue: { test: true },
        description: null,
      } as unknown as SystemParam);
      mockRepository.save.mockResolvedValue({
        id: 2,
        paramKey: 'new_param',
        paramValue: { test: true },
      } as unknown as SystemParam);

      const result = await service.updateSystemParam('new_param', { test: true });

      expect(result.paramKey).toBe('new_param');
    });
  });
});
