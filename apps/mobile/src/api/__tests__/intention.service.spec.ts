import { intentionService, IntentionServiceError, IntentionResponse } from '../intention.service';
import { apiClient } from '../client';
import type { PaginatedResponse } from '@shared/common';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('IntentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockIntentionResponse: IntentionResponse = {
    id: 1,
    playerId: 42,
    startTime: '2026-06-12T10:00:00.000Z',
    durationMinutes: 120,
    acceptableWaitMinutes: 30,
    endTime: '2026-06-12T12:00:00.000Z',
    status: 'pending',
    matchId: null,
    regionCode: 'shenzhen_futian',
    submittedAt: '2026-06-11T08:00:00.000Z',
    updatedAt: '2026-06-11T08:00:00.000Z',
    expiresAt: '2026-06-12T12:00:00.000Z',
    venues: [
      { venueId: 1, priority: 1, venueName: '深圳湾体育中心' },
      { venueId: 2, priority: 2, venueName: '福田体育公园' },
    ],
    formats: [
      { formatId: 1, priority: 1, formatName: '3v3短赛' },
    ],
  };

  describe('createIntention', () => {
    const createDto = {
      startTime: '2026-06-12T10:00:00.000Z',
      durationMinutes: 120,
      acceptableWaitMinutes: 30,
      venueIds: [
        { venueId: 1, priority: 1 },
        { venueId: 2, priority: 2 },
      ],
      formatIds: [
        { formatId: 1, priority: 1 },
      ],
    };

    it('should create intention and return IntentionResponse', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { code: 201, message: 'success', data: mockIntentionResponse },
      });

      const result = await intentionService.createIntention(createDto);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/intentions', createDto);
      expect(result).toEqual(mockIntentionResponse);
    });

    it('should throw IntentionServiceError on server error', async () => {
      mockedApiClient.post.mockRejectedValue({
        response: { data: { message: '时间重叠，请选择其他时间段' } },
      });

      await expect(intentionService.createIntention(createDto)).rejects.toThrow(IntentionServiceError);
      await expect(intentionService.createIntention(createDto)).rejects.toThrow('时间重叠，请选择其他时间段');
    });

    it('should throw generic error message on network error', async () => {
      mockedApiClient.post.mockRejectedValue(new Error('Network Error'));

      await expect(intentionService.createIntention(createDto)).rejects.toThrow('网络错误，请稍后重试');
    });
  });

  describe('getMyIntentions', () => {
    const mockPaginatedResponse: PaginatedResponse<IntentionResponse> = {
      page: 1,
      pageSize: 10,
      total: 1,
      list: [mockIntentionResponse],
    };

    it('should fetch intentions with pagination params', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedResponse },
      });

      const result = await intentionService.getMyIntentions({ page: 1, pageSize: 10 });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/intentions/my', {
        params: { page: 1, pageSize: 10 },
      });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should fetch intentions with status filter', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedResponse },
      });

      const result = await intentionService.getMyIntentions({ page: 1, pageSize: 10, status: 'pending' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/intentions/my', {
        params: { page: 1, pageSize: 10, status: 'pending' },
      });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should fetch intentions with default params when none provided', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedResponse },
      });

      const result = await intentionService.getMyIntentions();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/intentions/my', {
        params: undefined,
      });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should throw IntentionServiceError on server error', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '未授权访问' } },
      });

      await expect(intentionService.getMyIntentions({ page: 1, pageSize: 10 })).rejects.toThrow(IntentionServiceError);
      await expect(intentionService.getMyIntentions({ page: 1, pageSize: 10 })).rejects.toThrow('未授权访问');
    });
  });

  describe('getMyIntentionById', () => {
    it('should fetch single intention by id', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockIntentionResponse },
      });

      const result = await intentionService.getMyIntentionById(1);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/intentions/my/1');
      expect(result).toEqual(mockIntentionResponse);
    });

    it('should throw IntentionServiceError on 404', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '意向不存在' } },
      });

      await expect(intentionService.getMyIntentionById(999)).rejects.toThrow(IntentionServiceError);
      await expect(intentionService.getMyIntentionById(999)).rejects.toThrow('意向不存在');
    });
  });

  describe('updateIntention', () => {
    const updateDto = {
      startTime: '2026-06-12T14:00:00.000Z',
      durationMinutes: 180,
    };

    it('should update intention and return updated IntentionResponse', async () => {
      const updatedResponse = { ...mockIntentionResponse, startTime: '2026-06-12T14:00:00.000Z', durationMinutes: 180 };
      mockedApiClient.put.mockResolvedValue({
        data: { code: 200, message: 'success', data: updatedResponse },
      });

      const result = await intentionService.updateIntention(1, updateDto);

      expect(mockedApiClient.put).toHaveBeenCalledWith('/intentions/1', updateDto);
      expect(result).toEqual(updatedResponse);
    });

    it('should throw IntentionServiceError on error', async () => {
      mockedApiClient.put.mockRejectedValue({
        response: { data: { message: '仅pending状态可修改' } },
      });

      await expect(intentionService.updateIntention(1, updateDto)).rejects.toThrow(IntentionServiceError);
      await expect(intentionService.updateIntention(1, updateDto)).rejects.toThrow('仅pending状态可修改');
    });
  });

  describe('cancelIntention', () => {
    it('should cancel intention and return cancelled IntentionResponse', async () => {
      const cancelledResponse = { ...mockIntentionResponse, status: 'cancelled' as const };
      mockedApiClient.delete.mockResolvedValue({
        data: { code: 200, message: 'success', data: cancelledResponse },
      });

      const result = await intentionService.cancelIntention(1);

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/intentions/1');
      expect(result).toEqual(cancelledResponse);
    });

    it('should throw IntentionServiceError on error', async () => {
      mockedApiClient.delete.mockRejectedValue({
        response: { data: { message: '状态不允许取消' } },
      });

      await expect(intentionService.cancelIntention(1)).rejects.toThrow(IntentionServiceError);
      await expect(intentionService.cancelIntention(1)).rejects.toThrow('状态不允许取消');
    });

    it('should throw generic error message on network error', async () => {
      mockedApiClient.delete.mockRejectedValue(new Error('timeout'));

      await expect(intentionService.cancelIntention(1)).rejects.toThrow('网络错误，请稍后重试');
    });
  });
});
