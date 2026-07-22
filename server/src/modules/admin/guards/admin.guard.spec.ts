// Set required environment variables before importing modules that use them
process.env.PHONE_HASH_SECRET = 'test-secret-for-admin-guard-spec';

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { hashForQuery } from '@common/utils/encrypt.util';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let configService: ConfigService;

  const adminPhone = '13800138000';
  const adminPhoneHash = hashForQuery(adminPhone);
  const nonAdminPhone = '13900139000';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ADMIN_PHONES') return adminPhone;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  function createMockContext(user?: { userId: number; phone: string; userType: string }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access for admin user', () => {
    const context = createMockContext({
      userId: 1,
      phone: adminPhone,
      userType: 'player',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access for non-admin user', () => {
    const context = createMockContext({
      userId: 2,
      phone: nonAdminPhone,
      userType: 'player',
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('无权访问：您不是管理员');
  });

  it('should deny access when user is not authenticated', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('请先登录');
  });

  it('should handle multiple admin phones', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => '13800138000, 13800138001'),
          },
        },
      ],
    }).compile();

    const multiGuard = module.get<AdminGuard>(AdminGuard);
    const ctx1 = createMockContext({ userId: 1, phone: '13800138000', userType: 'player' });
    const ctx2 = createMockContext({ userId: 2, phone: '13800138001', userType: 'player' });
    const ctx3 = createMockContext({ userId: 3, phone: '13900139000', userType: 'player' });

    expect(multiGuard.canActivate(ctx1)).toBe(true);
    expect(multiGuard.canActivate(ctx2)).toBe(true);
    expect(() => multiGuard.canActivate(ctx3)).toThrow(ForbiddenException);
  });

  it('should deny all when ADMIN_PHONES is empty', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ''),
          },
        },
      ],
    }).compile();

    const emptyGuard = module.get<AdminGuard>(AdminGuard);
    const context = createMockContext({ userId: 1, phone: adminPhone, userType: 'player' });
    expect(() => emptyGuard.canActivate(context)).toThrow(ForbiddenException);
  });
});
