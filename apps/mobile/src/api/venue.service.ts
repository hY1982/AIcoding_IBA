import { apiClient } from './client';
import type { VenueDetail, VenueListItem } from '@shared/venue';
import type { ApiResponse } from '@shared/common';

export class VenueServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VenueServiceError';
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

export interface CreateVenueDto {
  name: string;
  address: string;
  pricePerHour: number;
  courtCount?: number;
  latitude?: number;
  longitude?: number;
  floorMaterial?: 'wood' | 'pu' | 'silicone' | 'cement' | 'other';
  lighting?: string;
  courtType?: 'indoor' | 'outdoor' | 'semi';
  ventilation?: boolean;
  bigFan?: boolean;
  airCondition?: boolean;
  turnoverTime?: number;
  parking?: boolean;
  restroom?: boolean;
  shower?: boolean;
  lockerRoom?: boolean;
  videoRecord?: boolean;
  regionCode?: string;
}

class VenueService {
  async createVenue(dto: CreateVenueDto): Promise<VenueDetail> {
    try {
      const response = await apiClient.post<ApiResponse<VenueDetail>>('/venues', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  async getMyVenues(): Promise<VenueListItem[]> {
    try {
      const response = await apiClient.get<ApiResponse<VenueListItem[]>>('/venues/my');
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  async getVenueDetail(venueId: number): Promise<VenueDetail> {
    try {
      const response = await apiClient.get<ApiResponse<VenueDetail>>(`/venues/${venueId}`);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  async updateVenue(venueId: number, dto: Partial<CreateVenueDto>): Promise<VenueDetail> {
    try {
      const response = await apiClient.put<ApiResponse<VenueDetail>>(`/venues/${venueId}`, dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  async deleteVenue(venueId: number): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<void>>(`/venues/${venueId}`);
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }
}

export const venueService = new VenueService();
