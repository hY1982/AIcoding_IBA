import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { User } from '../../users/entities/user.entity';
import { Player } from '../../players/entities/player.entity';
import { VenueManager } from '../../users/entities/venue-manager.entity';
import { RedisService } from '../../../common/services/redis.service';

/**
 * AuthController E2E 测试
 *
 * 验证以下 P1 审核问题：
 * 1. DTO 校验集成测试 — ValidationPipe 实际拦截非法输入
 * 2. 短信验证码端到端测试 — 完整链路验证
 * 3. 全局拦截器/过滤器响应格式验证 — TransformInterceptor + HttpExceptionFilter
 */
describe('AuthController (e2e)', () => {
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

    // 注册与生产环境一致的全局管道、拦截器和过滤器
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    dataSource = app.get(DataSource);
    redisService = app.get(RedisService);

    // 清理数据
    await cleanDatabase(dataSource);
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function cleanDatabase(ds: DataSource): Promise<void> {
    const tables = [
      'player_position',
      'player',
      'venue_manager',
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

  // ============================================================
  // P1-3: 全局响应格式验证
  // ============================================================
  describe('Global Response Format (TransformInterceptor)', () => {
    it('should wrap successful registration in ApiResponse format', async () => {
      const phone = nextPhone();
      const res = await request(app.getHttpServer())
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
        })
        .expect(201);

      // 验证 TransformInterceptor 包装后的统一响应格式
      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.user).toHaveProperty('phone');
      expect(res.body.data.user).toHaveProperty('userType', 'player');
    });

    it('should wrap successful login in ApiResponse format', async () => {
      const phone = nextPhone();
      // 先注册
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone,
          password: 'Password123',
          nickname: 'LoginTest',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        });

      // 再登录
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone,
          password: 'Password123',
        })
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
    });
  });

  // ============================================================
  // P1-3: 全局错误响应格式验证 (HttpExceptionFilter)
  // ============================================================
  describe('Global Error Response Format (HttpExceptionFilter)', () => {
    it('should return unified error format for invalid login credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: '13800138000',
          password: 'WrongPassword',
        })
        .expect(401);

      // 验证 HttpExceptionFilter 转换后的统一错误格式
      expect(res.body).toHaveProperty('code', 401);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('手机号或密码错误');
      expect(res.body).toHaveProperty('data', null);
    });

    it('should return unified error format for duplicate registration', async () => {
      const phone = nextPhone();
      // 第一次注册
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone,
          password: 'Password123',
          nickname: 'DupTest',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        });

      // 重复注册
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone,
          password: 'Password123',
          nickname: 'DupTest2',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        })
        .expect(409);

      expect(res.body).toHaveProperty('code', 409);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('该手机号已被注册');
      expect(res.body).toHaveProperty('data', null);
    });
  });

  // ============================================================
  // P1-1: DTO 校验集成测试 (ValidationPipe)
  // ============================================================
  describe('DTO Validation (ValidationPipe)', () => {
    it('should reject registration with invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: '123456',
          password: 'Password123',
          nickname: 'Test',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        })
        .expect(400);

      // 验证 ValidationPipe 拦截并返回 400
      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
      expect(res.body.message).toContain('phone');
    });

    it('should reject registration with weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: '13800138000',
          password: '12345',
          nickname: 'Test',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
      expect(res.body.message).toContain('password');
    });

    it('should reject registration with missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: '13800138000',
          password: 'Password123',
          // missing nickname, userType, age, etc.
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });

    it('should reject login with invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: 'invalid-phone',
          password: 'Password123',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
      expect(res.body.message).toContain('phone');
    });

    it('should reject login with empty password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone: '13800138000',
          password: '',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });

    it('should reject refresh with empty token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: '',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });

    it('should reject sms-code with invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/sms-code')
        .send({
          phone: '123',
          scene: 'register',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
      expect(res.body.message).toContain('phone');
    });

    it('should reject sms-code with invalid scene', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/sms-code')
        .send({
          phone: '13800138000',
          scene: 'invalid_scene',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });

    it('should reject venue manager registration with missing company fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: '13800138000',
          password: 'Password123',
          nickname: 'TestManager',
          userType: 'venue_manager',
          // missing companyName, contactName, contactPhone
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });

    it('should reject unknown fields when forbidNonWhitelisted is true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone: '13800138000',
          password: 'Password123',
          nickname: 'Test',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
          unknownField: 'should be rejected',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 400);
      expect(res.body).toHaveProperty('data', null);
    });
  });

  // ============================================================
  // P1-2: 短信验证码端到端测试
  // ============================================================
  describe('POST /api/v1/auth/sms-code', () => {
    it('should send sms code successfully via full chain', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/sms-code')
        .send({
          phone: '13800138000',
          scene: 'register',
        })
        .expect(200);

      // 验证 TransformInterceptor 包装格式
      expect(res.body).toHaveProperty('code', 0);
      expect(res.body).toHaveProperty('message', 'success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('requestId');
      expect(typeof res.body.data.requestId).toBe('string');
      expect(res.body.data.requestId).toMatch(/^mock-/);
      expect(res.body.data).toHaveProperty('expiresIn', 300);
    });

    it('should send sms code without scene parameter', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/sms-code')
        .send({
          phone: '13800138111',
        })
        .expect(200);

      expect(res.body).toHaveProperty('code', 0);
      expect(res.body.data).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('requestId');
    });

    it('should support all valid scenes', async () => {
      const scenes = ['register', 'login', 'reset_password'];
      for (const scene of scenes) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/sms-code')
          .send({
            phone: nextPhone(),
            scene,
          })
          .expect(200);

        expect(res.body.code).toBe(0);
        expect(res.body.data.success).toBe(true);
      }
    });
  });

  // ============================================================
  // 端到端业务流验证
  // ============================================================
  describe('End-to-End Auth Flow', () => {
    it('should complete full register -> login -> refresh flow', async () => {
      const phone = nextPhone();

      // 1. 注册
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone,
          password: 'Password123',
          nickname: 'FlowTest',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        })
        .expect(201);

      expect(registerRes.body.code).toBe(0);
      const refreshToken = registerRes.body.data.tokens.refreshToken;

      // 2. 登录
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          phone,
          password: 'Password123',
        })
        .expect(200);

      expect(loginRes.body.code).toBe(0);
      expect(loginRes.body.data.tokens.accessToken).toBeDefined();

      // 3. 刷新 Token
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(refreshRes.body.code).toBe(0);
      expect(refreshRes.body.data.tokens.accessToken).toBeDefined();
      expect(refreshRes.body.data.tokens.refreshToken).toBeDefined();
      // 新 refreshToken 应与旧的不同（单次使用轮换）
      expect(refreshRes.body.data.tokens.refreshToken).not.toBe(refreshToken);
    });

    it('should reject refresh with reused token', async () => {
      const phone = nextPhone();

      // 注册获取 refreshToken
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          phone,
          password: 'Password123',
          nickname: 'ReuseTest',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        })
        .expect(201);

      const refreshToken = registerRes.body.data.tokens.refreshToken;

      // 第一次刷新
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // 第二次使用同一 token（应失败）
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(res.body).toHaveProperty('code', 401);
      expect(res.body).toHaveProperty('data', null);
      expect(res.body.message).toContain('Refresh token');
    });
  });
});
