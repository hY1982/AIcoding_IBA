import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/services/redis.service';
import { PlayerShootingRecord } from '../src/modules/players/entities/player-shooting-record.entity';

/**
 * PlayerController E2E 测试
 *
 * 验证球员接口的完整链路：
 * 1. JWT 认证与授权
 * 2. 球员资料查询/更新（脱敏响应、能力值重算）
 * 3. 投篮记录录入/统计（业务校验、半年滚动）
 * 4. 全局响应格式（TransformInterceptor + HttpExceptionFilter）
 */
describe('PlayerController (e2e)', () => {
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
    // 按外键依赖逆序清理，避免外键冲突
    const tables = [
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
        // 仅忽略表不存在的错误（PostgreSQL 错误码 42P01）
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
   * 辅助函数：注册用户并返回 accessToken、userId、playerId
   *
   * 注意：AuthService.register 返回 { user, tokens }，不含 player 字段。
   *  playerId 需要通过数据库查询获取。
   */
  async function registerAndLogin(overrides: Record<string, unknown> = {}): Promise<{
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

    // 通过数据库查询获取 playerId（AuthService 注册响应不含 player 字段）
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

  // ============================================================
  // GET /api/v1/players/profile
  // ============================================================
  describe('GET /api/v1/players/profile', () => {
    it('should return masked player profile with valid JWT', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .get('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('phone');
      expect(res.body.data.phone).toMatch(/^\d{3}\*{4}\d{4}$/); // 138****5678
      expect(res.body.data).toHaveProperty('realName');
      // realName 可能为空（用户未设置），脱敏后为空字符串或 ** 格式
      expect(res.body.data.realName).toMatch(/^(.{1}\*+)?$/); // 张** 或空
      expect(res.body.data).toHaveProperty('baseAbilityScore');
      expect(res.body.data).toHaveProperty('totalAbilityScore');
      expect(res.body.data).toHaveProperty('height', 180);
    });

    it('should return 401 without JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/players/profile')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
      expect(res.body).toHaveProperty('data', null);
    });

    it('should return 401 with invalid JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/players/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
    });
  });

  // ============================================================
  // PUT /api/v1/players/profile
  // ============================================================
  describe('PUT /api/v1/players/profile', () => {
    it('should update height and recalculate ability', async () => {
      const { accessToken } = await registerAndLogin();

      // 先获取原始资料
      const profileRes = await request(app.getHttpServer())
        .get('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // decimal 类型从 PostgreSQL 返回为字符串，需 parseFloat 比较
      const originalAbilityScore = parseFloat(profileRes.body.data.baseAbilityScore);

      // 更新身高
      const res = await request(app.getHttpServer())
        .put('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ height: 210 })
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body.data).toHaveProperty('height', 210);
      // 身高增加，能力值应提高（decimal 返回字符串，parseFloat 后比较）
      expect(parseFloat(res.body.data.baseAbilityScore)).toBeGreaterThan(originalAbilityScore);
    });

    it('should update positions with max 3 limit', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .put('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ positions: ['PG', 'SG', 'SF'] })
        .expect(200);

      expect(res.body.data.positions).toHaveLength(3);
      expect(res.body.data.positions.map((p: any) => p.position)).toEqual([
        'PG',
        'SG',
        'SF',
      ]);
    });

    it('should reject positions with more than 3', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .put('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ positions: ['PG', 'SG', 'SF', 'PF'] })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should not recalculate ability when only regionCode changes', async () => {
      const { accessToken } = await registerAndLogin();

      const profileRes = await request(app.getHttpServer())
        .get('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const originalAbilityScore = parseFloat(profileRes.body.data.baseAbilityScore);

      const res = await request(app.getHttpServer())
        .put('/api/v1/players/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ regionCode: 'shanghai_minghang' })
        .expect(200);

      expect(parseFloat(res.body.data.baseAbilityScore)).toBe(originalAbilityScore);
      expect(res.body.data).toHaveProperty('regionCode', 'shanghai_minghang');
    });
  });

  // ============================================================
  // POST /api/v1/players/shooting
  // ============================================================
  describe('POST /api/v1/players/shooting', () => {
    it('should create shooting record successfully', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: '2026-06-09',
        })
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body.data).toHaveProperty('recordType', 'free_throw');
      expect(res.body.data).toHaveProperty('shotsMade', 7);
      expect(res.body.data).toHaveProperty('shotsAttempted', 10);
    });

    it('should reject when shotsMade > shotsAttempted', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 11,
          recordDate: '2026-06-09',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject future recordDate', async () => {
      const { accessToken } = await registerAndLogin();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .post('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: dateStr,
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject invalid recordType', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recordType: 'two_point',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: '2026-06-09',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });

    it('should reject invalid recordDate format', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: '2026-06-09T10:30:00',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
    });
  });

  // ============================================================
  // GET /api/v1/players/shooting
  // ============================================================
  describe('GET /api/v1/players/shooting', () => {
    it('should return rolling 6-month stats', async () => {
      const { accessToken, playerId } = await registerAndLogin();

      const today = new Date();
      const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      const sevenMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 7, today.getDate());

      // 辅助函数：Date → YYYY-MM-DD 字符串，避免 TypeORM 时区转换导致日期偏移
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // 插入半年内的记录
      const repo = dataSource.getRepository(PlayerShootingRecord);
      await repo.save([
        {
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 10,
          shotsMade: 7,
          recordDate: fmt(oneMonthAgo),
        },
        {
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 20,
          shotsMade: 15,
          recordDate: fmt(oneMonthAgo),
        },
        {
          playerId,
          recordType: 'three_point',
          shotsAttempted: 30,
          shotsMade: 10,
          recordDate: fmt(oneMonthAgo),
        },
        // 插入超过半年的记录（不应被统计）
        {
          playerId,
          recordType: 'free_throw',
          shotsAttempted: 100,
          shotsMade: 50,
          recordDate: fmt(sevenMonthsAgo),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(2);

      const freeThrow = res.body.data.find(
        (s: any) => s.recordType === 'free_throw',
      );
      const threePoint = res.body.data.find(
        (s: any) => s.recordType === 'three_point',
      );

      expect(freeThrow).toBeDefined();
      expect(freeThrow.totalAttempted).toBe(30);
      expect(freeThrow.totalMade).toBe(22);
      expect(freeThrow.percentage).toBe(73.3);

      expect(threePoint).toBeDefined();
      expect(threePoint.totalAttempted).toBe(30);
      expect(threePoint.totalMade).toBe(10);
      expect(threePoint.percentage).toBe(33.3);
    });

    it('should return empty array when no records', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .get('/api/v1/players/shooting')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body.data).toEqual([]);
    });
  });
});
