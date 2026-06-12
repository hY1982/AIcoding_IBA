import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MatchDetailScreen } from '../MatchDetailScreen';
import { matchService } from '@/api/match.service';
import type { MatchDetailResponse } from '@/api/match.service';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line prefer-const
let mockRouteParams: Record<string, unknown> = { matchId: 1 };

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
    useFocusEffect: (cb: () => void) => {
      const React = require('react');
      React.useEffect(() => { cb(); }, []);
    },
  };
});

jest.mock('@/api/match.service', () => ({
  matchService: {
    getMatchDetail: jest.fn(),
    declineParticipation: jest.fn(),
  },
}));

jest.spyOn(Alert, 'alert');

describe('MatchDetailScreen', () => {
  const mockMatchDetail: MatchDetailResponse = {
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
    teams: [
      { teamNumber: 1, teamName: '队伍 1', avgAbility: '55.00' },
      { teamNumber: 2, teamName: '队伍 2', avgAbility: '54.50' },
    ],
    players: [
      { playerId: 42, nickname: '球员A', teamNumber: 1, status: 'invited', isReserve: false },
      { playerId: 43, nickname: '球员B', teamNumber: 1, status: 'confirmed', isReserve: false },
      { playerId: 44, nickname: '球员C', teamNumber: 2, status: 'confirmed', isReserve: true },
    ],
    groupChatId: 'chat_room_1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouteParams = { matchId: 1 };
  });

  it('should render loading state initially', () => {
    (matchService.getMatchDetail as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<MatchDetailScreen />);
    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render match info after loading', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
    expect(screen.getByText('3v3短赛')).toBeTruthy();
    expect(screen.getByText('¥50.00')).toBeTruthy();
  });

  it('should render team assignments', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('队伍分配')).toBeTruthy();
    });
    expect(screen.getByText('队伍 1')).toBeTruthy();
    expect(screen.getByText('队伍 2')).toBeTruthy();
  });

  it('should render player list', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('参赛球员')).toBeTruthy();
    });
    expect(screen.getByText('球员A')).toBeTruthy();
    expect(screen.getByText('球员B')).toBeTruthy();
    expect(screen.getByText('球员C')).toBeTruthy();
  });

  it('should show error state with retry on failure', async () => {
    (matchService.getMatchDetail as jest.Mock).mockRejectedValue(new Error('比赛不存在'));

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('比赛不存在')).toBeTruthy();
    });
    expect(screen.getByLabelText('重试')).toBeTruthy();
  });

  it('should show confirm and decline buttons when playerStatus is invited', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('确认参赛')).toBeTruthy();
    });
    expect(screen.getByLabelText('拒绝参赛')).toBeTruthy();
  });

  it('should not show action buttons when playerStatus is confirmed', async () => {
    const confirmedDetail = { ...mockMatchDetail, playerStatus: 'confirmed' as const };
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(confirmedDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
    expect(screen.queryByLabelText('确认参赛')).toBeNull();
    expect(screen.queryByLabelText('拒绝参赛')).toBeNull();
  });

  it('should navigate to ConfirmMatch when confirm button pressed', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('确认参赛')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('确认参赛'));
    expect(mockNavigate).toHaveBeenCalledWith('ConfirmMatch', {
      matchId: 1,
      depositAmount: '50.00',
    });
  });

  it('should show alert when decline button pressed', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('拒绝参赛')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('拒绝参赛'));
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('should refresh data after successful decline', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);
    (matchService.declineParticipation as jest.Mock).mockResolvedValue({
      success: true,
      message: '已拒绝参赛',
    });

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('拒绝参赛')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('拒绝参赛'));

    // Simulate alert confirm
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmButton = alertCall[2].find((btn: { text: string }) => btn.text === '确定');
    await act(async () => {
      confirmButton.onPress();
    });

    await waitFor(() => {
      expect(matchService.declineParticipation).toHaveBeenCalledWith(1);
    });

    // Should re-fetch detail after decline
    await waitFor(() => {
      expect(matchService.getMatchDetail).toHaveBeenCalledTimes(2);
    });
  });

  it('should show chat button when groupChatId exists', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('进入群聊')).toBeTruthy();
    });
  });

  it('should navigate to Chat when chat button pressed', async () => {
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('进入群聊')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('进入群聊'));
    expect(mockNavigate).toHaveBeenCalledWith('Chat', {
      matchId: 1,
      matchTitle: expect.any(String),
    });
  });

  it('should not show chat button when groupChatId is null', async () => {
    const noChatDetail = { ...mockMatchDetail, groupChatId: null };
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(noChatDetail);

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
    expect(screen.queryByLabelText('进入群聊')).toBeNull();
  });
});
