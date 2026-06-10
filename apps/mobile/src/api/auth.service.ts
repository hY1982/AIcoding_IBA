import { secureStorage } from '@/utils/secureStorage';
import { apiClient } from './client';
import type {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  AuthResponse,
  AuthApiResponse,
} from '@shared/auth';

interface SendSmsCodeDto {
  phone: string;
  scene: string;
}

class AuthServiceError extends Error {
  constructor(
    message: string,
    public userMessage: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
  }
  return '网络错误，请稍后重试';
}

class AuthService {
  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthApiResponse>('/auth/login', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new AuthServiceError(userMessage, userMessage);
    }
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthApiResponse>('/auth/register', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new AuthServiceError(userMessage, userMessage);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const dto: RefreshTokenDto = { refreshToken };
      const response = await apiClient.post<AuthApiResponse>('/auth/refresh', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new AuthServiceError(userMessage, userMessage);
    }
  }

  async sendSmsCode(dto: SendSmsCodeDto): Promise<{ success: boolean; requestId: string; expiresIn: number }> {
    try {
      const response = await apiClient.post<{ success: boolean; requestId: string; expiresIn: number }>('/auth/sms-code', dto);
      return response.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new AuthServiceError(userMessage, userMessage);
    }
  }

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await secureStorage.setItemAsync('accessToken', accessToken);
    await secureStorage.setItemAsync('refreshToken', refreshToken);
  }

  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const accessToken = await secureStorage.getItemAsync('accessToken');
    const refreshToken = await secureStorage.getItemAsync('refreshToken');
    return { accessToken, refreshToken };
  }

  async clearTokens(): Promise<void> {
    await secureStorage.deleteItemAsync('accessToken');
    await secureStorage.deleteItemAsync('refreshToken');
  }
}

export const authService = new AuthService();
export { AuthServiceError };
