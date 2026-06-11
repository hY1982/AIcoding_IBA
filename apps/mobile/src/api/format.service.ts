import { apiClient } from './client';
import { extractApiErrorMessage } from './error';
import type { Format } from '@shared/format';
import type { ApiResponse } from '@shared/common';

export class FormatServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatServiceError';
  }
}

class FormatService {
  async getFormats(): Promise<Format[]> {
    try {
      const response = await apiClient.get<ApiResponse<Format[]>>('/formats');
      return response.data.data;
    } catch (error) {
      const userMessage = extractApiErrorMessage(error);
      throw new FormatServiceError(userMessage);
    }
  }
}

export const formatService = new FormatService();
