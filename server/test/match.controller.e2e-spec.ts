import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/services/redis.service';
import {
  createTestMatch,
  createTestMatchPlayer,
  createTestMatchTeam,
  createTestMatchMessage,
  createTestFormat,
} from './factories/match.factory';

/**
 * MatchController E2E 测试
 *
 * 验证比赛接口的完整链路：
 * 1. JWT 认证与角色授权（仅球员可操作）
 * 2. 比赛列表查询（分页、状态筛选）
 * 3. 比赛详情（含队伍和球员列表）
 * 4. 确认/拒绝参赛（含幂等性、并发）
 * 5. 群聊消息收发
 * 6. 全局响应格式（TransformInterceptor + HttpExceptionFilter）
 */
describe('MatchController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let redisService: RedisService;

  beforeAll(async () => {
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
    redisService = app.get(RedisService);

    await cleanDatabase(dataSource);
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
    // 插入 system_params: group_chat_expiry_days
    await dataSource.query(
      `INSERT INTO "system_params" ("param_key", "param_value", "description")
       VALUES ('group_chat_expiry_days', '{"expiry_days": 7}'::jsonb, 'Group chat expiry days')
       ON CONFLICT ("param_key") DO UPDATE SET "param_value" = EXCLUDED."param_value"`,
    );
  });

  async function cleanDatabase(ds: DataSource): Promise<void> {
    const rows = await ds.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    if (rows.length === 0) return;
    const tableList = rows.map((r: { tablename: string }) => `"${r.tablename}"`).join(', ');
    await ds.query(`TRUNCATE TABLE ${tableList} CASCADE`);
  }

  let phoneCounter = 0;
  function nextPhone(): string {
    phoneCounter += 1;
    return `1390000${String(phoneCounter).padStart(4, '0')}`;
  }

  async function registerAndLoginPlayer(
    overrides: Record<string, unknown> = {},
  ): Promise<{ accessToken: string; userId: number; playerId: number }> {
    const phone = nextPhone();
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phone,
        password: 'Password123',
        nickname: 'TestPlayer',
        userType: 'player',
        birthDate: '1999-06-10',
        startPlayingDate: '2019-03',
        gender: 'male',
        height: 180,
        ...overrides,
      })
      .expect(201);

    const userId = registerRes.body.data.user.id;
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Password123' })
      .expect(200);

    const playerResult = await dataSource.query(
      'SELECT id FROM "players" WHERE "user_id" = $1 LIMIT 1',
      [userId],
    );
    const playerId = Number(playerResult[0]?.id ?? 0);

    return { accessToken: loginRes.body.data.tokens.accessToken, userId, playerId };
  }

  async function registerAndLoginManager(): Promise<{ accessToken: string; userId: number }> {
    const phone = nextPhone();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phone,
        password: 'Password123',
        nickname: 'TestManager',
        userType: 'venue_manager',
        companyName: 'Test Sports Co.',
        contactName: '张三',
        contactPhone: '15000150001',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'Password123' })
      .expect(200);

    return {
      accessToken: loginRes.body.data.tokens.accessToken,
      userId: loginRes.body.data.user?.id ?? 0,
    };
  }

  /**
   * 创建比赛 + 多个 match_player 关联
   * 返回 matchId 和各球员的 matchPlayer 记录
   */
  async function createMatchWithPlayers(
    playerIds: number[],
    matchOverrides: Record<string, unknown> = {},
  ): Promise<number> {
    const futureStart = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
    const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);

    const match = await createTestMatch(dataSource, {
      startTime: futureStart,
      endTime: futureEnd,
      teamCount: 2,
      playersPerTeam: Math.ceil(playerIds.length / 2),
      requiredPlayers: playerIds.length,
      depositAmount: '50.00',
      status: 'pending_players',
      ...matchOverrides,
    });

    // 分配队伍：前一半队伍1，后一半队伍2
    for (let i = 0; i < playerIds.length; i++) {
      await createTestMatchPlayer(dataSource, match.id, playerIds[i], {
        teamNumber: i < Math.ceil(playerIds.length / 2) ? 1 : 2,
        status: 'invited',
      });
    }

    // 创建队伍
    await createTestMatchTeam(dataSource, match.id, 1, { teamName: 'Team A' });
    await createTestMatchTeam(dataSource, match.id, 2, { teamName: 'Team B' });

    return match.id;
  }

  // ============================================================
  // 认证与授权
  // ============================================================

  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });

    it('should reject venue_manager user with 403', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });
  });

  // ============================================================
  // GET /api/v1/matches/my
  // ============================================================

  describe('GET /api/v1/matches/my', () => {
    it('should return match list for player', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my')
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('page', 1);
      expect(res.body.data).toHaveProperty('total', 1);
      expect(res.body.data.list[0]).toHaveProperty('id', Number(matchId));
    });

    it('should filter by status', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my?status=confirmed')
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(0);
    });

    it('should return empty list for new player', async () => {
      const p = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my')
        .set('Authorization', `Bearer ${p.accessToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('should support pagination', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      await createMatchWithPlayers([p1.playerId, p2.playerId]);
      await createMatchWithPlayers([p1.playerId, p2.playerId], {
        startTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my?page=1&pageSize=1')
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.pageSize).toBe(1);
    });

    it('should include playerStatus and teamNumber in response', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my')
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.data.list[0]).toHaveProperty('playerStatus', 'invited');
      expect(res.body.data.list[0]).toHaveProperty('teamNumber');
    });

    it('should wrap response in ApiResponse format', async () => {
      const p = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/matches/my')
        .set('Authorization', `Bearer ${p.accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
    });
  });

  // ============================================================
  // GET /api/v1/matches/:id
  // ============================================================

  describe('GET /api/v1/matches/:id', () => {
    it('should return match detail with teams and players', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id', Number(matchId));
      expect(res.body.data).toHaveProperty('teams');
      expect(res.body.data.teams).toHaveLength(2);
      expect(res.body.data).toHaveProperty('players');
      expect(res.body.data.players.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data).toHaveProperty('playerStatus', 'invited');
    });

    it('should return 404 for non-participant', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();
      const outsider = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent match', async () => {
      const p = await registerAndLoginPlayer();

      await request(app.getHttpServer())
        .get('/api/v1/matches/99999')
        .set('Authorization', `Bearer ${p.accessToken}`)
        .expect(404);
    });

    it('should include team info with teamNumber and teamName', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      const team = res.body.data.teams[0];
      expect(team).toHaveProperty('teamNumber');
      expect(team).toHaveProperty('teamName');
    });

    it('should include player list with nickname', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      const players = res.body.data.players;
      expect(players.length).toBeGreaterThanOrEqual(2);
      // 每个球员应有 playerId 和 status
      players.forEach((p: any) => {
        expect(p).toHaveProperty('playerId');
        expect(p).toHaveProperty('status');
      });
    });
  });

  // ============================================================
  // POST /api/v1/matches/:id/confirm
  // ============================================================

  describe('POST /api/v1/matches/:id/confirm', () => {
    it('should confirm participation for invited player', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('status', 'confirmed');
    });

    it('should be idempotent: repeated confirm returns 201 with alreadyConfirmed', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      // First confirm
      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      // Second confirm — should not throw 409
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      expect(res.body.data).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('alreadyConfirmed', true);
    });

    it('should return 409 for declined player', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      // Decline first
      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/decline`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      // Try to confirm after decline
      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(409);
    });

    it('should return 404 for non-participant', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();
      const outsider = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent match', async () => {
      const p = await registerAndLoginPlayer();

      await request(app.getHttpServer())
        .post('/api/v1/matches/99999/confirm')
        .set('Authorization', `Bearer ${p.accessToken}`)
        .expect(404);
    });

    it('should handle concurrent confirm attempts (optimistic lock)', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      // Both players confirm concurrently
      const [r1, r2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/matches/${matchId}/confirm`)
          .set('Authorization', `Bearer ${p1.accessToken}`),
        request(app.getHttpServer())
          .post(`/api/v1/matches/${matchId}/confirm`)
          .set('Authorization', `Bearer ${p2.accessToken}`),
      ]);

      // Both should succeed (201) — different players, no conflict
      expect([r1.status, r2.status]).toEqual([201, 201]);
    });

    it('should change match status to confirmed when all players confirm', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      // Create format with teamCountMin=2 so 2 players suffice
      const format = await createTestFormat(dataSource, { teamCountMin: 2 });
      const matchId = await createMatchWithPlayers(
        [p1.playerId, p2.playerId],
        { formatId: format.id },
      );

      // First player confirms
      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      // Second (last) player confirms — match should transition to 'confirmed'
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p2.accessToken}`)
        .expect(201);

      expect(res.body.data).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('matchStatus', 'confirmed');
    });
  });

  // ============================================================
  // POST /api/v1/matches/:id/decline
  // ============================================================

  describe('POST /api/v1/matches/:id/decline', () => {
    it('should decline participation for invited player', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/decline`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('message', '已拒绝参赛');
    });

    it('should return 409 for already confirmed player', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/decline`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(409);
    });

    it('should return 404 for non-participant', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();
      const outsider = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/decline`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(404);
    });
  });

  // ============================================================
  // GET /api/v1/matches/:id/messages
  // ============================================================

  describe('GET /api/v1/matches/:id/messages', () => {
    it('should return message history for participant', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('page');
    });

    it('should return 403 for non-participant', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();
      const outsider = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });

    it('should return existing messages', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      // 插入测试消息（使用 p1.userId 作为 sender）
      await createTestMatchMessage(dataSource, matchId, p1.userId, {
        content: 'Hello team!',
        messageType: 'text',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.data.list.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // POST /api/v1/matches/:id/messages
  // ============================================================

  describe('POST /api/v1/matches/:id/messages', () => {
    it('should send text message for participant', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .send({ content: 'Hello team!', messageType: 'text' })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('content', 'Hello team!');
    });

    it('should return 403 for non-participant sender', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();
      const outsider = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ content: 'Hello' })
        .expect(403);
    });

    it('should reject empty content with 400', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .send({ content: '' })
        .expect(400);
    });

    it('should reject content exceeding 1000 chars with 400', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const longContent = 'x'.repeat(1001);
      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .send({ content: longContent })
        .expect(400);
    });

    it('should be queryable after sending', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .send({ content: 'Test message for query' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .expect(200);

      expect(res.body.data.list.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.list.find(
        (m: any) => m.content === 'Test message for query',
      );
      expect(found).toBeDefined();
    });

    it('should accept HTML special characters in content', async () => {
      const p1 = await registerAndLoginPlayer();
      const p2 = await registerAndLoginPlayer();

      const matchId = await createMatchWithPlayers([p1.playerId, p2.playerId]);

      const htmlContent = '<script>alert("xss")</script>';
      const res = await request(app.getHttpServer())
        .post(`/api/v1/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${p1.accessToken}`)
        .send({ content: htmlContent })
        .expect(201);

      // 消息应被存储（前端应以纯文本渲染，不做 HTML 解析）
      expect(res.body.data).toHaveProperty('content', htmlContent);
    });
  });
});
