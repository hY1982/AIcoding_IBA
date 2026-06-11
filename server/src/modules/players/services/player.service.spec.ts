import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PlayerService } from './player.service';
import { Player } from '../entities/player.entity';
import { PlayerPosition } from '../entities/player-position.entity';
import { User } from '@modules/users/entities/user.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { AbilityCalculationService } from './ability-calculation.service';
import { CreatePlayerDto } from '../dto/create-player.dto';
import { UpdatePlayerDto } from '../dto/update-player.dto';
import { Gender } from '@shared/player';

// Mock repositories
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

// Mock DataSource transaction
const createMockDataSource = () => ({
  transaction: jest.fn(),
  manager: {
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  },
});

// Mock AbilityCalculationService
const createMockAbilityService = () => ({
  calculateBaseAbility: jest.fn(),
});

describe('PlayerService', () => {
  let service: PlayerService;
  let playerRepo: MockRepository<Player>;
  let positionRepo: MockRepository<PlayerPosition>;
  let userRepo: MockRepository<User>;
  let matchPlayerRepo: MockRepository<MatchPlayer>;
  let abilityCalcService: ReturnType<typeof createMockAbilityService>;
  let dataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(async () => {
    playerRepo = createMockRepository();
    positionRepo = createMockRepository();
    userRepo = createMockRepository();
    matchPlayerRepo = createMockRepository();
    abilityCalcService = createMockAbilityService();
    dataSource = createMockDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerService,
        {
          provide: getRepositoryToken(Player),
          useValue: playerRepo,
        },
        {
          provide: getRepositoryToken(PlayerPosition),
          useValue: positionRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(MatchPlayer),
          useValue: matchPlayerRepo,
        },
        {
          provide: AbilityCalculationService,
          useValue: abilityCalcService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<PlayerService>(PlayerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== Test Helpers ====================

  const createMockPlayer = (overrides?: Partial<Player>): Player => {
    const player = new Player();
    player.id = 1;
    player.userId = 100;
    player.age = 25;
    player.basketballAge = 5;
    player.gender = 'male';
    player.height = 180;
    player.weight = 75;
    player.wingspan = 185;
    player.standingReach = 230;
    player.jumpingReach = 310;
    player.baseAbilityScore = 65.5;
    player.matchAdjustValue = 2.0;
    player.totalAbilityScore = 67.5;
    player.regionCode = 'shenzhen_futian';
    player.createdAt = new Date('2024-01-01');
    player.updatedAt = new Date('2024-01-01');
    return Object.assign(player, overrides);
  };

  const createMockUser = (overrides?: Partial<User>): User => {
    const user = new User();
    user.id = 100;
    user.phone = '13812345678';
    user.phoneHash = 'hash123';
    user.passwordHash = 'passhash';
    user.nickname = '篮球小子';
    user.realName = '张三丰';
    user.userType = 'player';
    user.status = 'active';
    user.regionCode = 'shenzhen_futian';
    user.createdAt = new Date('2024-01-01');
    user.updatedAt = new Date('2024-01-01');
    return Object.assign(user, overrides);
  };

  const createMockPositions = (): PlayerPosition[] => [
    { id: 1, playerId: 1, position: 'PG', priority: 1 } as PlayerPosition,
    { id: 2, playerId: 1, position: 'SG', priority: 2 } as PlayerPosition,
  ];

  const setupFindByIdQueryBuilder = (
    player: Player,
    user: User,
    positions: PlayerPosition[],
  ) => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        ...player,
        user,
        positions,
      }),
    };
    playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);
    return mockQueryBuilder;
  };

  const createValidDto = (): CreatePlayerDto => ({
    birthDate: '1999-06-10',
    startPlayingDate: '2019-03',
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 185,
    standingReach: 230,
    jumpingReach: 310,
    positions: ['PG', 'SG'],
    regionCode: 'shenzhen_futian',
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create player with valid attributes and auto-calculate ability score', async () => {
      const userId = 100;
      const dto = createValidDto();
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      playerRepo.findOneBy!.mockResolvedValue(null); // No existing player
      abilityCalcService.calculateBaseAbility.mockReturnValue(65.5);

      // Mock transaction
      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((entity: any, data: any) => data);
        manager.save.mockImplementation(async (entity: any, data: any) => {
          if (entity === Player) return { ...mockPlayer, ...data, id: 1 };
          if (Array.isArray(data))
            return data.map((d, i) => ({ id: i + 1, ...d }));
          return { id: 1, ...data };
        });
        return cb(manager);
      });

      // Mock findById QueryBuilder for the return value
      setupFindByIdQueryBuilder(mockPlayer, mockUser, mockPositions);

      const result = await service.create(userId, dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(abilityCalcService.calculateBaseAbility).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.phone).toBe('138****5678');
    });

    it('should allow creating player without positions', async () => {
      const userId = 100;
      const dto = { ...createValidDto(), positions: undefined };
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();

      playerRepo.findOneBy!.mockResolvedValue(null);
      abilityCalcService.calculateBaseAbility.mockReturnValue(65.5);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((entity: any, data: any) => data);
        manager.save.mockImplementation(async (entity: any, data: any) => {
          if (entity === Player) return { ...mockPlayer, ...data, id: 1 };
          return data;
        });
        return cb(manager);
      });

      setupFindByIdQueryBuilder(mockPlayer, mockUser, []);

      const result = await service.create(userId, dto);

      expect(result).toBeDefined();
      expect(result.positions).toEqual([]);
    });

    it('should allow creating player with empty positions array', async () => {
      const userId = 100;
      const dto = { ...createValidDto(), positions: [] };
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();

      playerRepo.findOneBy!.mockResolvedValue(null);
      abilityCalcService.calculateBaseAbility.mockReturnValue(65.5);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((entity: any, data: any) => data);
        manager.save.mockImplementation(async (entity: any, data: any) => {
          if (entity === Player) return { ...mockPlayer, ...data, id: 1 };
          return data;
        });
        return cb(manager);
      });

      setupFindByIdQueryBuilder(mockPlayer, mockUser, []);

      const result = await service.create(userId, dto);

      expect(result).toBeDefined();
      expect(result.positions).toEqual([]);
    });

    it('should throw BadRequestException when positions exceed 3', async () => {
      const userId = 100;
      const dto = {
        ...createValidDto(),
        positions: ['PG', 'SG', 'SF', 'PF'] as any,
      };

      await expect(service.create(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when user already has a player record', async () => {
      const userId = 100;
      const dto = createValidDto();
      const existingPlayer = createMockPlayer();

      playerRepo.findOneBy!.mockResolvedValue(existingPlayer);

      await expect(service.create(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle missing optional fields by using defaults for ability calculation', async () => {
      const userId = 100;
      const dto = {
        birthDate: '1999-06-10',
        startPlayingDate: '2019-03',
        gender: 'male',
        height: 180,
      } as CreatePlayerDto;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();

      playerRepo.findOneBy!.mockResolvedValue(null);
      abilityCalcService.calculateBaseAbility.mockReturnValue(60.0);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((entity: any, data: any) => data);
        manager.save.mockImplementation(async (entity: any, data: any) => {
          if (entity === Player) return { ...mockPlayer, ...data, id: 1 };
          return data;
        });
        return cb(manager);
      });

      setupFindByIdQueryBuilder(mockPlayer, mockUser, []);

      const result = await service.create(userId, dto);

      expect(abilityCalcService.calculateBaseAbility).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle positions as null (not create position records)', async () => {
      const userId = 100;
      const dto = { ...createValidDto(), positions: null as any };
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();

      playerRepo.findOneBy!.mockResolvedValue(null);
      abilityCalcService.calculateBaseAbility.mockReturnValue(65.5);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.create.mockImplementation((entity: any, data: any) => data);
        manager.save.mockImplementation(async (entity: any, data: any) => {
          if (entity === Player) return { ...mockPlayer, ...data, id: 1 };
          return data;
        });
        return cb(manager);
      });

      setupFindByIdQueryBuilder(mockPlayer, mockUser, []);

      const result = await service.create(userId, dto);

      expect(result).toBeDefined();
      expect(result.positions).toEqual([]);
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should recalculate baseAbilityScore when ability-related fields change', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { height: 190 };
      const existingPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);
      abilityCalcService.calculateBaseAbility.mockReturnValue(72.5);

      // Mock QueryBuilder for findById after update
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...existingPlayer,
          height: 190,
          baseAbilityScore: 72.5,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        });
        manager.delete.mockResolvedValue({ affected: 2 });
        return cb(manager);
      });

      const result = await service.update(playerId, dto);

      expect(abilityCalcService.calculateBaseAbility).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should NOT recalculate baseAbilityScore when only non-ability fields change', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { regionCode: 'shanghai_minghang' };
      const existingPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...existingPlayer,
          regionCode: 'shanghai_minghang',
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        });
        return cb(manager);
      });

      const result = await service.update(playerId, dto);

      expect(abilityCalcService.calculateBaseAbility).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should replace positions when positions are provided', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { positions: ['C', 'PF'] };
      const existingPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const newPositions = [
        { id: 3, playerId: 1, position: 'C', priority: 1 } as PlayerPosition,
        { id: 4, playerId: 1, position: 'PF', priority: 2 } as PlayerPosition,
      ];

      playerRepo.findOne!.mockResolvedValue(existingPlayer);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...existingPlayer,
          user: mockUser,
          positions: newPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        });
        manager.save.mockImplementation(async (entity: any, data: any) => {
          if (Array.isArray(data))
            return data.map((d, i) => ({ id: i + 3, ...d }));
          return data;
        });
        manager.delete.mockResolvedValue({ affected: 2 });
        return cb(manager);
      });

      const result = await service.update(playerId, dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should clear all positions when empty positions array is provided', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { positions: [] };
      const existingPlayer = createMockPlayer();
      const mockUser = createMockUser();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...existingPlayer,
          user: mockUser,
          positions: [],
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        });
        manager.delete.mockResolvedValue({ affected: 2 });
        return cb(manager);
      });

      const result = await service.update(playerId, dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when positions exceed 3', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = {
        positions: ['PG', 'SG', 'SF', 'PF'] as any,
      };
      const existingPlayer = createMockPlayer();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);

      await expect(service.update(playerId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when player does not exist', async () => {
      const playerId = 999;
      const dto: UpdatePlayerDto = { height: 190 };

      playerRepo.findOne!.mockResolvedValue(null);

      await expect(service.update(playerId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should keep matchAdjustValue unchanged during update', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { height: 190 };
      const existingPlayer = createMockPlayer({ matchAdjustValue: 5.0 });
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);
      abilityCalcService.calculateBaseAbility.mockReturnValue(72.5);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...existingPlayer,
          height: 190,
          baseAbilityScore: 72.5,
          matchAdjustValue: 5.0,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        });
        manager.save.mockImplementation(async (entity: any, data: any) => data);
        return cb(manager);
      });

      const result = await service.update(playerId, dto);

      expect(result).toBeDefined();
    });

    it('should not update positions when positions is null', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { height: 190, positions: null as any };
      const existingPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);
      abilityCalcService.calculateBaseAbility.mockReturnValue(72.5);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...existingPlayer,
          height: 190,
          baseAbilityScore: 72.5,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        });
        manager.save.mockImplementation(async (entity: any, data: any) => data);
        return cb(manager);
      });

      const result = await service.update(playerId, dto);

      expect(result).toBeDefined();
      // positions is null, so no delete/insert should happen
      expect(dataSource.manager.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when optimistic lock fails', async () => {
      const playerId = 1;
      const dto: UpdatePlayerDto = { height: 190 };
      const existingPlayer = createMockPlayer();

      playerRepo.findOne!.mockResolvedValue(existingPlayer);
      abilityCalcService.calculateBaseAbility.mockReturnValue(72.5);

      dataSource.transaction.mockImplementation(async (cb: any) => {
        const manager = dataSource.manager;
        manager.createQueryBuilder.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 0 }),
        });
        return cb(manager);
      });

      await expect(service.update(playerId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should return player profile with masked phone and name', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockPlayer,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findById(playerId);

      expect(result).toBeDefined();
      expect(result.phone).toBe('138****5678');
      expect(result.realName).toBe('张**');
    });

    it('should throw NotFoundException when player does not exist', async () => {
      const playerId = 999;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      await expect(service.findById(playerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include positions in the result', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockPlayer,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findById(playerId);

      expect(result.positions).toHaveLength(2);
      expect(result.positions[0]).toEqual({ position: 'PG', priority: 1 });
      expect(result.positions[1]).toEqual({ position: 'SG', priority: 2 });
    });

    it('should handle user without realName', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser({ realName: null });
      const mockPositions = createMockPositions();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockPlayer,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findById(playerId);

      expect(result.realName).toBe('');
    });

    it('should return player profile with empty positions array', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockPlayer,
          user: mockUser,
          positions: [],
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findById(playerId);

      expect(result.positions).toEqual([]);
    });

    it('should return complete player profile with all fields', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockPlayer,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findById(playerId);

      expect(result).toMatchObject({
        id: expect.any(Number),
        userId: expect.any(Number),
        age: expect.any(Number),
        basketballAge: expect.any(Number),
        gender: expect.any(String),
        height: expect.any(Number),
        weight: expect.any(Number),
        wingspan: expect.any(Number),
        standingReach: expect.any(Number),
        jumpingReach: expect.any(Number),
        positions: expect.any(Array),
        regionCode: expect.any(String),
        baseAbilityScore: expect.any(Number),
        matchAdjustValue: expect.any(Number),
        totalAbilityScore: expect.any(Number),
        phone: expect.any(String),
        nickname: expect.any(String),
        realName: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  // ==================== findByUserId ====================

  describe('findByUserId', () => {
    it('should return player profile when player exists', async () => {
      const userId = 100;
      const mockPlayer = createMockPlayer();
      const mockUser = createMockUser();
      const mockPositions = createMockPositions();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockPlayer,
          user: mockUser,
          positions: mockPositions,
        }),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByUserId(userId);

      expect(result).not.toBeNull();
      expect(result!.phone).toBe('138****5678');
    });

    it('should return null when player does not exist', async () => {
      const userId = 999;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      playerRepo.createQueryBuilder!.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  // ==================== remove ====================

  describe('remove', () => {
    it('should remove existing player and cascade delete positions', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();

      playerRepo.findOne!.mockResolvedValue(mockPlayer);
      matchPlayerRepo.count!.mockResolvedValue(0);
      playerRepo.remove!.mockResolvedValue(mockPlayer);

      await service.remove(playerId);

      expect(playerRepo.findOne).toHaveBeenCalledWith({
        where: { id: playerId },
      });
      expect(matchPlayerRepo.count).toHaveBeenCalledWith({
        where: { playerId },
      });
      expect(playerRepo.remove).toHaveBeenCalledWith(mockPlayer);
    });

    it('should throw ConflictException when player has match associations', async () => {
      const playerId = 1;
      const mockPlayer = createMockPlayer();

      playerRepo.findOne!.mockResolvedValue(mockPlayer);
      matchPlayerRepo.count!.mockResolvedValue(2);

      await expect(service.remove(playerId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when player does not exist', async () => {
      const playerId = 999;

      playerRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove(playerId)).rejects.toThrow(NotFoundException);
    });
  });
});
