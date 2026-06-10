import { apiClient } from './client';
import type { PlayerProfile, PlayerAbility, PlayerAttributes } from '@shared/player';
import type { ApiResponse } from '@shared/common';

export class PlayerServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerServiceError';
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

export type UpdateProfileDto = Partial<PlayerAttributes> &
  Partial<Pick<PlayerAbility, 'baseAbilityScore' | 'matchAdjustValue'>>;

class PlayerService {
  async getProfile(): Promise<PlayerProfile> {
    try {
      const response = await apiClient.get<ApiResponse<PlayerProfile>>('/players/profile');
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new PlayerServiceError(userMessage);
    }
  }

  async updateProfile(dto: UpdateProfileDto): Promise<PlayerProfile> {
    try {
      const response = await apiClient.put<ApiResponse<PlayerProfile>>('/players/profile', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new PlayerServiceError(userMessage);
    }
  }

  async getAbility(): Promise<PlayerAbility> {
    try {
      const response = await apiClient.get<ApiResponse<PlayerAbility>>('/players/ability');
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new PlayerServiceError(userMessage);
    }
  }
}

export const playerService = new PlayerService();
