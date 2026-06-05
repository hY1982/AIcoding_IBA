import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  HttpException,
  ArgumentsHost,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  describe('common HTTP exceptions', () => {
    it('should transform BadRequestException to unified format', () => {
      const exception = new BadRequestException('Invalid input');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 400,
        message: 'Invalid input',
        data: null,
      });
    });

    it('should transform UnauthorizedException to unified format', () => {
      const exception = new UnauthorizedException('请先登录');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 401,
        message: '请先登录',
        data: null,
      });
    });

    it('should transform ConflictException to unified format', () => {
      const exception = new ConflictException('该手机号已被注册');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 409,
        message: '该手机号已被注册',
        data: null,
      });
    });

    it('should transform NotFoundException to unified format', () => {
      const exception = new NotFoundException('资源不存在');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 404,
        message: '资源不存在',
        data: null,
      });
    });

    it('should transform ForbiddenException to unified format', () => {
      const exception = new ForbiddenException('权限不足');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 403,
        message: '权限不足',
        data: null,
      });
    });
  });

  describe('validation errors', () => {
    it('should include validation errors from class-validator', () => {
      const validationErrors = [
        {
          property: 'phone',
          constraints: { isPhone: '请输入有效的11位手机号码' },
        },
        {
          property: 'password',
          constraints: {
            minLength: '密码必须至少8位，且包含至少1个字母和1个数字',
          },
        },
      ];
      const exception = new BadRequestException(validationErrors);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseBody = mockResponse.json.mock.calls[0][0];
      expect(responseBody.code).toBe(400);
      expect(responseBody.data).toBeNull();
      expect(responseBody.message).toContain('phone');
      expect(responseBody.message).toContain('password');
    });

    it('should handle single validation error message', () => {
      const exception = new BadRequestException({
        message: ['phone must be a valid phone number'],
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseBody = mockResponse.json.mock.calls[0][0];
      expect(responseBody.code).toBe(400);
      expect(responseBody.data).toBeNull();
    });
  });

  describe('exception without explicit message', () => {
    it('should use default message for generic HttpException', () => {
      const exception = new HttpException('Internal error', 500);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        code: 500,
        message: 'Internal error',
        data: null,
      });
    });

    it('should handle exception with object response', () => {
      const exception = new BadRequestException({
        statusCode: 400,
        message: 'Multiple errors occurred',
        error: 'Bad Request',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseBody = mockResponse.json.mock.calls[0][0];
      expect(responseBody.code).toBe(400);
      expect(responseBody.data).toBeNull();
    });
  });
});
