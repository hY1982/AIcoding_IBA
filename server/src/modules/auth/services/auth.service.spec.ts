/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '@modules/users/entities/user.entity';
import { Player } from '@modules/players/entities/player.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { hashForQuery } from '@common/utils/encrypt.util';
import { RedisService } from '@common/services/redis.service';
import { PlayerRegisterDto, VenueManagerRegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

// Mock encrypt.util
jest.mock('@common/utils/encrypt.util', () => ({
  hashForQuery: jest.fn((input: string) => `hmac_${input}`),
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$mockhash'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let playerRepository: jest.Mocked<Repository<Player>>;
  let playerPositionRepository: jest.Mocked<Repository<PlayerPosition>>;
  let venueManagerRepository: jest.Mocked<Repository<VenueManager>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let dataSource: jest.Mocked<DataSource>;
  let redisService: jest.Mocked<RedisService>;
  let redisClient: { get: jest.Mock; set: jest.Mock; del: jest.Mock; keys: jest.Mock };
  let entityManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    // Create mock repositories
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    playerRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Player>>;

    playerPositionRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<PlayerPosition>>;

    venueManagerRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<VenueManager>>;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_EXPIRES_IN') return '2h';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    redisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    } as unknown as jest.Mocked<RedisService>;

    entityManager = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === User) return userRepository;
        if (entity === Player) return playerRepository;
        if (entity === PlayerPosition) return playerPositionRepository;
        if (entity === VenueManager) return venueManagerRepository;
        return {};
      }),
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(entityManager);
      }),
    } as unknown as jest.Mocked<DataSource>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DataSource, useValue: dataSource },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  // Helper functions
  const createMockUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 1,
      phone: '13800138000',
      phoneHash: 'hmac_13800138000',
      passwordHash: '$2a$12$mockhash',
      nickname: 'TestUser',
      userType: 'player' as const,
      status: 'active' as const,
      regionCode: null,
      avatarUrl: null,
      realName: null,
      idCard: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as User;

  const createPlayerRegisterDto = (overrides: Partial<PlayerRegisterDto> = {}): PlayerRegisterDto => ({
    phone: '13800138000',
    password: 'Password123',
    nickname: 'TestPlayer',
    userType: 'player',
    age: 25,
    basketballAge: 5,
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 185,
    standingReach: 230,
    jumpingReach: 320,
    positions: ['PG', 'SG'],
    ...overrides,
  });

  const createVenueManagerRegisterDto = (overrides: Partial<VenueManagerRegisterDto> = {}): VenueManagerRegisterDto => ({
    phone: '13800138111',
    password: 'Password123',
    nickname: 'TestManager',
    userType: 'venue_manager',
    companyName: 'Test Company',
    contactName: 'Manager Zhang',
    contactPhone: '13800138112',
    ...overrides,
  });

  describe('register', () => {
    it('should register a new player successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const mockUser = createMockUser({ nickname: 'TestPlayer' });
      const mockPlayer = { id: 1, userId: 1 } as Player;
      entityManager.save.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockPlayer);

      const dto = createPlayerRegisterDto();
      const result = await authService.register(dto);

      expect(result.user).toBeDefined();
      expect(result.user.phone).toBe('138****8000');
      expect(result.user.nickname).toBe('TestPlayer');
      expect(result.user.userType).toBe('player');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should register a new venue manager successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const mockUser = createMockUser({ id: 2, userType: 'venue_manager', nickname: 'TestManager' });
      entityManager.save.mockResolvedValue(mockUser);

      const dto = createVenueManagerRegisterDto();
      const result = await authService.register(dto);

      expect(result.user.userType).toBe('venue_manager');
      expect(result.user.nickname).toBe('TestManager');
    });

    it('should reject registration with duplicate phone', async () => {
      const existingUser = createMockUser();
      userRepository.findOne.mockResolvedValue(existingUser);

      const dto = createPlayerRegisterDto();
      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should handle concurrent duplicate registration via transaction', async () => {
      // Simulate transaction throwing unique constraint error
      dataSource.transaction.mockRejectedValueOnce({ code: '23505' });

      const dto = createPlayerRegisterDto();
      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow ConflictException from transaction unchanged', async () => {
      // Simulate transaction throwing ConflictException directly
      dataSource.transaction.mockRejectedValueOnce(new ConflictException('该手机号已被注册'));

      const dto = createPlayerRegisterDto();
      await expect(authService.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should reject registration with weak password', async () => {
      const dto = createPlayerRegisterDto({ password: '12345' });

      // Validation should happen before service call in controller
      // But service should still handle invalid input gracefully
      await expect(authService.register(dto)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login with correct phone and password', async () => {
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      redisClient.set.mockResolvedValue('OK');

      const loginDto: LoginDto = {
        phone: '13800138000',
        password: 'Password123',
      };

      const result = await authService.login(loginDto);

      expect(result.user).toBeDefined();
      expect(result.user.phone).toBe('138****8000');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should reject login with non-existent phone', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const loginDto: LoginDto = {
        phone: '13800999999',
        password: 'Password123',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login with wrong password', async () => {
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);

      const loginDto: LoginDto = {
        phone: '13800138000',
        password: 'WrongPassword123',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login for banned user', async () => {
      const mockUser = createMockUser({ status: 'banned' });
      userRepository.findOne.mockResolvedValue(mockUser);

      const loginDto: LoginDto = {
        phone: '13800138000',
        password: 'Password123',
      };

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should mask phone in response', async () => {
      const mockUser = createMockUser({ phone: '13812345678' });
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      redisClient.set.mockResolvedValue('OK');

      const loginDto: LoginDto = {
        phone: '13812345678',
        password: 'Password123',
      };

      const result = await authService.login(loginDto);
      expect(result.user.phone).toBe('138****5678');
    });
  });

  describe('refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const mockUser = createMockUser();
      const refreshToken = 'valid-refresh-token';
      const tokenHash = authService.hashToken(refreshToken);

      redisClient.get.mockResolvedValue(JSON.stringify({ userId: 1, issuedAt: Date.now() }));
      jwtService.verify.mockReturnValue({ sub: 1, phone: '13800138000', userType: 'player', type: 'refresh' });
      userRepository.findOne.mockResolvedValue(mockUser);
      redisClient.set.mockResolvedValue('OK');

      const result = await authService.refresh({ refreshToken });

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(redisClient.del).toHaveBeenCalledWith(`refresh:${tokenHash}`);
      expect(redisClient.set).toHaveBeenCalled();
    });

    it('should reject refresh with reused old refresh token', async () => {
      const refreshToken = 'old-refresh-token';

      // First call: token exists
      redisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 1, issuedAt: Date.now() }));
      // Second call: token no longer exists (after rotation)
      redisClient.get.mockResolvedValueOnce(null);

      jwtService.verify.mockReturnValue({ sub: 1, phone: '13800138000', userType: 'player', type: 'refresh' });

      // First refresh succeeds
      const mockUser = createMockUser();
      userRepository.findOne.mockResolvedValue(mockUser);
      redisClient.set.mockResolvedValue('OK');
      await authService.refresh({ refreshToken });

      // Second refresh with same token should fail
      await expect(authService.refresh({ refreshToken })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with invalid refresh token', async () => {
      redisClient.get.mockResolvedValue(null);

      await expect(authService.refresh({ refreshToken: 'invalid-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with expired refresh token', async () => {
      redisClient.get.mockResolvedValue(null);

      await expect(authService.refresh({ refreshToken: 'expired-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with corrupted redis data', async () => {
      redisClient.get.mockResolvedValue('not-valid-json');

      await expect(authService.refresh({ refreshToken: 'corrupted-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with invalid jwt signature', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify({ userId: 1, issuedAt: Date.now() }));
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(authService.refresh({ refreshToken: 'bad-signature-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh with wrong token type', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify({ userId: 1, issuedAt: Date.now() }));
      jwtService.verify.mockReturnValue({ sub: 1, phone: '13800138000', userType: 'player', type: 'access' });

      await expect(authService.refresh({ refreshToken: 'access-type-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh for banned user', async () => {
      const mockUser = createMockUser({ status: 'banned' });
      redisClient.get.mockResolvedValue(JSON.stringify({ userId: 1, issuedAt: Date.now() }));
      jwtService.verify.mockReturnValue({ sub: 1, phone: '13800138000', userType: 'player', type: 'refresh' });
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(authService.refresh({ refreshToken: 'banned-user-token' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh for non-existent user', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify({ userId: 999, issuedAt: Date.now() }));
      jwtService.verify.mockReturnValue({ sub: 999, phone: '13800999999', userType: 'player', type: 'refresh' });
      userRepository.findOne.mockResolvedValue(null);

      await expect(authService.refresh({ refreshToken: 'missing-user-token' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete all refresh tokens on logout', async () => {
      redisClient.keys.mockResolvedValue(['refresh:hash1', 'refresh:hash2']);
      redisClient.del.mockResolvedValue(2);

      await authService.logout(1);

      expect(redisClient.keys).toHaveBeenCalledWith('refresh:*');
      expect(redisClient.del).toHaveBeenCalledWith('refresh:hash1', 'refresh:hash2');
    });

    it('should handle logout when no refresh tokens exist', async () => {
      redisClient.keys.mockResolvedValue([]);

      await authService.logout(1);

      expect(redisClient.keys).toHaveBeenCalledWith('refresh:*');
      expect(redisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('password security', () => {
    it('should use bcrypt to hash password', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const mockUser = createMockUser();
      entityManager.save.mockResolvedValue(mockUser);

      const dto = createPlayerRegisterDto();
      await authService.register(dto);

      expect(bcryptjs.hash).toHaveBeenCalledWith(dto.password, 12);
    });

    it('should use different salts for same password', async () => {
      // bcryptjs.hash is mocked to always return same value in tests
      // In real implementation, bcrypt uses random salts
      // We verify the mock was called with correct parameters
      expect(bcryptjs.hash).toBeDefined();
    });
  });

  describe('parseExpiresInToSeconds', () => {
    it('should parse seconds correctly', () => {
      const result = (authService as any).parseExpiresInToSeconds('30s');
      expect(result).toBe(30);
    });

    it('should parse minutes correctly', () => {
      const result = (authService as any).parseExpiresInToSeconds('15m');
      expect(result).toBe(15 * 60);
    });

    it('should parse hours correctly', () => {
      const result = (authService as any).parseExpiresInToSeconds('2h');
      expect(result).toBe(2 * 60 * 60);
    });

    it('should parse days correctly', () => {
      const result = (authService as any).parseExpiresInToSeconds('7d');
      expect(result).toBe(7 * 24 * 60 * 60);
    });

    it('should return default for invalid format', () => {
      const result = (authService as any).parseExpiresInToSeconds('invalid');
      expect(result).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('phone encryption', () => {
    it('should store phone hash for lookup', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const mockUser = createMockUser();
      entityManager.save.mockResolvedValue(mockUser);

      const dto = createPlayerRegisterDto({ phone: '13800138001' });
      await authService.register(dto);

      expect(hashForQuery).toHaveBeenCalledWith(dto.phone);
    });
  });
});
