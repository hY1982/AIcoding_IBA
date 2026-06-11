import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { IntentionDetailScreen } from '../IntentionDetailScreen';
import { intentionService } from '@/api/intention.service';
import type { IntentionResponse } from '@/api/intention.service';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: { intentionId: 1 },
    }),
    useFocusEffect: (cb: () => void) => {
      const React = require('react');
      React.useEffect(() => { cb(); }, []);
    },
  };
});

jest.mock('@/api/intention.service', () => ({
  intentionService: {
    getMyIntentionById: jest.fn(),
    cancelIntention: jest.fn(),
  },
}));

jest.spyOn(Alert, 'alert');

describe('IntentionDetailScreen', () => {
  const mockIntention: IntentionResponse = {
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
      { formatId: 2, priority: 2, formatName: '5v5短赛' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    (intentionService.getMyIntentionById as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<IntentionDetailScreen />);
    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render intention details', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(mockIntention);

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('等待匹配')).toBeTruthy();
    });
    expect(screen.getByText('1. 深圳湾体育中心')).toBeTruthy();
    expect(screen.getByText('2. 福田体育公园')).toBeTruthy();
    expect(screen.getByText('1. 3v3短赛')).toBeTruthy();
    expect(screen.getByText('2. 5v5短赛')).toBeTruthy();
  });

  it('should show error state with retry', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockRejectedValue(new Error('加载失败'));

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeTruthy();
    });
    expect(screen.getByLabelText('重试')).toBeTruthy();
  });

  it('should show cancel button only for pending status', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(mockIntention);

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('取消意向')).toBeTruthy();
    });
  });

  it('should NOT show cancel button for non-pending status', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue({ ...mockIntention, status: 'matched' });

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('已匹配')).toBeTruthy();
    });
    expect(screen.queryByLabelText('取消意向')).toBeNull();
  });

  it('should show Alert on cancel press', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(mockIntention);

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('取消意向')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('取消意向'));

    expect(Alert.alert).toHaveBeenCalledWith(
      '确认取消',
      '确定要取消这个意向吗？',
      expect.any(Array),
    );
  });

  it('should cancel intention successfully', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(mockIntention);
    (intentionService.cancelIntention as jest.Mock).mockResolvedValue({
      ...mockIntention,
      status: 'cancelled',
    });

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('取消意向')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('取消意向'));

    // Simulate pressing "确定" in Alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmButton = alertCall[2].find((btn: { text: string }) => btn.text === '确定');
    confirmButton.onPress();

    await waitFor(() => {
      expect(intentionService.cancelIntention).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText('已取消')).toBeTruthy();
    });
  });

  it('should show error on cancel failure', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(mockIntention);
    (intentionService.cancelIntention as jest.Mock).mockRejectedValue(new Error('取消失败'));

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('取消意向')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('取消意向'));

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmButton = alertCall[2].find((btn: { text: string }) => btn.text === '确定');
    confirmButton.onPress();

    await waitFor(() => {
      expect(screen.getByText('取消失败')).toBeTruthy();
    });
  });

  it('should show correct badge colors for different statuses', async () => {
    jest.useRealTimers();
    const statuses = ['pending', 'matched', 'confirmed', 'cancelled', 'expired', 'failed'] as const;
    const labels = ['等待匹配', '已匹配', '已确认', '已取消', '已过期', '匹配失败'];

    for (let i = 0; i < statuses.length; i++) {
      (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(
        { ...mockIntention, status: statuses[i] },
      );

      const { unmount } = render(<IntentionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText(labels[i])).toBeTruthy();
      });

      unmount();
    }
  });

  it('should show match info when matchId is present', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(
      { ...mockIntention, status: 'matched', matchId: 42 },
    );

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText(/比赛.*42/)).toBeTruthy();
    });
  });
});
