import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RedisService } from '@common/services/redis.service';
import { User } from '@modules/users/entities/user.entity';
import { Player } from '@modules/players/entities/player.entity';
import { PlayerPosition } from '@modules/players/entities/player-position.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { IntentionVenue } from '@modules/intentions/entities/intention-venue.entity';
import { IntentionFormat } from '@modules/intentions/entities/intention-format.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Feedback } from '@modules/feedbacks/entities/feedback.entity';
import { FeedbackPlayerRating } from '@modules/feedbacks/entities/feedback-player-rating.entity';
import { AdjustUpdateFailure } from '@modules/feedbacks/entities/adjust-update-failure.entity';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { PlayerRegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RedisMock } from '../../../../test/helpers/redis-mock';

describe('Auth Integration Tests', () => {
  let dataSource: DataSource;
  let authService: AuthService;
  let userRepo: Repository<User>;
  let playerRepo: Repository<Player>;
  let redisClient: RedisMock;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'vXloZBGTT7syeDNs5GBducYtkWxMuWifda6JljWUfHA=';
    process.env.PHONE_HASH_SECRET = 'test-phone-hash-secret-key-32bytes';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-integration-tests';
    process.env.JWT_EXPIRES_IN = '2h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.REFRESH_TOKEN_HASH_SECRET = 'test-refresh-token-hash-secret-32bytes';

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'basketball_platform_test',
      entities: [
        User,
        VenueManager,
        Player,
        PlayerPosition,
        Venue,
        VenueTimeSlot,
        Format,
        Intention,
        IntentionVenue,
        IntentionFormat,
        Match,
        MatchPlayer,
        MatchTeam,
        MatchMessage,
        Feedback,
        FeedbackPlayerRating,
        AdjustUpdateFailure,
        SystemParam,
      ],
      synchronize: true,
    });
    await dataSource.initialize();

    userRepo = dataSource.getRepository(User);
    playerRepo = dataSource.getRepository(Player);

    // Setup in-memory Redis mock for testing
    redisClient = new RedisMock();
    await redisClient.flushdb();

    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET,
    });

    const configService = new ConfigService({
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
      REFRESH_TOKEN_HASH_SECRET: process.env.REFRESH_TOKEN_HASH_SECRET,
    });

    const redisService = new RedisService(configService);
    // Override the client for testing
    (redisService as any).client = redisClient;

    const mockSmsService = {
      sendSmsCode: jest.fn().mockResolvedValue({
        success: true,
        requestId: 'mock-request-id',
        expiresIn: 300,
      }),
    };

    const mockAbilityCalcService = {
      calculateBaseAbility: jest.fn().mockReturnValue(62.5),
    };

    authService = new AuthService(
      dataSource,
      jwtService,
      configService,
      redisService,
      mockSmsService as any,
      mockAbilityCalcService as any,
    );
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE feedback_player_ratings CASCADE');
    await dataSource.query('TRUNCATE TABLE feedbacks CASCADE');
    await dataSource.query('TRUNCATE TABLE match_messages CASCADE');
    await dataSource.query('TRUNCATE TABLE match_teams CASCADE');
    await dataSource.query('TRUNCATE TABLE match_players CASCADE');
    await dataSource.query('TRUNCATE TABLE matches CASCADE');
    await dataSource.query('TRUNCATE TABLE formats CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_time_slots CASCADE');
    await dataSource.query('TRUNCATE TABLE venues CASCADE');
    await dataSource.query('TRUNCATE TABLE venue_managers CASCADE');
    await dataSource.query('TRUNCATE TABLE player_positions CASCADE');
    await dataSource.query('TRUNCATE TABLE players CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE system_params CASCADE');
    await redisClient.flushdb();
  });

  afterAll(async () => {
    await redisClient.quit();
    await dataSource.destroy();
  });

  function nextPhone(): string {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 10000);
    return `138${String(ts % 100000000).padStart(8, '0')}${String(rand).padStart(4, '0')}`.slice(0, 11);
  }

  describe('AUTH-INT-001: player registration with encrypted data', () => {
    it('should encrypt phone and hash password correctly', async () => {
      const phone = nextPhone();
      const dto: PlayerRegisterDto = {
        phone,
        password: 'Test1234',
        nickname: 'TestPlayer',
        userType: 'player',
        birthDate: '1999-06-10',
        startPlayingDate: '2019-03',
        gender: 'male',
        height: 180,
      };

      const result = await authService.register(dto);

      expect(result.user).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.user.phone).toBe(phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));

      // Verify database record (use query to get raw encrypted value)
      const rawUser = await dataSource.query(
        'SELECT phone, phone_hash, password_hash FROM users WHERE id = $1',
        [result.user.id],
      );
      expect(rawUser.length).toBe(1);
      // Phone should be encrypted (not plaintext)
      expect(rawUser[0].phone).not.toBe(phone);
      expect(rawUser[0].phone).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      // phoneHash should be HMAC-SHA256 (64 hex chars)
      expect(rawUser[0].phone_hash).toMatch(/^[a-f0-9]{64}$/);
      // passwordHash should be bcrypt
      expect(rawUser[0].password_hash).toMatch(/^\$2[aby]\$/);

      // Verify TypeORM transformer decrypts correctly
      const user = await userRepo.findOne({ where: { id: result.user.id } });
      expect(user!.phone).toBe(phone);

      // Verify player record created
      const player = await playerRepo.findOne({ where: { userId: user!.id } });
      expect(player).toBeDefined();
      expect(player!.age).toBe(25);
      expect(player!.height).toBe(180);
    });
  });

  describe('AUTH-INT-002: duplicate registration rejection', () => {
    it('should reject registration with existing phone number', async () => {
      const phone = nextPhone();
      const dto: PlayerRegisterDto = {
        phone,
        password: 'Test1234',
        nickname: 'TestPlayer',
        userType: 'player',
        birthDate: '1999-06-10',
        startPlayingDate: '2019-03',
        gender: 'male',
        height: 180,
      };

      await authService.register(dto);

      await expect(authService.register(dto)).rejects.toThrow(/该手机号已被注册/);

      // Verify only one user record exists
      const users = await userRepo.find();
      expect(users.length).toBe(1);
    });
  });

  describe('AUTH-INT-003: JWT token generation and refresh', () => {
    it('should generate tokens on login and refresh with new pair', async () => {
      const phone = nextPhone();
      const password = 'Test1234';
      const registerDto: PlayerRegisterDto = {
        phone,
        password,
        nickname: 'TestPlayer',
        userType: 'player',
        birthDate: '1999-06-10',
        startPlayingDate: '2019-03',
        gender: 'male',
        height: 180,
      };

      const registerResult = await authService.register(registerDto);
      const oldRefreshToken = registerResult.tokens.refreshToken;

      // Verify refresh token stored in Redis
      const jwtService = new JwtService({ secret: process.env.JWT_SECRET });
      const decoded = jwtService.decode(oldRefreshToken) as { sub: number };
      const userId = decoded.sub;

      // Login should generate new tokens
      const loginDto: LoginDto = { phone, password };
      const loginResult = await authService.login(loginDto);
      expect(loginResult.tokens.accessToken).toBeDefined();
      expect(loginResult.tokens.refreshToken).toBeDefined();

      // Refresh should generate new pair
      const refreshResult = await authService.refresh({
        refreshToken: loginResult.tokens.refreshToken,
      });
      expect(refreshResult.tokens.accessToken).toBeDefined();
      expect(refreshResult.tokens.refreshToken).toBeDefined();

      // Verify new refresh token is stored in Redis and usable
      const newRefreshTokenHash = await redisClient.smembers(`user_refresh:${userId}`);
      expect(newRefreshTokenHash.length).toBeGreaterThanOrEqual(1);

      // Verify at least one new token hash exists
      const newStored = await redisClient.get(`refresh:${newRefreshTokenHash[0]}`);
      expect(newStored).not.toBeNull();

      // Wait 1 second to ensure new JWT has different iat, then verify token rotation
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const secondRefreshResult = await authService.refresh({
        refreshToken: refreshResult.tokens.refreshToken,
      });
      expect(secondRefreshResult.tokens.accessToken).toBeDefined();
      expect(secondRefreshResult.tokens.refreshToken).toBeDefined();

      // After 1s gap, old token should be invalidated (different iat → different hash)
      await expect(
        authService.refresh({ refreshToken: refreshResult.tokens.refreshToken }),
      ).rejects.toThrow(/Refresh token 无效或已过期/);
    });
  });

  describe('AUTH-INT-004: invalid token rejection', () => {
    it('should reject invalid refresh token', async () => {
      await expect(
        authService.refresh({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(/Refresh token 无效或已过期/);
    });

    it('should reject login with wrong password', async () => {
      const phone = nextPhone();
      const registerDto: PlayerRegisterDto = {
        phone,
        password: 'Test1234',
        nickname: 'TestPlayer',
        userType: 'player',
        birthDate: '1999-06-10',
        startPlayingDate: '2019-03',
        gender: 'male',
        height: 180,
      };

      await authService.register(registerDto);

      const loginDto: LoginDto = { phone, password: 'WrongPassword' };
      await expect(authService.login(loginDto)).rejects.toThrow(/手机号或密码错误/);
    });
  });
});
