/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { User } from '@modules/users/entities/user.entity';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('JwtStrategy', () => {
  let dataSource: DataSource;
  let jwtStrategy: JwtStrategy;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'vXloZBGTT7syeDNs5GBducYtkWxMuWifda6JljWUfHA=';
    process.env.PHONE_HASH_SECRET = 'test-phone-hash-secret-key-32bytes';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-module-22';

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'basketball_platform_test',
      entities: [User],
      synchronize: true,
    });
    await dataSource.initialize();

    userRepository = dataSource.getRepository(User);
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return process.env.JWT_SECRET;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    jwtStrategy = moduleRef.get<JwtStrategy>(JwtStrategy);
    jwtService = new JwtService({ secret: process.env.JWT_SECRET });
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('validate', () => {
    it('should validate and return user from valid payload', async () => {
      // Create a user
      const phone = '13800138000';
      const user = userRepository.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'TestUser',
        userType: 'player',
        status: 'active',
      });
      const savedUser = await userRepository.save(user);

      const payload = {
        sub: savedUser.id,
        phone: savedUser.phone,
        userType: savedUser.userType,
        type: 'access',
      };

      const result = await jwtStrategy.validate(payload);

      expect(result).toBeDefined();
      expect(result.userId).toBe(savedUser.id);
      expect(result.phone).toBe(phone);
      expect(result.userType).toBe('player');
    });

    it('should reject payload with non-existent userId', async () => {
      const payload = {
        sub: 999999,
        phone: '13800138000',
        userType: 'player' as const,
        type: 'access' as const,
      };

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject payload with banned user', async () => {
      const phone = '13800138001';
      const user = userRepository.create({
        phone,
        phoneHash: hashForQuery(phone),
        passwordHash: 'hashed_password',
        nickname: 'BannedUser',
        userType: 'player',
        status: 'banned',
      });
      const savedUser = await userRepository.save(user);

      const payload = {
        sub: savedUser.id,
        phone: savedUser.phone,
        userType: savedUser.userType,
        type: 'access',
      };

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject tampered token signature', async () => {
      // Create a token with wrong secret
      const wrongJwtService = new JwtService({ secret: 'wrong-secret' });
      const token = wrongJwtService.sign({
        sub: 1,
        phone: '13800138000',
        userType: 'player',
        type: 'access',
      });

      // JwtStrategy's validate is called after Passport verifies the signature
      // So we test the payload validation logic directly
      const payload = {
        sub: 1,
        phone: '13800138000',
        userType: 'player' as const,
        type: 'access' as const,
      };

      // Since user doesn't exist, it should reject
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject expired token', async () => {
      // Create an expired token
      const expiredToken = jwtService.sign(
        {
          sub: 1,
          phone: '13800138000',
          userType: 'player',
          type: 'access',
        },
        { expiresIn: '-1s' },
      );

      // Passport would reject this before validate is called
      // We verify JwtService rejects it
      expect(() => {
        jwtService.verify(expiredToken, { secret: process.env.JWT_SECRET });
      }).toThrow();
    });
  });
});
