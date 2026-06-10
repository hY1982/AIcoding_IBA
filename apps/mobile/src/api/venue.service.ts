import { apiClient } from './client';
import type { VenueDetail, VenueListItem, VenueTimeSlot, VenueDisplaySlot, VenueUnavailableSlot } from '@shared/venue';
import type { ApiResponse, PaginatedResponse } from '@shared/common';

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

export interface GetVenuesParams {
  page: number;
  pageSize: number;
  regionCode?: string;
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
  openTime?: string;
  closeTime?: string;
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

  async getVenues(params: GetVenuesParams): Promise<PaginatedResponse<VenueListItem>> {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedResponse<VenueListItem>>>(
        '/venues',
        {
          params,
        },
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  async getVenueTimeSlots(venueId: number, slotDate?: string): Promise<VenueTimeSlot[]> {
    try {
      const response = await apiClient.get<ApiResponse<VenueTimeSlot[]>>(
        `/venues/${venueId}/slots`,
        {
          params: slotDate ? { slotDate } : {},
        },
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  /**
   * 获取场地展示时段（连续时间轴，含可预订/不可预订/已占用）
   * 新系统接口，slotDate 必填
   */
  async getVenueDisplaySlots(venueId: number, slotDate: string): Promise<VenueDisplaySlot[]> {
    try {
      const response = await apiClient.get<ApiResponse<VenueDisplaySlot[]>>(
        `/venues/${venueId}/slots`,
        {
          params: { slotDate },
        },
      );
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

  /**
   * 获取场地的不可预订时段列表（场地方管理用）
   */
  async getUnavailableSlots(venueId: number, slotDate: string): Promise<VenueUnavailableSlot[]> {
    try {
      const response = await apiClient.get<ApiResponse<VenueUnavailableSlot[]>>(
        `/venues/${venueId}/unavailable-slots`,
        { params: { slotDate } },
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  /**
   * 创建不可预订时段（场地方）
   */
  async createUnavailableSlot(
    venueId: number,
    dto: { slotDate: string; startTime: string; endTime: string; reason?: string },
  ): Promise<VenueUnavailableSlot> {
    try {
      const response = await apiClient.post<ApiResponse<VenueUnavailableSlot>>(
        `/venues/${venueId}/unavailable-slots`,
        dto,
      );
      return response.data.data;
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }

  /**
   * 删除不可预订时段（场地方）
   */
  async deleteUnavailableSlot(venueId: number, slotId: number): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<void>>(`/venues/${venueId}/unavailable-slots/${slotId}`);
    } catch (error) {
      const userMessage = extractErrorMessage(error);
      throw new VenueServiceError(userMessage);
    }
  }
}

export const venueService = new VenueService();
