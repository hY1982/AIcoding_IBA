import { matchService, MatchServiceError } from '../match.service';
import type {
  MatchListResponse,
  MatchDetailResponse,
  ConfirmParticipationResult,
  DeclineParticipationResult,
  MatchMessage,
} from '../match.service';
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

describe('MatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockMatch: MatchListResponse = {
    id: 1,
    venueId: 1,
    venueName: '深圳湾体育中心',
    formatId: 1,
    formatName: '3v3短赛',
    startTime: '2026-06-15T14:00:00.000Z',
    endTime: '2026-06-15T16:00:00.000Z',
    status: 'pending_confirmation',
    teamCount: 3,
    playersPerTeam: 3,
    totalPlayers: 9,
    confirmedPlayers: 6,
    depositAmount: '50.00',
    regionCode: 'shenzhen_futian',
    playerStatus: 'invited',
    teamNumber: 1,
    createdAt: '2026-06-14T10:00:00.000Z',
    updatedAt: '2026-06-14T10:00:00.000Z',
  };

  const mockMatchDetail: MatchDetailResponse = {
    ...mockMatch,
    teams: [{ teamNumber: 1, teamName: '队伍 1', avgAbility: '55.00' }],
    players: [
      { playerId: 42, nickname: '球员A', teamNumber: 1, status: 'invited', isReserve: false },
    ],
    groupChatId: 'chat_room_1',
  };

  const mockMessage: MatchMessage = {
    id: 1,
    matchId: 1,
    senderId: 42,
    content: '大家好',
    messageType: 'text',
    createdAt: '2026-06-15T10:00:00.000Z',
  };

  // ==================== getMyMatches ====================
  describe('getMyMatches', () => {
    const mockPaginated: PaginatedResponse<MatchListResponse> = {
      page: 1,
      pageSize: 10,
      total: 1,
      list: [mockMatch],
    };

    it('should fetch matches with pagination params', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginated },
      });

      const result = await matchService.getMyMatches({ page: 1, pageSize: 10 });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/my', {
        params: { page: 1, pageSize: 10 },
      });
      expect(result).toEqual(mockPaginated);
    });

    it('should fetch matches with status filter', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginated },
      });

      const result = await matchService.getMyMatches({ status: 'pending_confirmation' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/my', {
        params: { status: 'pending_confirmation' },
      });
      expect(result).toEqual(mockPaginated);
    });

    it('should fetch matches with default params when none provided', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginated },
      });

      const result = await matchService.getMyMatches();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/my', {
        params: undefined,
      });
      expect(result).toEqual(mockPaginated);
    });

    it('should throw MatchServiceError on server error', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '未授权访问' } },
      });

      await expect(matchService.getMyMatches()).rejects.toThrow(MatchServiceError);
      await expect(matchService.getMyMatches()).rejects.toThrow('未授权访问');
    });

    it('should throw generic error on network error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Network Error'));

      await expect(matchService.getMyMatches()).rejects.toThrow('网络错误，请稍后重试');
    });
  });

  // ==================== getMatchDetail ====================
  describe('getMatchDetail', () => {
    it('should fetch match detail by id', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockMatchDetail },
      });

      const result = await matchService.getMatchDetail(1);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/1');
      expect(result).toEqual(mockMatchDetail);
    });

    it('should throw MatchServiceError on 404', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '比赛不存在' } },
      });

      await expect(matchService.getMatchDetail(999)).rejects.toThrow(MatchServiceError);
      await expect(matchService.getMatchDetail(999)).rejects.toThrow('比赛不存在');
    });
  });

  // ==================== confirmParticipation ====================
  describe('confirmParticipation', () => {
    const mockConfirmResult: ConfirmParticipationResult = {
      success: true,
      matchId: 1,
      playerId: 42,
      orderNo: 'ORD20260614100000',
      status: 'confirmed',
      matchStatus: 'pending_confirmation',
      message: '确认参赛成功，等待其他球员确认',
    };

    it('should confirm participation and return result', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockConfirmResult },
      });

      const result = await matchService.confirmParticipation(1);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/matches/1/confirm');
      expect(result).toEqual(mockConfirmResult);
    });

    it('should throw MatchServiceError on conflict', async () => {
      mockedApiClient.post.mockRejectedValue({
        response: { data: { message: '您已经确认过参赛' } },
      });

      await expect(matchService.confirmParticipation(1)).rejects.toThrow(MatchServiceError);
      await expect(matchService.confirmParticipation(1)).rejects.toThrow('您已经确认过参赛');
    });

    it('should throw generic error on network error', async () => {
      mockedApiClient.post.mockRejectedValue(new Error('timeout'));

      await expect(matchService.confirmParticipation(1)).rejects.toThrow('网络错误，请稍后重试');
    });
  });

  // ==================== declineParticipation ====================
  describe('declineParticipation', () => {
    const mockDeclineResult: DeclineParticipationResult = {
      success: true,
      message: '已拒绝参赛',
    };

    it('should decline participation and return result', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockDeclineResult },
      });

      const result = await matchService.declineParticipation(1);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/matches/1/decline');
      expect(result).toEqual(mockDeclineResult);
    });

    it('should throw MatchServiceError on error', async () => {
      mockedApiClient.post.mockRejectedValue({
        response: { data: { message: '比赛已开始，无法拒绝' } },
      });

      await expect(matchService.declineParticipation(1)).rejects.toThrow(MatchServiceError);
      await expect(matchService.declineParticipation(1)).rejects.toThrow('比赛已开始，无法拒绝');
    });
  });

  // ==================== getMessages ====================
  describe('getMessages', () => {
    const mockPaginatedMessages: PaginatedResponse<MatchMessage> = {
      page: 1,
      pageSize: 20,
      total: 1,
      list: [mockMessage],
    };

    it('should fetch messages with pagination', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedMessages },
      });

      const result = await matchService.getMessages(1, { page: 1, pageSize: 20 });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/1/messages', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result).toEqual(mockPaginatedMessages);
    });

    it('should fetch messages with default params', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { code: 200, message: 'success', data: mockPaginatedMessages },
      });

      const result = await matchService.getMessages(1);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/matches/1/messages', {
        params: undefined,
      });
      expect(result).toEqual(mockPaginatedMessages);
    });

    it('should throw MatchServiceError on error', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { data: { message: '无权限查看消息' } },
      });

      await expect(matchService.getMessages(1)).rejects.toThrow(MatchServiceError);
      await expect(matchService.getMessages(1)).rejects.toThrow('无权限查看消息');
    });
  });

  // ==================== sendMessage ====================
  describe('sendMessage', () => {
    it('should send message and return MatchMessage', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { code: 201, message: 'success', data: mockMessage },
      });

      const result = await matchService.sendMessage(1, { content: '大家好' });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/matches/1/messages', {
        content: '大家好',
      });
      expect(result).toEqual(mockMessage);
    });

    it('should throw MatchServiceError on error', async () => {
      mockedApiClient.post.mockRejectedValue({
        response: { data: { message: '消息内容不能为空' } },
      });

      await expect(matchService.sendMessage(1, { content: '' })).rejects.toThrow(MatchServiceError);
      await expect(matchService.sendMessage(1, { content: '' })).rejects.toThrow('消息内容不能为空');
    });

    it('should throw generic error on network error', async () => {
      mockedApiClient.post.mockRejectedValue(new Error('Network Error'));

      await expect(matchService.sendMessage(1, { content: 'test' })).rejects.toThrow('网络错误，请稍后重试');
    });
  });
});
