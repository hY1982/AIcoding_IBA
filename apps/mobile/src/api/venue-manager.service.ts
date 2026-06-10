import { apiClient } from './client';
import type { VenueManagerProfile, UpdateVenueManagerProfileDto } from '@shared/venue-manager';
import type { ApiResponse } from '@shared/common';

export class VenueManagerServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VenueManagerServiceError';
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

class VenueManagerService {
  async getProfile(): Promise<VenueManagerProfile> {
    try {
      const response = await apiClient.get<ApiResponse<VenueManagerProfile>>('/venue-managers/profile');
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueManagerServiceError(userMessage);
    }
  }

  async updateProfile(dto: UpdateVenueManagerProfileDto): Promise<VenueManagerProfile> {
    try {
      const response = await apiClient.put<ApiResponse<VenueManagerProfile>>('/venue-managers/profile', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueManagerServiceError(userMessage);
    }
  }
}

export const venueManagerService = new VenueManagerService();
