import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/services/redis.service';

/**
 * IntentionController E2E 测试
 *
 * 验证意向接口的完整链路：
 * 1. JWT 认证与角色授权（仅球员可操作）
 * 2. 意向 CRUD（提交、查询、修改、取消）
 * 3. 业务规则校验（提前1小时、时长范围、时间重叠）
 * 4. 全局响应格式（TransformInterceptor + HttpExceptionFilter）
 */
describe('IntentionController (e2e)', () => {
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
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
  });

  /**
   * 数据库清理（按依赖逆序）
   */
  async function cleanDatabase(ds: DataSource): Promise<void> {
    const tables = [
      'intention_venues',
      'intention_formats',
      'intentions',
      'venue_time_slots',
      'venues',
      'player_shooting_records',
      'player_positions',
      'players',
      'venue_managers',
      'users',
    ];
    for (const table of tables) {
      try {
        await ds.query(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (err: any) {
        if (err.code !== '42P01') {
          throw err;
        }
      }
    }
  }

  // phoneCounter 跨测试累加以保证全局唯一性（不在 beforeEach 中重置）
  let phoneCounter = 0;

  function nextPhone(): string {
    phoneCounter += 1;
    return `1390000${String(phoneCounter).padStart(4, '0')}`;
  }

  /**
   * 辅助：动态生成未来 2 小时的时间（ISO 8601）
   */
  function futureTime(hoursAhead: number = 2): string {
    return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
  }

  /**
   * 辅助：注册球员并登录
   */
  async function registerAndLoginPlayer(overrides: Record<string, unknown> = {}): Promise<{
    accessToken: string;
    userId: number;
    playerId: number;
  }> {
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
    const playerId = playerResult[0]?.id ?? 0;

    return {
      accessToken: loginRes.body.data.tokens.accessToken,
      userId,
      playerId,
    };
  }

  /**
   * 辅助：注册场地方并登录
   */
  async function registerAndLoginManager(): Promise<{
    accessToken: string;
    userId: number;
  }> {
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
   * 辅助：直接插入场地数据（先创建场地方用户和场地方记录）
   */
  async function createVenueDirectly(regionCode: string = 'shenzhen_futian'): Promise<number> {
    // 创建用户
    const userResult = await dataSource.query(
      `INSERT INTO "users" ("phone_hash", "phone", "password_hash", "nickname", "user_type", "status")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [`hash_venue_${Date.now()}_${Math.random()}`, `encrypted_phone_${Date.now()}_${Math.random()}`, 'hashedpw', 'VenueOwner', 'venue_manager', 'active'],
    );
    const userId = userResult[0].id;

    // 创建场地方
    const managerResult = await dataSource.query(
      `INSERT INTO "venue_managers" ("user_id", "company_name", "contact_name", "contact_phone")
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, 'Test Co.', '张三', '15000000001'],
    );
    const managerId = managerResult[0].id;

    // 创建场地
    const result = await dataSource.query(
      `INSERT INTO "venues" ("manager_id", "name", "address", "price_per_hour", "court_count", "region_code", "status")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [managerId, 'Test Court', '深圳市福田区测试路1号', 200, 2, regionCode, 'active'],
    );
    return result[0].id;
  }

  /**
   * 辅助：直接插入赛制数据
   */
  async function createFormatDirectly(): Promise<number> {
    const result = await dataSource.query(
      `INSERT INTO "formats" ("name", "format_type", "team_size", "team_count_min", "team_count_max")
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['5v5 全场', 'long', 5, 2, 2],
    );
    return result[0].id;
  }

  /**
   * 辅助：创建意向
   */
  function createIntention(
    accessToken: string,
    venueId: number,
    formatId: number,
    overrides: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/intentions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        startTime: futureTime(2),
        durationMinutes: 120,
        venueIds: [{ venueId, priority: 1 }],
        formatIds: [{ formatId, priority: 1 }],
        ...overrides,
      });
  }

  // ============================================================
  // 全局响应格式
  // ============================================================

  describe('Global Response Format', () => {
    it('should wrap successful creation in ApiResponse format', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const res = await createIntention(accessToken, venueId, formatId).expect(201);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('status', 'pending');
    });

    it('should wrap validation errors in unified error format', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}) // empty body
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });
  });

  // ============================================================
  // 认证与授权
  // ============================================================

  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .send({
          startTime: futureTime(2),
          durationMinutes: 120,
          venueIds: [{ venueId: 1, priority: 1 }],
          formatIds: [{ formatId: 1, priority: 1 }],
        })
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });

    it('should reject venue_manager user with 403', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: futureTime(2),
          durationMinutes: 120,
          venueIds: [{ venueId: 1, priority: 1 }],
          formatIds: [{ formatId: 1, priority: 1 }],
        })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
      expect(res.body.message).toContain('球员');
    });
  });

  // ============================================================
  // POST /api/v1/intentions
  // ============================================================

  describe('POST /api/v1/intentions', () => {
    it('should create intention with valid data', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const res = await createIntention(accessToken, venueId, formatId).expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('playerId');
      expect(res.body.data).toHaveProperty('status', 'pending');
      expect(res.body.data).toHaveProperty('durationMinutes', 120);
      expect(res.body.data.venues).toHaveLength(1);
      expect(res.body.data.venues[0]).toHaveProperty('venueId', venueId);
      expect(res.body.data.formats).toHaveLength(1);
      expect(res.body.data.formats[0]).toHaveProperty('formatId', formatId);
    });

    it('should reject startTime less than 1 hour ahead', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const res = await createIntention(accessToken, venueId, formatId, {
        startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min ahead
      }).expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body.message).toContain('提前 1 小时');
    });

    it('should reject durationMinutes < 120', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const res = await createIntention(accessToken, venueId, formatId, {
        durationMinutes: 60,
      }).expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject durationMinutes > 360', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const res = await createIntention(accessToken, venueId, formatId, {
        durationMinutes: 480,
      }).expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject empty venueIds', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      await createFormatDirectly();

      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: futureTime(2),
          durationMinutes: 120,
          venueIds: [],
          formatIds: [{ formatId: 1, priority: 1 }],
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject more than 3 venueIds', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: futureTime(2),
          durationMinutes: 120,
          venueIds: [
            { venueId: 1, priority: 1 },
            { venueId: 2, priority: 2 },
            { venueId: 3, priority: 3 },
            { venueId: 4, priority: 4 },
          ],
          formatIds: [{ formatId: 1, priority: 1 }],
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject empty formatIds', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();

      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: futureTime(2),
          durationMinutes: 120,
          venueIds: [{ venueId, priority: 1 }],
          formatIds: [],
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject more than 3 formatIds', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();

      const res = await request(app.getHttpServer())
        .post('/api/v1/intentions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: futureTime(2),
          durationMinutes: 120,
          venueIds: [{ venueId, priority: 1 }],
          formatIds: [
            { formatId: 1, priority: 1 },
            { formatId: 2, priority: 2 },
            { formatId: 3, priority: 3 },
            { formatId: 4, priority: 4 },
          ],
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject non-existent venueId with 404', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const formatId = await createFormatDirectly();

      const res = await createIntention(accessToken, 99999, formatId).expect(404);

      expect(res.body).toHaveProperty('code', 404);
      expect(res.body.message).toContain('场地不存在');
    });

    it('should reject non-existent formatId with 404', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();

      const res = await createIntention(accessToken, venueId, 99999).expect(404);

      expect(res.body).toHaveProperty('code', 404);
      expect(res.body.message).toContain('赛制不存在');
    });

    it('should reject overlapping intention with 409', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const startTime = futureTime(3);

      // 创建第一个意向
      await createIntention(accessToken, venueId, formatId, { startTime }).expect(201);

      // 尝试创建重叠意向
      const res = await createIntention(accessToken, venueId, formatId, { startTime }).expect(409);

      expect(res.body).toHaveProperty('code', 409);
      expect(res.body.message).toContain('重叠');
    });
  });

  // ============================================================
  // GET /api/v1/intentions/my
  // ============================================================

  describe('GET /api/v1/intentions/my', () => {
    it('should return my intentions list', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      await createIntention(accessToken, venueId, formatId).expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/intentions/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data).toHaveProperty('page', 1);
      expect(res.body.data).toHaveProperty('total', 1);
    });

    it('should support status filter', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      await createIntention(accessToken, venueId, formatId).expect(201);

      // filter cancelled (should be empty)
      const res = await request(app.getHttpServer())
        .get('/api/v1/intentions/my?status=cancelled')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('should support pagination', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      // 创建两个不重叠的意向
      await createIntention(accessToken, venueId, formatId, {
        startTime: futureTime(3),
      }).expect(201);
      await createIntention(accessToken, venueId, formatId, {
        startTime: futureTime(6),
      }).expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/intentions/my?page=1&pageSize=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.pageSize).toBe(1);
    });

    it('should return empty list for new player', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/intentions/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });
  });

  // ============================================================
  // PUT /api/v1/intentions/:id
  // ============================================================

  describe('PUT /api/v1/intentions/:id', () => {
    it('should update pending intention', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const createRes = await createIntention(accessToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .put(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMinutes: 180 })
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('durationMinutes', 180);
    });

    it('should reject update for non-existent intention with 404', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .put('/api/v1/intentions/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMinutes: 180 })
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });

    it('should reject update by non-owner with 403', async () => {
      const { accessToken: ownerToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const createRes = await createIntention(ownerToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      const { accessToken: otherToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .put(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ durationMinutes: 180 })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should reject update causing time overlap with 409', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const startTime1 = futureTime(3);
      const startTime2 = futureTime(6);

      await createIntention(accessToken, venueId, formatId, { startTime: startTime1 }).expect(201);
      const createRes2 = await createIntention(accessToken, venueId, formatId, { startTime: startTime2 }).expect(201);
      const intentionId2 = createRes2.body.data.id;

      // 修改第二个意向的时间使其与第一个重叠
      const res = await request(app.getHttpServer())
        .put(`/api/v1/intentions/${intentionId2}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startTime: startTime1 })
        .expect(409);

      expect(res.body).toHaveProperty('code', 409);
      expect(res.body.message).toContain('重叠');
    });
  });

  // ============================================================
  // DELETE /api/v1/intentions/:id
  // ============================================================

  describe('DELETE /api/v1/intentions/:id', () => {
    it('should cancel pending intention and return cancelled intention', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const createRes = await createIntention(accessToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id', intentionId);
      expect(res.body.data).toHaveProperty('status', 'cancelled');
    });

    it('should reject cancel by non-owner with 403', async () => {
      const { accessToken: ownerToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const createRes = await createIntention(ownerToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      const { accessToken: otherToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should reject cancel for non-existent intention with 404', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .delete('/api/v1/intentions/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });

    it('should reject cancel for already cancelled intention with 400', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const createRes = await createIntention(accessToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      // First cancel
      await request(app.getHttpServer())
        .delete(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Second cancel should fail
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body.message).toContain('不可取消');
    });
  });

  // ============================================================
  // 空 DTO 校验
  // ============================================================

  describe('Empty DTO validation', () => {
    it('should reject update with empty body (no fields provided)', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      const createRes = await createIntention(accessToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .put(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body.message).toContain('至少需要提供一个更新字段');
    });
  });

  // ============================================================
  // 边界值校验（ParseIntPipe + 状态校验）
  // ============================================================

  describe('Boundary validation', () => {
    it('should reject update with non-numeric id (ParseIntPipe) with 400', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .put('/api/v1/intentions/abc')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMinutes: 120 })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject delete with non-numeric id (ParseIntPipe) with 400', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .delete('/api/v1/intentions/abc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject update for cancelled intention with 400', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      // 创建并取消意向
      const createRes = await createIntention(accessToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 尝试更新已取消的意向
      const res = await request(app.getHttpServer())
        .put(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMinutes: 180 })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body.message).toContain('仅 pending 状态的意向可修改');
    });
  });

  // ============================================================
  // 完整流程
  // ============================================================

  describe('End-to-End Intention Flow', () => {
    it('should complete full create -> list -> update -> cancel flow', async () => {
      const { accessToken } = await registerAndLoginPlayer();
      const venueId = await createVenueDirectly();
      const formatId = await createFormatDirectly();

      // 1. 提交意向
      const createRes = await createIntention(accessToken, venueId, formatId).expect(201);
      const intentionId = createRes.body.data.id;
      expect(createRes.body.data.status).toBe('pending');

      // 2. 查询列表
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/intentions/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(listRes.body.data.list).toHaveLength(1);
      expect(listRes.body.data.list[0].id).toBe(intentionId);

      // 3. 修改意向
      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ durationMinutes: 240 })
        .expect(200);
      expect(updateRes.body.data.durationMinutes).toBe(240);

      // 4. 取消意向
      const cancelRes = await request(app.getHttpServer())
        .delete(`/api/v1/intentions/${intentionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(cancelRes.body.data.status).toBe('cancelled');

      // 5. 确认列表中状态已更新
      const listRes2 = await request(app.getHttpServer())
        .get('/api/v1/intentions/my?status=cancelled')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(listRes2.body.data.list).toHaveLength(1);
      expect(listRes2.body.data.list[0].status).toBe('cancelled');
    });
  });
});
