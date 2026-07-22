import { apiClient } from './client';
import * as adminApi from './admin';

jest.mock('./client', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

describe('Admin API', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlayers', () => {
    it('should fetch players with query params', async () => {
      const mockResponse = {
        data: {
          data: { page: 1, pageSize: 10, total: 0, list: [] },
        },
      };
      mockApiClient.get.mockResolvedValue(mockResponse as never);

      const result = await adminApi.getPlayers({ page: 1, pageSize: 10, keyword: 'test' });

      expect(mockApiClient.get).toHaveBeenCalledWith('/admin/players', {
        params: { page: 1, pageSize: 10, keyword: 'test' },
      });
      expect(result).toEqual(mockResponse.data.data);
    });
  });

  describe('getVenues', () => {
    it('should fetch venues', async () => {
      const mockResponse = {
        data: { data: { page: 1, pageSize: 10, total: 0, list: [] } },
      };
      mockApiClient.get.mockResolvedValue(mockResponse as never);

      const result = await adminApi.getVenues();

      expect(mockApiClient.get).toHaveBeenCalledWith('/admin/venues', { params: {} });
      expect(result).toEqual(mockResponse.data.data);
    });
  });

  describe('getMatches', () => {
    it('should fetch matches', async () => {
      const mockResponse = {
        data: { data: { page: 1, pageSize: 10, total: 0, list: [] } },
      };
      mockApiClient.get.mockResolvedValue(mockResponse as never);

      await adminApi.getMatches({ status: 'pending_players' });

      expect(mockApiClient.get).toHaveBeenCalledWith('/admin/matches', {
        params: { status: 'pending_players' },
      });
    });
  });

  describe('getStats', () => {
    it('should fetch platform stats', async () => {
      const mockStats = {
        totalPlayers: 100,
        totalVenueManagers: 10,
        totalVenues: 15,
        todayMatches: 5,
        pendingIntentions: 20,
        weeklyMatchTrend: [],
        matchStatusDistribution: [],
      };
      mockApiClient.get.mockResolvedValue({ data: { data: mockStats } } as never);

      const result = await adminApi.getStats();

      expect(mockApiClient.get).toHaveBeenCalledWith('/admin/stats');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getSystemParams', () => {
    it('should fetch system params', async () => {
      const mockParams = [{ id: 1, paramKey: 'test', paramValue: {}, description: null }];
      mockApiClient.get.mockResolvedValue({ data: { data: mockParams } } as never);

      const result = await adminApi.getSystemParams();

      expect(mockApiClient.get).toHaveBeenCalledWith('/admin/params');
      expect(result).toEqual(mockParams);
    });
  });

  describe('updateSystemParam', () => {
    it('should update system param', async () => {
      const mockParam = { id: 1, paramKey: 'test', paramValue: { new: true } };
      mockApiClient.put.mockResolvedValue({ data: { data: mockParam } } as never);

      const result = await adminApi.updateSystemParam('test', {
        paramValue: { new: true },
      });

      expect(mockApiClient.put).toHaveBeenCalledWith('/admin/params/test', {
        paramValue: { new: true },
      });
      expect(result).toEqual(mockParam);
    });
  });
});
