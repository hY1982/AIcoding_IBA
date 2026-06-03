/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let jwtAuthGuard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    jwtAuthGuard = new JwtAuthGuard(reflector);
  });

  const createMockExecutionContext = (isPublic: boolean = false): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
      getType: jest.fn().mockReturnValue('http'),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access to public routes without JWT', async () => {
      const context = createMockExecutionContext();

      // Mock reflector to return true (public route)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = await jwtAuthGuard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should call super.canActivate for non-public routes', async () => {
      const context = createMockExecutionContext();

      // Mock reflector to return false (protected route)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      // Mock the parent AuthGuard behavior
      jest.spyOn(jwtAuthGuard as any, 'canActivate').mockImplementation(async () => {
        throw new UnauthorizedException();
      });

      await expect(jwtAuthGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleRequest', () => {
    it('should return user when authentication succeeds', () => {
      const user = { userId: 1, phone: '13800138000', userType: 'player' };

      const result = jwtAuthGuard.handleRequest(null, user, null);

      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when no user', () => {
      expect(() => {
        jwtAuthGuard.handleRequest(null, null, null);
      }).toThrow(UnauthorizedException);
    });

    it('should throw original error when error is provided', () => {
      const error = new Error('Token expired');

      expect(() => {
        jwtAuthGuard.handleRequest(error, null, null);
      }).toThrow(error);
    });
  });
});
