import { apiClient } from './client';
import { extractApiErrorMessage } from './error';
import type { IntentionStatus } from '@shared/intention';
import type { ApiResponse, PaginatedResponse } from '@shared/common';

export class IntentionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentionServiceError';
  }
}

export interface IntentionResponse {
  id: number;
  playerId: number;
  startTime: string;
  durationMinutes: number;
  acceptableWaitMinutes: number;
  endTime: string;
  status: IntentionStatus;
  regionCode: string | null;
  submittedAt: string;
  updatedAt: string;
  expiresAt: string;
  venues: { venueId: number; priority: number; venueName?: string }[];
  formats: { formatId: number; priority: number; formatName?: string }[];
}

export interface CreateIntentionDto {
  startTime: string;
  durationMinutes: number;
  acceptableWaitMinutes?: number;
  localDate?: string;
  localTime?: string;
  venueIds: { venueId: number; priority: number }[];
  formatIds: { formatId: number; priority: number }[];
}

export interface UpdateIntentionDto {
  startTime?: string;
  durationMinutes?: number;
  acceptableWaitMinutes?: number;
  localDate?: string;
  localTime?: string;
  venueIds?: { venueId: number; priority: number }[];
  formatIds?: { formatId: number; priority: number }[];
}

export interface GetMyIntentionsParams {
  page?: number;
  pageSize?: number;
  status?: IntentionStatus;
}

class IntentionService {
  async createIntention(dto: CreateIntentionDto): Promise<IntentionResponse> {
    try {
      const response = await apiClient.post<ApiResponse<IntentionResponse>>('/intentions', dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new IntentionServiceError(userMessage);
    }
  }

  async getMyIntentions(params?: GetMyIntentionsParams): Promise<PaginatedResponse<IntentionResponse>> {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedResponse<IntentionResponse>>>('/intentions/my', {
        params,
      });
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new IntentionServiceError(userMessage);
    }
  }

  async getMyIntentionById(id: number): Promise<IntentionResponse> {
    try {
      const response = await apiClient.get<ApiResponse<IntentionResponse>>(`/intentions/my/${id}`);
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new IntentionServiceError(userMessage);
    }
  }

  async updateIntention(id: number, dto: UpdateIntentionDto): Promise<IntentionResponse> {
    try {
      const response = await apiClient.put<ApiResponse<IntentionResponse>>(`/intentions/${id}`, dto);
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new IntentionServiceError(userMessage);
    }
  }

  async cancelIntention(id: number): Promise<IntentionResponse> {
    try {
      const response = await apiClient.delete<ApiResponse<IntentionResponse>>(`/intentions/${id}`);
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new IntentionServiceError(userMessage);
    }
  }

  async deleteIntention(id: number): Promise<{ success: true }> {
    try {
      const response = await apiClient.delete<ApiResponse<{ success: true }>>(`/intentions/${id}/permanent`);
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new IntentionServiceError(userMessage);
    }
  }
}

export const intentionService = new IntentionService();
