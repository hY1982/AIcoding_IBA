import { authService } from '../auth.service';
import { apiClient } from '../client';
import type { AuthApiResponse } from '@shared/auth';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should send POST to /auth/login and return AuthResponse', async () => {
      const mockResponse: AuthApiResponse = {
        code: 200,
        message: 'success',
        data: {
          user: {
            id: 1,
            phone: '138****8000',
            nickname: 'TestPlayer',
            userType: 'player',
            status: 'active',
          },
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-456',
          },
        },
      };

      mockedApiClient.post = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await authService.login({ phone: '13800138000', password: 'Password123' });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/login', {
        phone: '13800138000',
        password: 'Password123',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error with userMessage on login failure', async () => {
      mockedApiClient.post = jest.fn().mockRejectedValue({
        response: { data: { code: 401, message: '手机号或密码错误' } },
      });

      await expect(authService.login({ phone: '13800138000', password: 'wrong' })).rejects.toThrow(
        '手机号或密码错误',
      );
    });
  });

  describe('register', () => {
    it('should send POST to /auth/register and return AuthResponse', async () => {
      const mockResponse: AuthApiResponse = {
        code: 200,
        message: 'success',
        data: {
          user: {
            id: 1,
            phone: '138****8000',
            nickname: 'TestPlayer',
            userType: 'player',
            status: 'active',
          },
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-456',
          },
        },
      };

      mockedApiClient.post = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await authService.register({
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestPlayer',
        userType: 'player',
        age: 25,
        basketballAge: 5,
        gender: 'male',
        height: 180,
      });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/register', expect.any(Object));
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error with userMessage on register failure (phone exists)', async () => {
      mockedApiClient.post = jest.fn().mockRejectedValue({
        response: { data: { code: 409, message: '该手机号已被注册' } },
      });

      await expect(
        authService.register({
          phone: '13800138000',
          password: 'Password123',
          nickname: 'Test',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
        }),
      ).rejects.toThrow('该手机号已被注册');
    });
  });

  describe('refreshToken', () => {
    it('should send POST to /auth/refresh', async () => {
      const mockResponse: AuthApiResponse = {
        code: 200,
        message: 'success',
        data: {
          user: {
            id: 1,
            phone: '138****8000',
            nickname: 'TestPlayer',
            userType: 'player',
            status: 'active',
          },
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      };

      mockedApiClient.post = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await authService.refreshToken('refresh-token-456');

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'refresh-token-456',
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('sendSmsCode', () => {
    it('should send POST to /auth/sms-code', async () => {
      mockedApiClient.post = jest.fn().mockResolvedValue({
        data: { success: true, requestId: 'req-123', expiresIn: 300 },
      });

      const result = await authService.sendSmsCode({ phone: '13800138000', scene: 'register' });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/sms-code', {
        phone: '13800138000',
        scene: 'register',
      });
      expect(result).toEqual({ success: true, requestId: 'req-123', expiresIn: 300 });
    });
  });

  describe('Token storage', () => {
    it('should save tokens to secure store', async () => {
      const { setItemAsync } = require('expo-secure-store');

      await authService.saveTokens('access-123', 'refresh-456');

      expect(setItemAsync).toHaveBeenCalledWith('accessToken', 'access-123');
      expect(setItemAsync).toHaveBeenCalledWith('refreshToken', 'refresh-456');
    });

    it('should get tokens from secure store', async () => {
      const { getItemAsync } = require('expo-secure-store');
      getItemAsync
        .mockResolvedValueOnce('access-123')
        .mockResolvedValueOnce('refresh-456');

      const tokens = await authService.getTokens();

      expect(tokens).toEqual({ accessToken: 'access-123', refreshToken: 'refresh-456' });
    });

    it('should clear tokens from secure store', async () => {
      const { deleteItemAsync } = require('expo-secure-store');

      await authService.clearTokens();

      expect(deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    });
  });
});
