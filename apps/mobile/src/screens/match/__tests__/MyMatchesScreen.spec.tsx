import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MyMatchesScreen } from '../MyMatchesScreen';
import { matchService } from '@/api/match.service';
import type { MatchListResponse } from '@/api/match.service';
import type { PaginatedResponse } from '@shared/common';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: (cb: () => void) => {
      const React = require('react');
      React.useEffect(() => { cb(); }, []);
    },
  };
});

jest.mock('@/api/match.service', () => ({
  matchService: {
    getMyMatches: jest.fn(),
  },
}));

describe('MyMatchesScreen', () => {
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

  const mockPaginatedResponse = (
    list: MatchListResponse[],
    total?: number,
  ): PaginatedResponse<MatchListResponse> => ({
    page: 1,
    pageSize: 10,
    total: total ?? list.length,
    list,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (matchService.getMyMatches as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<MyMatchesScreen />);
    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render match cards after loading', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockMatch]),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
    expect(screen.getByText('3v3短赛')).toBeTruthy();
  });

  it('should show empty state when no matches', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([]),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无比赛')).toBeTruthy();
    });
  });

  it('should show dynamic empty state text based on active filter', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([]),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无比赛')).toBeTruthy();
    });

    // Switch to "等待确认" filter
    fireEvent.press(screen.getByLabelText('筛选等待确认'));

    await waitFor(() => {
      expect(screen.getByText('暂无待确认的比赛')).toBeTruthy();
    });
  });

  it('should show error state with retry button on failure', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockRejectedValue(new Error('网络错误'));

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeTruthy();
    });
    expect(screen.getByLabelText('重试')).toBeTruthy();
  });

  it('should reload on retry press', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock)
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce(mockPaginatedResponse([mockMatch]));

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
  });

  it('should navigate to MatchDetail on card press', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockMatch]),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('比赛卡片-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('比赛卡片-1'));
    expect(mockNavigate).toHaveBeenCalledWith('MatchDetail', { matchId: 1 });
  });

  it('should show correct status badges', async () => {
    jest.useRealTimers();
    const matches: MatchListResponse[] = [
      { ...mockMatch, id: 1, status: 'pending_confirmation' },
      { ...mockMatch, id: 2, status: 'confirmed' },
      { ...mockMatch, id: 3, status: 'in_progress' },
      { ...mockMatch, id: 4, status: 'completed' },
      { ...mockMatch, id: 5, status: 'cancelled' },
      { ...mockMatch, id: 6, status: 'failed' },
    ];
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(matches, 6),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getAllByText('等待确认').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText('已确认').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('进行中').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已取消').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('匹配失败').length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by status when tab is pressed', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockMatch]),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('筛选已确认'));

    await waitFor(() => {
      expect(matchService.getMyMatches).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed' }),
      );
    });
  });

  it('should pass pagination params correctly', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockMatch]),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(matchService.getMyMatches).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 10 }),
      );
    });
  });

  it('should not trigger load more when no more data', async () => {
    jest.useRealTimers();
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockMatch], 1),
    );

    render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });

    // total(1) <= page(1) * pageSize(10) → hasMore should be false
    expect(matchService.getMyMatches).toHaveBeenCalledTimes(1);
  });
});
