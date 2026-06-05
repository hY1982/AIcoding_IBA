import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppModule } from './../src/app.module';
import { AuthService } from '@modules/auth/services/auth.service';
import { VenueService } from '@modules/venues/services/venue.service';
import { IntentionService } from '@modules/intentions/services/intention.service';
import { MatchingEngineService } from '@modules/matching/services/matching-engine.service';
import { MatchConfirmationService } from '@modules/matches/services/match-confirmation.service';
import { MessageService } from '@modules/messages/services/message.service';
import { NotificationService } from '@modules/notifications/services/notification.service';
import { SystemParam } from '@modules/system/entities/system-param.entity';
import { Format } from '@modules/formats/entities/format.entity';
import { VenueTimeSlot } from '@modules/venues/entities/venue-time-slot.entity';
import { Match } from '@modules/matches/entities/match.entity';
import { MatchPlayer } from '@modules/matches/entities/match-player.entity';
import { Intention } from '@modules/intentions/entities/intention.entity';
import { User } from '@modules/users/entities/user.entity';
import { Player } from '@modules/players/entities/player.entity';
import { Venue } from '@modules/venues/entities/venue.entity';
import { VenueManager } from '@modules/users/entities/venue-manager.entity';
import { MatchTeam } from '@modules/matches/entities/match-team.entity';
import { MatchMessage } from '@modules/messages/entities/match-message.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { MockOrder } from '@modules/payments/entities/mock-order.entity';
import { RedisService } from '@common/services/redis.service';

/**
 * End-to-End Full Flow Integration Test
 *
 * Tests the complete business flow:
 * 1. User registration (Auth + Player creation)
 * 2. Venue creation (VenueManager + Venue + TimeSlots)
 * 3. Format creation
 * 4. System parameter setup (match_threshold_params, group_chat_expiry_days)
 * 5. Intention submission
 * 6. Matching engine execution (via direct service call + BullMQ queue)
 * 7. Match confirmation (deposit payment + player confirmation)
 * 8. Match finalization
 * 9. Group chat messaging
 * 10. Notification generation
 *
 * Requires: PostgreSQL test database + Redis running
 */
describe('Full E2E Flow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let authService: AuthService;
  let venueService: VenueService;
  let intentionService: IntentionService;
  let matchingEngineService: MatchingEngineService;
  let matchConfirmationService: MatchConfirmationService;
  let messageService: MessageService;
  let notificationService: NotificationService;
  let matchingQueue: Queue;
  let redisService: RedisService;

  // Test data holders
  let managerUserId: number;
  let venueId: number;
  let formatId: number;
  let playerUserIds: number[] = [];
  let matchId: number;

  beforeAll(async () => {
    // Set required environment variables
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'vXloZBGTT7syeDNs5GBducYtkWxMuWifda6JljWUfHA=';
    process.env.PHONE_HASH_SECRET = 'test-phone-hash-secret-key-32bytes';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';
    process.env.JWT_EXPIRES_IN = '2h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    process.env.REFRESH_TOKEN_HASH_SECRET = 'test-refresh-token-hash-secret-32bytes';
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.DB_PORT || '5432';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'postgres';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
    process.env.DB_NAME = 'basketball_platform_test';
    process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
    process.env.REDIS_PASSWORD = '';
    process.env.REDIS_DB = '0';
    process.env.REDIS_KEY_PREFIX = 'basketball:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    dataSource = app.get(DataSource);
    authService = app.get(AuthService);
    venueService = app.get(VenueService);
    intentionService = app.get(IntentionService);
    matchingEngineService = app.get(MatchingEngineService);
    matchConfirmationService = app.get(MatchConfirmationService);
    messageService = app.get(MessageService);
    notificationService = app.get(NotificationService);
    matchingQueue = app.get<Queue>(getQueueToken('matching'));
    redisService = app.get(RedisService);

    // Clean database
    await cleanDatabase(dataSource);
    // Clean Redis
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==================== Helper Functions ====================

  async function cleanDatabase(ds: DataSource): Promise<void> {
    // Use query builder to truncate tables, bypassing empty criteria restriction
    const tables = [
      'match_message',
      'match_team',
      'match_player',
      'match',
      'intention_venue',
      'intention_format',
      'intention',
      'venue_time_slot',
      'venue',
      'venue_manager',
      'format',
      'system_param',
      'mock_order',
      'notification',
      'player_position',
      'player',
      'user',
    ];
    for (const table of tables) {
      try {
        await ds.query(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch {
        // Table may not exist, ignore
      }
    }
  }

  function nextPhone(): string {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 10000);
    return `138${String(ts % 100000000).padStart(8, '0')}${String(rand).padStart(4, '0')}`.slice(0, 11);
  }

  // ==================== Test Suite ====================

  describe('Phase 1: Health & Infrastructure', () => {
    it('/api/v1/health (GET) should return status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });

    it('should have database connection initialized', () => {
      expect(dataSource).toBeDefined();
      expect(dataSource.isInitialized).toBe(true);
    });

    it('should have Redis connection working', async () => {
      const ping = await redisService.ping();
      expect(ping).toBe('PONG');
    });

    it('should have BullMQ matching queue available', () => {
      expect(matchingQueue).toBeDefined();
      expect(matchingQueue.name).toBe('matching');
    });
  });

  describe('Phase 2: Auth & User Registration', () => {
    it('should register a venue manager', async () => {
      const phone = nextPhone();
      const result = await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'TestManager',
        userType: 'venue_manager',
        regionCode: 'shenzhen_futian',
        companyName: 'Test Sports Co.',
        contactName: 'Manager Zhang',
        contactPhone: phone,
      } as any);

      expect(result.user).toBeDefined();
      expect(result.user.userType).toBe('venue_manager');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      // Get VenueManager id (not User id) for venue creation
      const vmRepo = dataSource.getRepository(VenueManager);
      const vm = await vmRepo.findOne({ where: { userId: result.user.id } });
      expect(vm).toBeDefined();
      managerUserId = vm!.id;
    });

    it('should register 6 players for a 3v3 match', async () => {
      playerUserIds = [];

      for (let i = 0; i < 6; i++) {
        const phone = nextPhone();
        const result = await authService.register({
          phone,
          password: 'TestPass123!',
          nickname: `Player${i + 1}`,
          userType: 'player',
          regionCode: 'shenzhen_futian',
          age: 20 + i,
          basketballAge: 2 + i,
          gender: i % 2 === 0 ? 'male' : 'female',
          height: 170 + i * 5,
          positions: i % 2 === 0 ? ['PG'] : ['SF'],
        } as any);

        expect(result.user.userType).toBe('player');
        playerUserIds.push(result.user.id);
      }

      expect(playerUserIds.length).toBe(6);
    });

    it('should login with correct credentials', async () => {
      const phone = nextPhone();
      await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'LoginTest',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      } as any);

      const result = await authService.login({
        phone,
        password: 'TestPass123!',
      });

      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const phone = nextPhone();
      await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'WrongPass',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      } as any);

      await expect(
        authService.login({ phone, password: 'WrongPass!' }),
      ).rejects.toThrow('手机号或密码错误');
    });

    it('should reject duplicate registration', async () => {
      const phone = nextPhone();
      await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'DupTest',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      } as any);

      await expect(
        authService.register({
          phone,
          password: 'TestPass123!',
          nickname: 'DupTest2',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        } as any),
      ).rejects.toThrow('该手机号已被注册');
    });
  });

  describe('Phase 3: Venue & Format Setup', () => {
    it('should create a venue with time slots', async () => {
      const venue = await venueService.create(managerUserId, {
        name: 'Futian Basketball Court',
        address: 'Shenzhen Futian District',
        pricePerHour: 200,
        courtCount: 2,
        regionCode: 'shenzhen_futian',
        floorMaterial: 'wood',
        lighting: 'led',
        courtType: 'indoor',
      });

      expect(venue.id).toBeDefined();
      expect(venue.managerId).toBe(managerUserId);
      venueId = venue.id;

      // Create time slots for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const slotDate = tomorrow.toISOString().split('T')[0];

      const slots = await venueService.createTimeSlots(venueId, managerUserId, [
        { slotDate, startTime: '14:00:00', endTime: '16:00:00' },
        { slotDate, startTime: '16:00:00', endTime: '18:00:00' },
        { slotDate, startTime: '18:00:00', endTime: '20:00:00' },
      ]);

      expect(slots.length).toBe(3);
      expect(slots[0].isBooked).toBe(false);
    });

    it('should reject time slot overlap within batch', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const slotDate = tomorrow.toISOString().split('T')[0];

      // Test that overlapping slots within the same batch are rejected
      await expect(
        venueService.createTimeSlots(venueId, managerUserId, [
          { slotDate, startTime: '10:00:00', endTime: '12:00:00' },
          { slotDate, startTime: '11:30:00', endTime: '13:00:00' },
        ]),
      ).rejects.toThrow('时段重叠');
    });

    it('should create a 3v3 format', async () => {
      const formatRepo = dataSource.getRepository(Format);
      const format = formatRepo.create({
        name: '3v3 Standard',
        formatType: 'short',
        teamSize: 3,
        teamCountMin: 2,
        teamCountMax: 4,
        durationHours: 2,
      });
      const saved = await formatRepo.save(format);
      formatId = saved.id;
      expect(saved.teamSize).toBe(3);
      expect(saved.teamCountMin).toBe(2);
    });

    it('should setup system parameters', async () => {
      const paramRepo = dataSource.getRepository(SystemParam);

      // Upsert to avoid unique constraint violations on re-runs
      await paramRepo.upsert(
        {
          paramKey: 'match_threshold_params',
          paramValue: {
            base_threshold: 20.0,
            min_threshold: 5.0,
            intention_count_factor: 0.5,
          },
          description: 'Matching engine threshold parameters',
        },
        ['paramKey'],
      );

      await paramRepo.upsert(
        {
          paramKey: 'group_chat_expiry_days',
          paramValue: { expiry_days: 7 },
          description: 'Group chat expiry configuration',
        },
        ['paramKey'],
      );

      const params = await paramRepo.find();
      expect(params.length).toBe(2);
    });
  });

  describe('Phase 4: Intention Submission', () => {
    it('should allow players to submit intentions', async () => {
      // Get player IDs from registered users
      const playerRepo = dataSource.getRepository(Player);
      const players = await playerRepo.find({
        where: playerUserIds.map((id) => ({ userId: id })),
      });

      expect(players.length).toBe(6);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);

      for (let i = 0; i < players.length; i++) {
        const intention = await intentionService.create(players[i].id, {
          startTime: tomorrow.toISOString(),
          durationMinutes: 120,
          acceptableWaitMinutes: 30,
          venueIds: [{ venueId, priority: 1 }],
          formatIds: [{ formatId, priority: 1 }],
        });

        expect(intention.status).toBe('pending');
        expect(intention.venues[0].venueId).toBe(venueId);
        expect(intention.formats[0].formatId).toBe(formatId);
      }
    });

    it('should reject intention with start time less than 1 hour away', async () => {
      const playerRepo = dataSource.getRepository(Player);
      const players = await playerRepo.find({
        where: { userId: playerUserIds[0] },
      });

      const tooSoon = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      await expect(
        intentionService.create(players[0].id, {
          startTime: tooSoon.toISOString(),
          durationMinutes: 120,
          acceptableWaitMinutes: 30,
          venueIds: [{ venueId, priority: 1 }],
          formatIds: [{ formatId, priority: 1 }],
        }),
      ).rejects.toThrow('比赛开始时间必须至少提前 1 小时');
    });

    it('should reject overlapping intentions for same player', async () => {
      const playerRepo = dataSource.getRepository(Player);
      const players = await playerRepo.find({
        where: { userId: playerUserIds[0] },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 30, 0, 0); // Overlaps with 14:00-16:00

      await expect(
        intentionService.create(players[0].id, {
          startTime: tomorrow.toISOString(),
          durationMinutes: 120,
          acceptableWaitMinutes: 30,
          venueIds: [{ venueId, priority: 1 }],
          formatIds: [{ formatId, priority: 1 }],
        }),
      ).rejects.toThrow('时间重叠');
    });
  });

  describe('Phase 5: Matching Engine', () => {
    it('should run matching engine and create a match', async () => {
      const result = await matchingEngineService.runMatching('shenzhen_futian');

      expect(result.intentionsScanned).toBe(6);
      expect(result.matchesCreated).toBe(1);
      expect(result.matchesFailed).toBe(0);
    });

    it('should have created match with correct structure', async () => {
      const matchRepo = dataSource.getRepository(Match);
      const matches = await matchRepo.find({
        where: { status: 'pending_confirmation' },
      });

      expect(matches.length).toBe(1);
      matchId = matches[0].id;
      expect(matches[0].venueId).toBe(venueId);
      expect(matches[0].formatId).toBe(formatId);
      expect(matches[0].totalPlayers).toBe(6);
    });

    it('should have created match players with invited status', async () => {
      const mpRepo = dataSource.getRepository(MatchPlayer);
      const matchPlayers = await mpRepo.find({
        where: { matchId },
      });

      expect(matchPlayers.length).toBe(6);
      expect(matchPlayers.every((mp) => mp.status === 'invited')).toBe(true);
    });

    it('should have created match teams via snake draft', async () => {
      const mtRepo = dataSource.getRepository(MatchTeam);
      const teams = await mtRepo.find({
        where: { matchId },
      });

      expect(teams.length).toBeGreaterThanOrEqual(2);
    });

    it('should have booked venue time slot', async () => {
      const slotRepo = dataSource.getRepository(VenueTimeSlot);
      const slots = await slotRepo.find({ where: { venueId } });

      const bookedSlot = slots.find((s) => s.isBooked);
      expect(bookedSlot).toBeDefined();
      expect(bookedSlot!.matchId).toBe(matchId);
    });

    it('should update intention status to matched', async () => {
      const intentionRepo = dataSource.getRepository(Intention);
      const intentions = await intentionRepo.find({
        where: { status: 'matched' },
      });

      // At least the 6 original intentions should be matched
      expect(intentions.length).toBeGreaterThanOrEqual(6);
      // All matched intentions should reference valid matches
      expect(intentions.every((i) => i.matchId !== null)).toBe(true);
    });

    it('should add job to BullMQ matching queue', async () => {
      const job = await matchingQueue.add('match-region', {
        regionCode: 'shenzhen_futian',
      });

      expect(job.id).toBeDefined();

      // Wait for job to complete
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(async () => {
          const state = await job.getState();
          if (state === 'completed' || state === 'failed') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });

      const jobState = await job.getState();
      expect(jobState).toBe('completed');
    });
  });

  describe('Phase 6: Match Confirmation', () => {
    it('should allow players to confirm participation', async () => {
      expect(matchId).toBeDefined();

      const mpRepo = dataSource.getRepository(MatchPlayer);
      const matchPlayers = await mpRepo.find({ where: { matchId } });

      expect(matchPlayers.length).toBeGreaterThan(0);

      // Confirm all players
      for (const mp of matchPlayers) {
        const result = await matchConfirmationService.confirmParticipation(
          matchId,
          mp.playerId,
        );

        expect(result.success).toBe(true);
        expect(result.status).toBe('confirmed');
      }
    });

    it('should have updated match status after all confirmations', async () => {
      expect(matchId).toBeDefined();

      const matchRepo = dataSource.getRepository(Match);
      const match = await matchRepo.findOne({ where: { id: matchId } });

      expect(match).toBeDefined();
      // Match should be confirmed since all players confirmed
      expect(match!.status).toBe('confirmed');
    });

    it('should create mock payment orders', async () => {
      const orderRepo = dataSource.getRepository(MockOrder);
      const orders = await orderRepo.find();

      expect(orders.length).toBeGreaterThan(0);
      expect(orders.every((o) => o.status === 'paid')).toBe(true);
    });

    it('should handle payment callback idempotently', async () => {
      const orderRepo = dataSource.getRepository(MockOrder);
      const orders = await orderRepo.find();

      expect(orders.length).toBeGreaterThan(0);
      const order = orders[0];

      // First callback
      const result1 = await matchConfirmationService.handlePaymentCallback({
        orderNo: order.orderNo,
        status: 'success',
      });

      expect(result1.success).toBe(true);

      // Second callback (idempotent)
      const result2 = await matchConfirmationService.handlePaymentCallback({
        orderNo: order.orderNo,
        status: 'success',
      });

      expect(result2.success).toBe(true);
      // Should indicate already processed
    });
  });

  describe('Phase 7: Group Chat & Messaging', () => {
    it('should allow confirmed players to send messages', async () => {
      expect(matchId).toBeDefined();

      const playerRepo = dataSource.getRepository(Player);
      const players = await playerRepo.find({
        where: playerUserIds.slice(0, 2).map((id) => ({ userId: id })),
      });

      for (let i = 0; i < players.length; i++) {
        const message = await messageService.sendMessage(
          matchId,
          players[i].userId,
          {
            content: `Hello from player ${i + 1}!`,
            messageType: 'text',
          },
        );

        expect(message.id).toBeDefined();
        expect(message.content).toBe(`Hello from player ${i + 1}!`);
        expect(message.messageType).toBe('text');
      }
    });

    it('should allow system messages', async () => {
      expect(matchId).toBeDefined();

      const message = await messageService.sendSystemMessage(
        matchId,
        '比赛即将开始，请准时到场',
      );

      expect(message.id).toBeDefined();
      expect(message.messageType).toBe('system');
      expect(message.senderId).toBeNull();
    });

    it('should retrieve message history', async () => {
      expect(matchId).toBeDefined();

      const playerRepo = dataSource.getRepository(Player);
      const player = await playerRepo.findOne({
        where: { userId: playerUserIds[0] },
      });

      const history = await messageService.getMessageHistory(
        matchId,
        player!.userId,
        { page: 1, pageSize: 10 },
      );

      expect(history.total).toBeGreaterThanOrEqual(3); // 2 player messages + 1 system message
      expect(history.list.length).toBeGreaterThan(0);
    });

    it('should reject messages from non-participants', async () => {
      expect(matchId).toBeDefined();

      // Create a new user who is not part of the match
      const phone = nextPhone();
      const newUser = await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'Outsider',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      } as any);

      await expect(
        messageService.sendMessage(matchId, newUser.user.id, {
          content: 'I should not be able to send this',
          messageType: 'text',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Phase 8: Notifications', () => {
    it('should create notifications for match events', async () => {
      const notifRepo = dataSource.getRepository(Notification);

      // Wait a bit for async notifications
      await new Promise((resolve) => setTimeout(resolve, 500));

      const notifications = await notifRepo.find();

      // Should have notifications from match confirmation
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 9: Redis Token Management', () => {
    it('should store refresh token in Redis', async () => {
      const phone = nextPhone();
      const result = await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'RedisTest',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      } as any);

      const redisClient = redisService.getClient();
      const keys = await redisClient.keys('basketball:refresh:*');

      expect(keys.length).toBeGreaterThan(0);
    });

    it('should invalidate tokens on logout', async () => {
      const phone = nextPhone();
      const result = await authService.register({
        phone,
        password: 'TestPass123!',
        nickname: 'LogoutTest',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      } as any);

      await authService.logout(result.user.id);

      // After logout, refresh tokens should be cleaned up
      const redisClient = redisService.getClient();
      const userIndexKey = `basketball:user_refresh:${result.user.id}`;
      const members = await redisClient.smembers(userIndexKey);
      expect(members.length).toBe(0);
    });
  });

  describe('Phase 10: Data Integrity & Cleanup', () => {
    it('should maintain referential integrity across all entities', async () => {
      // Verify match references
      const matchRepo = dataSource.getRepository(Match);
      const match = await matchRepo.findOne({
        where: { id: matchId },
        relations: ['matchPlayers', 'matchTeams'],
      });

      expect(match).toBeDefined();
      if (!match) return;
      const matchPlayers = await match.matchPlayers;
      const matchTeams = await match.matchTeams;
      expect(matchPlayers.length).toBeGreaterThan(0);
      expect(matchTeams.length).toBeGreaterThanOrEqual(2);

      // Verify venue still exists
      const venueRepo = dataSource.getRepository(Venue);
      const venue = await venueRepo.findOne({ where: { id: venueId } });
      expect(venue).toBeDefined();
    });

    it('should allow venue manager to query their venues', async () => {
      const venues = await venueService.findAll({
        page: 1,
        pageSize: 10,
      });

      expect(venues.total).toBeGreaterThanOrEqual(1);
      expect(venues.list.some((v) => v.id === venueId)).toBe(true);
    });
  });
});
