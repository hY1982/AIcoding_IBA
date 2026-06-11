import { formatService, FormatServiceError } from '../format.service';
import { apiClient } from '../client';
import type { Format } from '@shared/format';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('FormatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFormats: Format[] = [
    {
      id: 1,
      name: '3v3短赛',
      formatType: 'short',
      teamSize: 3,
      teamCountMin: 3,
      teamCountMax: 4,
      winCondition: '先进5球或11分',
      durationHours: 1.5,
      description: '3对3短赛，先进5球或先得11分者胜',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: '4v4短赛',
      formatType: 'short',
      teamSize: 4,
      teamCountMin: 3,
      teamCountMax: 4,
      winCondition: '先进5球或11分',
      durationHours: 2.0,
      description: '4对4短赛，先进5球或先得11分者胜',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      name: '5v5短赛',
      formatType: 'short',
      teamSize: 5,
      teamCountMin: 3,
      teamCountMax: 4,
      winCondition: '先进5球或11分',
      durationHours: 2.5,
      description: '5对5短赛，先进5球或先得11分者胜',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  describe('getFormats', () => {
    it('should return Format[] on success', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockFormats },
      });

      const result = await formatService.getFormats();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/formats');
      expect(result).toEqual(mockFormats);
    });

    it('should throw FormatServiceError on server error', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '服务器内部错误' } },
      });

      await expect(formatService.getFormats()).rejects.toThrow(FormatServiceError);
      await expect(formatService.getFormats()).rejects.toThrow('服务器内部错误');
    });

    it('should throw generic error message on network error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Network Error'));

      await expect(formatService.getFormats()).rejects.toThrow(FormatServiceError);
      await expect(formatService.getFormats()).rejects.toThrow('网络错误，请稍后重试');
    });
  });
});
