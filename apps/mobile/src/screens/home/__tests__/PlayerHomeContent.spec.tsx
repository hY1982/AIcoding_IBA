import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useAppStore } from '@/stores';
import { PlayerHomeContent } from '../PlayerHomeContent';
import { intentionService } from '@/api/intention.service';
import { matchService } from '@/api/match.service';

jest.mock('@/api/intention.service');
jest.mock('@/api/match.service');

describe('PlayerHomeContent', () => {
  const mockIntentions = [
    {
      id: 1,
      startTime: '2026-07-22T14:00:00Z',
      durationMinutes: 120,
      status: 'pending',
      venues: [{ venueId: 1, venueName: 'Test Venue' }],
      formats: [{ formatId: 1, formatName: '3v3' }],
    },
  ];

  const mockMatches = [
    {
      id: 1,
      venueName: 'Test Venue',
      formatName: '3v3',
      startTime: '2026-07-22T14:00:00Z',
      endTime: '2026-07-22T16:00:00Z',
      status: 'pending_players',
      playerStatus: 'invited',
      confirmedPlayers: 3,
      totalPlayers: 6,
    },
  ];

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    act(() => {
      useAppStore.setState({
        user: { id: 1, userType: 'player', nickname: 'TestPlayer' },
      });
    });
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue({
      list: mockIntentions,
      total: 1,
    });
    (matchService.getMyMatches as jest.Mock).mockResolvedValue({
      list: mockMatches,
      total: 1,
    });
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('should render welcome message with user nickname', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('欢迎回来，TestPlayer')).toBeTruthy();
    });
  });

  it('should render quick action buttons', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('发布意向')).toBeTruthy();
      expect(screen.getByLabelText('浏览场地')).toBeTruthy();
      expect(screen.getByLabelText('我的比赛')).toBeTruthy();
    });
  });

  it('should render recent intention cards when data exists', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('最近意向')).toBeTruthy();
      expect(screen.getByLabelText('意向卡片-1')).toBeTruthy();
    });
  });

  it('should render recent match cards when data exists', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('最近比赛')).toBeTruthy();
      expect(screen.getByLabelText('比赛卡片-1')).toBeTruthy();
    });
  });

  it('should show empty state when no intentions', async () => {
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue({
      list: [],
      total: 0,
    });

    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('暂无意向，点击发布意向开始')).toBeTruthy();
    });
  });

  it('should show empty state when no matches', async () => {
    (matchService.getMyMatches as jest.Mock).mockResolvedValue({
      list: [],
      total: 0,
    });

    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('暂无比赛')).toBeTruthy();
    });
  });

  it('should render publish intention button', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('发布意向')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('发布意向'));
    expect(screen.getByLabelText('发布意向')).toBeTruthy();
  });

  it('should render browse venue button', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('浏览场地')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('浏览场地'));
    expect(screen.getByLabelText('浏览场地')).toBeTruthy();
  });

  it('should render my matches button', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('我的比赛')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('我的比赛'));
    expect(screen.getByLabelText('我的比赛')).toBeTruthy();
  });

  it('should render intention card', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('意向卡片-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('意向卡片-1'));
    expect(screen.getByLabelText('意向卡片-1')).toBeTruthy();
  });

  it('should render match card', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('比赛卡片-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('比赛卡片-1'));
    expect(screen.getByLabelText('比赛卡片-1')).toBeTruthy();
  });

  it('should call API on mount', async () => {
    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(intentionService.getMyIntentions).toHaveBeenCalledWith({ page: 1, pageSize: 3 });
      expect(matchService.getMyMatches).toHaveBeenCalledWith({ page: 1, pageSize: 3 });
    });
  });

  it('should display error and retry button on API failure', async () => {
    (intentionService.getMyIntentions as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });
  });

  it('should retry loading when retry button pressed', async () => {
    (intentionService.getMyIntentions as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ list: mockIntentions, total: 1 });

    render(<PlayerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(intentionService.getMyIntentions).toHaveBeenCalledTimes(2);
    });
  });
});
