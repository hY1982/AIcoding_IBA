/**
 * Integration test — Match management flow
 *
 * Tests navigation and data flow between screens:
 * 1. Confirm flow: List → Detail → ConfirmMatch → goBack
 * 2. Decline flow: List → Detail → Decline → Status updated
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MyMatchesScreen } from '../MyMatchesScreen';
import { MatchDetailScreen } from '../MatchDetailScreen';
import { ConfirmMatchScreen } from '../ConfirmMatchScreen';
import { matchService } from '@/api/match.service';
import type { MatchListResponse, MatchDetailResponse, ConfirmParticipationResult } from '@/api/match.service';
import type { PaginatedResponse } from '@shared/common';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line prefer-const
let mockRouteParams: Record<string, unknown> = {};

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
    getMyMatches: jest.fn(),
    getMatchDetail: jest.fn(),
    confirmParticipation: jest.fn(),
    declineParticipation: jest.fn(),
  },
}));

jest.spyOn(Alert, 'alert');

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

const mockPaginated = <T,>(list: T[]): PaginatedResponse<T> => ({
  page: 1, pageSize: 10, total: list.length, list,
});

const mockConfirmResult: ConfirmParticipationResult = {
  success: true,
  matchId: 1,
  playerId: 42,
  orderNo: 'ORD20260614100000',
  status: 'confirmed',
  matchStatus: 'pending_confirmation',
  message: '确认参赛成功，等待其他球员确认',
};

describe('Match Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouteParams = {};
  });

  it('Confirm flow: list → detail → confirm → goBack', async () => {
    // Step 1: MyMatchesScreen renders with one match
    (matchService.getMyMatches as jest.Mock).mockResolvedValue(mockPaginated([mockMatch]));

    const { unmount: unmountList } = render(<MyMatchesScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('比赛卡片-1')).toBeTruthy();
    });

    // Tap card → navigate to detail
    fireEvent.press(screen.getByLabelText('比赛卡片-1'));
    expect(mockNavigate).toHaveBeenCalledWith('MatchDetail', { matchId: 1 });
    unmountList();

    // Step 2: MatchDetailScreen renders
    mockRouteParams = { matchId: 1 };
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);

    const { unmount: unmountDetail } = render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('确认参赛')).toBeTruthy();
    });

    // Tap "确认参赛" → navigate to ConfirmMatch
    fireEvent.press(screen.getByLabelText('确认参赛'));
    expect(mockNavigate).toHaveBeenCalledWith('ConfirmMatch', {
      matchId: 1,
      depositAmount: '50.00',
    });
    unmountDetail();

    // Step 3: ConfirmMatchScreen renders
    mockRouteParams = { matchId: 1, depositAmount: '50.00' };
    (matchService.confirmParticipation as jest.Mock).mockResolvedValue(mockConfirmResult);

    render(<ConfirmMatchScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('确认并支付')).toBeTruthy();
    });

    // Tap confirm
    fireEvent.press(screen.getByLabelText('确认并支付'));

    await waitFor(() => {
      expect(matchService.confirmParticipation).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('查看比赛详情')).toBeTruthy();
    });

    // Tap "查看比赛详情" → goBack
    fireEvent.press(screen.getByLabelText('查看比赛详情'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('Decline flow: detail → decline → status updated', async () => {
    // Step 1: MatchDetailScreen with invited status
    mockRouteParams = { matchId: 1 };
    (matchService.getMatchDetail as jest.Mock).mockResolvedValue(mockMatchDetail);
    (matchService.declineParticipation as jest.Mock).mockResolvedValue({
      success: true,
      message: '已拒绝参赛',
    });

    render(<MatchDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('拒绝参赛')).toBeTruthy();
    });

    // Tap decline
    fireEvent.press(screen.getByLabelText('拒绝参赛'));

    // Confirm alert
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
});
