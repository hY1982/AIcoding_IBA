import { of, lastValueFrom } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { ApiResponse } from '@shared/common';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const createMockExecutionContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    }) as ExecutionContext;

  const createMockCallHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  describe('successful response wrapping', () => {
    it('should wrap successful response in ApiResponse format', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler({ id: 1, name: 'test' });

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: { id: 1, name: 'test' },
      });
    });

    it('should wrap string data in ApiResponse format', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler('hello');

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: 'hello',
      });
    });

    it('should wrap array data in ApiResponse format', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler([1, 2, 3]);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: [1, 2, 3],
      });
    });
  });

  describe('null/undefined data handling', () => {
    it('should wrap null data correctly', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(null);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: null,
      });
    });

    it('should wrap undefined data correctly', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(undefined);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: null,
      });
    });
  });

  describe('existing ApiResponse passthrough', () => {
    it('should preserve existing ApiResponse structure', async () => {
      const existingResponse: ApiResponse<string> = {
        code: 0,
        message: 'custom message',
        data: 'test',
      };
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(existingResponse);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual(existingResponse);
    });

    it('should preserve ApiResponse with non-zero code', async () => {
      const existingResponse: ApiResponse<null> = {
        code: 1001,
        message: 'business warning',
        data: null,
      };
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(existingResponse);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual(existingResponse);
    });
  });

  describe('edge cases', () => {
    it('should wrap number data correctly', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(42);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: 42,
      });
    });

    it('should wrap boolean data correctly', async () => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(true);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: true,
      });
    });

    it('should wrap nested object data correctly', async () => {
      const nestedData = {
        user: { id: 1, name: 'test' },
        tokens: { accessToken: 'abc', refreshToken: 'def' },
      };
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(nestedData);

      const result$ = interceptor.intercept(context, handler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: nestedData,
      });
    });
  });
});
