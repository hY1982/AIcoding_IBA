import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/services/redis.service';

/**
 * VenueController E2E 测试
 *
 * 验证场地接口的完整链路：
 * 1. JWT 认证与授权（player vs venue_manager 角色区分）
 * 2. 场地 CRUD（创建、列表、详情、更新、删除）
 * 3. 时段管理（查询、创建）
 * 4. 权限验证（仅场地方可管理场地，球员可浏览）
 * 5. 全局响应格式（TransformInterceptor + HttpExceptionFilter）
 */
describe('VenueController (e2e)', () => {
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

  async function cleanDatabase(ds: DataSource): Promise<void> {
    const tables = [
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

  let phoneCounter = 0;

  function nextPhone(): string {
    phoneCounter += 1;
    return `1380000${String(phoneCounter).padStart(4, '0')}`;
  }

  /**
   * 辅助函数：注册场地方并登录
   */
  async function registerAndLoginManager(overrides: Record<string, unknown> = {}): Promise<{
    accessToken: string;
    userId: number;
    managerId: number;
  }> {
    const phone = nextPhone();
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        phone,
        password: 'Password123',
        nickname: 'TestManager',
        userType: 'venue_manager',
        companyName: 'Test Sports Co.',
        contactName: '张三',
        contactPhone: '15000150001',
        ...overrides,
      })
      .expect(201);

    const userId = registerRes.body.data.user.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phone,
        password: 'Password123',
      })
      .expect(200);

    const managerResult = await dataSource.query(
      'SELECT id FROM "venue_managers" WHERE "user_id" = $1 LIMIT 1',
      [userId],
    );
    const managerId = managerResult[0]?.id ?? 0;

    return {
      accessToken: loginRes.body.data.tokens.accessToken,
      userId,
      managerId,
    };
  }

  /**
   * 辅助函数：注册球员并登录
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
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
        ...overrides,
      })
      .expect(201);

    const userId = registerRes.body.data.user.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        phone,
        password: 'Password123',
      })
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
   * 辅助函数：创建场地
   */
  async function createVenue(
    accessToken: string,
    overrides: Record<string, unknown> = {},
  ): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Basketball Court',
        address: '深圳市福田区测试路1号',
        pricePerHour: 200,
        courtCount: 2,
        regionCode: 'shenzhen_futian',
        ...overrides,
      })
      .expect(201);

    return res.body.data.id;
  }

  // ============================================================
  // Global Response Format
  // ============================================================

  describe('Global Response Format', () => {
    it('should wrap successful venue creation in ApiResponse format', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Court',
          address: 'Test Address',
          pricePerHour: 200,
        })
        .expect(201);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name', 'Test Court');
      expect(res.body.data).toHaveProperty('pricePerHour');
    });

    it('should wrap validation errors in unified error format', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: '',
          address: 'Test Address',
          pricePerHour: 200,
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });
  });

  // ============================================================
  // POST /api/v1/venues
  // ============================================================

  describe('POST /api/v1/venues', () => {
    it('should create venue with valid manager token', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Basketball Court',
          address: '深圳市福田区测试路1号',
          pricePerHour: 200,
          courtCount: 2,
          regionCode: 'shenzhen_futian',
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name', 'Test Basketball Court');
      expect(res.body.data).toHaveProperty('pricePerHour', 200);
      expect(res.body.data).toHaveProperty('courtCount', 2);
      expect(res.body.data).toHaveProperty('status', 'active');
    });

    it('should reject player user with 403', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Court',
          address: 'Test Address',
          pricePerHour: 200,
        })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
      expect(res.body.message).toContain('场地方');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .send({
          name: 'Test Court',
          address: 'Test Address',
          pricePerHour: 200,
        })
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });

    it('should reject invalid DTO with 400', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: '',
          address: '',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject pricePerHour <= 0 with 400', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Court',
          address: 'Test Address',
          pricePerHour: 0,
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });
  });

  // ============================================================
  // GET /api/v1/venues
  // ============================================================

  describe('GET /api/v1/venues', () => {
    it('should return paginated venue list', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      await createVenue(managerToken, { name: 'Court A' });
      await createVenue(managerToken, { name: 'Court B' });

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data.list).toBeInstanceOf(Array);
      expect(res.body.data.list.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data).toHaveProperty('page', 1);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by regionCode', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      await createVenue(managerToken, { name: 'SZ Court', regionCode: 'shenzhen_futian' });
      await createVenue(managerToken, { name: 'SH Court', regionCode: 'shanghai_minghang' });

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues?regionCode=shenzhen_futian')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.data.list.length).toBeGreaterThanOrEqual(1);
      const names = res.body.data.list.map((v: any) => v.name);
      expect(names).toContain('SZ Court');
    });

    it('should apply pagination params', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      await createVenue(managerToken, { name: 'Court 1' });
      await createVenue(managerToken, { name: 'Court 2' });

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues?page=1&pageSize=1')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.data.list).toHaveLength(1);
      expect(res.body.data.pageSize).toBe(1);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/venues')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });
  });

  // ============================================================
  // GET /api/v1/venues/my
  // ============================================================

  describe('GET /api/v1/venues/my', () => {
    it('should return only current manager venues', async () => {
      const { accessToken: manager1Token } = await registerAndLoginManager();
      const venue1Id = await createVenue(manager1Token, { name: 'Manager1 Court' });

      const { accessToken: manager2Token } = await registerAndLoginManager();
      await createVenue(manager2Token, { name: 'Manager2 Court' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/my')
        .set('Authorization', `Bearer ${manager1Token}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('name', 'Manager1 Court');
    });

    it('should return empty array when manager has no venues', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('should reject player user with 403', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/my')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
      expect(res.body.message).toContain('场地方');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/my')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });
  });

  // ============================================================
  // GET /api/v1/venues/:id
  // ============================================================

  describe('GET /api/v1/venues/:id', () => {
    it('should return venue detail with time slots', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken, { name: 'Detail Court' });

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('id', venueId);
      expect(res.body.data).toHaveProperty('name', 'Detail Court');
      expect(res.body.data).toHaveProperty('timeSlots');
    });

    it('should return 404 for non-existent venue', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/1')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });
  });

  // ============================================================
  // PUT /api/v1/venues/:id
  // ============================================================

  describe('PUT /api/v1/venues/:id', () => {
    it('should update venue for owner manager', async () => {
      const { accessToken } = await registerAndLoginManager();
      const venueId = await createVenue(accessToken, { name: 'Original Name' });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('name', 'Updated Name');
    });

    it('should reject player user with 403', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should reject update by non-owner manager with 403', async () => {
      const { accessToken: ownerToken } = await registerAndLoginManager();
      const venueId = await createVenue(ownerToken);

      const { accessToken: otherToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should return 404 for non-existent venue', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .put('/api/v1/venues/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });

    it('should reject invalid DTO with 400', async () => {
      const { accessToken } = await registerAndLoginManager();
      const venueId = await createVenue(accessToken);

      const res = await request(app.getHttpServer())
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          pricePerHour: -1,
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });
  });

  // ============================================================
  // DELETE /api/v1/venues/:id
  // ============================================================

  describe('DELETE /api/v1/venues/:id', () => {
    it('should delete venue for owner manager', async () => {
      const { accessToken } = await registerAndLoginManager();
      const venueId = await createVenue(accessToken);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);

      // 验证场地已删除
      const { accessToken: playerToken } = await registerAndLoginPlayer();
      await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(404);
    });

    it('should reject player user with 403', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should reject delete by non-owner manager with 403', async () => {
      const { accessToken: ownerToken } = await registerAndLoginManager();
      const venueId = await createVenue(ownerToken);

      const { accessToken: otherToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should return 404 for non-existent venue', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .delete('/api/v1/venues/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });
  });

  // ============================================================
  // GET /api/v1/venues/:id/slots
  // ============================================================

  describe('GET /api/v1/venues/:id/slots', () => {
    it('should return all time slots for venue', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      // 创建时段
      await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          slots: [
            { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
            { slotDate: '2026-06-15', startTime: '14:00', endTime: '16:00' },
          ],
        })
        .expect(201);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter time slots by slotDate', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          slots: [
            { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
            { slotDate: '2026-06-16', startTime: '09:00', endTime: '11:00' },
          ],
        })
        .expect(201);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}/slots?slotDate=2026-06-15`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('slotDate', '2026-06-15');
    });

    it('should return empty array when no slots', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('should return 404 for non-existent venue', async () => {
      const { accessToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/99999/slots')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });

    it('should reject invalid slotDate format with 400', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}/slots?slotDate=06-15-2026`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body.message).toContain('YYYY-MM-DD');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/venues/1/slots')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });
  });

  // ============================================================
  // POST /api/v1/venues/:id/slots
  // ============================================================

  describe('POST /api/v1/venues/:id/slots', () => {
    it('should create time slots for owner manager', async () => {
      const { accessToken } = await registerAndLoginManager();
      const venueId = await createVenue(accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slots: [
            { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
            { slotDate: '2026-06-15', startTime: '14:00', endTime: '16:00' },
          ],
        })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('slotDate', '2026-06-15');
      expect(res.body.data[0]).toHaveProperty('startTime', '09:00');
    });

    it('should reject player user with 403', async () => {
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken);

      const { accessToken: playerToken } = await registerAndLoginPlayer();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
        })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should reject non-owner manager with 403', async () => {
      const { accessToken: ownerToken } = await registerAndLoginManager();
      const venueId = await createVenue(ownerToken);

      const { accessToken: otherToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
        })
        .expect(403);

      expect(res.body).toHaveProperty('code', 403);
    });

    it('should reject overlapping time slots with 400', async () => {
      const { accessToken } = await registerAndLoginManager();
      const venueId = await createVenue(accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slots: [
            { slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' },
            { slotDate: '2026-06-15', startTime: '10:00', endTime: '12:00' },
          ],
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject invalid time format with 400', async () => {
      const { accessToken } = await registerAndLoginManager();
      const venueId = await createVenue(accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slots: [{ slotDate: '2026-06-15', startTime: 'invalid', endTime: '11:00' }],
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should return 404 for non-existent venue', async () => {
      const { accessToken } = await registerAndLoginManager();

      const res = await request(app.getHttpServer())
        .post('/api/v1/venues/99999/slots')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
        })
        .expect(404);

      expect(res.body).toHaveProperty('code', 404);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/venues/1/slots')
        .send({
          slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }],
        })
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });
  });

  // ============================================================
  // End-to-End Venue Flow
  // ============================================================

  describe('End-to-End Venue Flow', () => {
    it('should complete full create -> list -> detail -> update -> slots -> delete flow', async () => {
      // 1. 场地方注册登录
      const { accessToken: managerToken } = await registerAndLoginManager();

      // 2. 创建场地
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Flow Test Court',
          address: 'Flow Test Address',
          pricePerHour: 250,
          courtCount: 3,
          regionCode: 'shenzhen_futian',
        })
        .expect(201);
      const venueId = createRes.body.data.id;
      expect(createRes.body.data.name).toBe('Flow Test Court');

      // 3. 查询场地列表
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(listRes.body.data.list.length).toBeGreaterThanOrEqual(1);

      // 4. 查询场地详情
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(detailRes.body.data).toHaveProperty('name', 'Flow Test Court');
      expect(detailRes.body.data).toHaveProperty('pricePerHour', 250);

      // 5. 更新场地
      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Updated Flow Court' })
        .expect(200);
      expect(updateRes.body.data).toHaveProperty('name', 'Updated Flow Court');

      // 6. 创建时段
      const slotsRes = await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          slots: [{ slotDate: '2026-06-20', startTime: '09:00', endTime: '11:00' }],
        })
        .expect(201);
      expect(slotsRes.body.data).toHaveLength(1);

      // 7. 查询时段
      const getSlotsRes = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(getSlotsRes.body.data).toHaveLength(1);

      // 8. 删除场地
      await request(app.getHttpServer())
        .delete(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // 9. 验证已删除
      await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);
    });

    it('should allow player to browse venues but not modify them', async () => {
      // 1. 场地方创建场地
      const { accessToken: managerToken } = await registerAndLoginManager();
      const venueId = await createVenue(managerToken, { name: 'Browse Test Court' });

      // 2. 球员注册登录
      const { accessToken: playerToken } = await registerAndLoginPlayer();

      // 3. 球员可以浏览场地列表
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/venues')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);
      expect(listRes.body.data.list.length).toBeGreaterThanOrEqual(1);

      // 4. 球员可以查看场地详情
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);
      expect(detailRes.body.data).toHaveProperty('name', 'Browse Test Court');

      // 5. 球员不能创建场地
      await request(app.getHttpServer())
        .post('/api/v1/venues')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'Hacked', address: 'Hacked', pricePerHour: 100 })
        .expect(403);

      // 6. 球员不能更新场地
      await request(app.getHttpServer())
        .put(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'Hacked' })
        .expect(403);

      // 7. 球员不能删除场地
      await request(app.getHttpServer())
        .delete(`/api/v1/venues/${venueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);

      // 8. 球员不能创建时段
      await request(app.getHttpServer())
        .post(`/api/v1/venues/${venueId}/slots`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ slots: [{ slotDate: '2026-06-15', startTime: '09:00', endTime: '11:00' }] })
        .expect(403);
    });
  });
});
