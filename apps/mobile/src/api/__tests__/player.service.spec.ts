import { playerService, PlayerServiceError } from '../player.service';
import { apiClient } from '../client';
import type { PlayerProfile, PlayerAbility, ApiResponse } from '@shared/index';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('PlayerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockProfile: PlayerProfile = {
    id: 1,
    userId: 1,
    phone: '138****8000',
    nickname: 'TestPlayer',
    realName: '张**',
    avatarUrl: 'https://example.com/avatar.jpg',
    age: 25,
    basketballAge: 5,
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 190,
    standingReach: 230,
    jumpingReach: 310,
    positions: ['PG', 'SG'],
    baseAbilityScore: 72.5,
    matchAdjustValue: 2.0,
    totalAbilityScore: 74.5,
    regionCode: 'shenzhen_futian',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };

  const mockAbility: PlayerAbility = {
    baseAbilityScore: 72.5,
    matchAdjustValue: 2.0,
    totalAbilityScore: 74.5,
  };

  describe('getProfile', () => {
    it('should send GET to /players/profile and return PlayerProfile', async () => {
      const mockResponse: ApiResponse<PlayerProfile> = {
        code: 200,
        message: 'success',
        data: mockProfile,
      };

      mockedApiClient.get = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await playerService.getProfile();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/players/profile');
      expect(result).toEqual(mockProfile);
    });

    it('should throw PlayerServiceError on failure', async () => {
      mockedApiClient.get = jest.fn().mockRejectedValue({
        response: { data: { code: 401, message: '未登录' } },
      });

      await expect(playerService.getProfile()).rejects.toThrow('未登录');
    });

    it('should return default error message on network error', async () => {
      mockedApiClient.get = jest.fn().mockRejectedValue(new Error('Network Error'));

      await expect(playerService.getProfile()).rejects.toThrow('网络错误，请稍后重试');
    });
  });

  describe('updateProfile', () => {
    it('should send PUT to /players/profile and return updated PlayerProfile', async () => {
      const updateDto = {
        age: 26,
        basketballAge: 6,
        gender: 'male' as const,
        height: 181,
        weight: 76,
        positions: ['PG', 'SG', 'SF'] as const,
      };

      const mockResponse: ApiResponse<PlayerProfile> = {
        code: 200,
        message: 'success',
        data: { ...mockProfile, ...updateDto },
      };

      mockedApiClient.put = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await playerService.updateProfile(updateDto);

      expect(mockedApiClient.put).toHaveBeenCalledWith('/players/profile', updateDto);
      expect(result).toEqual(expect.objectContaining(updateDto));
    });

    it('should throw PlayerServiceError on update failure', async () => {
      mockedApiClient.put = jest.fn().mockRejectedValue({
        response: { data: { code: 400, message: '身高超出范围' } },
      });

      await expect(
        playerService.updateProfile({ age: 25, gender: 'male', height: 400, positions: ['PG'] }),
      ).rejects.toThrow('身高超出范围');
    });

    it('should handle optional fields correctly', async () => {
      const updateDto = {
        age: 25,
        basketballAge: 5,
        gender: 'male' as const,
        height: 180,
        positions: ['PG'] as const,
      };

      const mockResponse: ApiResponse<PlayerProfile> = {
        code: 200,
        message: 'success',
        data: mockProfile,
      };

      mockedApiClient.put = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await playerService.updateProfile(updateDto);

      expect(mockedApiClient.put).toHaveBeenCalledWith('/players/profile', updateDto);
      expect(result).toEqual(mockProfile);
    });
  });

  describe('getAbility', () => {
    it('should send GET to /players/ability and return PlayerAbility', async () => {
      const mockResponse: ApiResponse<PlayerAbility> = {
        code: 200,
        message: 'success',
        data: mockAbility,
      };

      mockedApiClient.get = jest.fn().mockResolvedValue({ data: mockResponse });

      const result = await playerService.getAbility();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/players/ability');
      expect(result).toEqual(mockAbility);
    });

    it('should throw PlayerServiceError on failure', async () => {
      mockedApiClient.get = jest.fn().mockRejectedValue({
        response: { data: { code: 500, message: '服务器内部错误' } },
      });

      await expect(playerService.getAbility()).rejects.toThrow('服务器内部错误');
    });
  });

  describe('PlayerServiceError', () => {
    it('should have correct name and message', () => {
      const error = new PlayerServiceError('用户友好错误');
      expect(error.name).toBe('PlayerServiceError');
      expect(error.message).toBe('用户友好错误');
    });
  });
});
