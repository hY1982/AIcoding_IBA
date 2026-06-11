import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MyIntentionsScreen } from '../MyIntentionsScreen';
import { intentionService } from '@/api/intention.service';
import type { IntentionResponse } from '@/api/intention.service';
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

jest.mock('@/api/intention.service', () => ({
  intentionService: {
    getMyIntentions: jest.fn(),
  },
}));

describe('MyIntentionsScreen', () => {
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
    venues: [{ venueId: 1, priority: 1, venueName: '深圳湾体育中心' }],
    formats: [{ formatId: 1, priority: 1, formatName: '3v3短赛' }],
  };

  const mockPaginatedResponse = (
    list: IntentionResponse[],
    total?: number,
  ): PaginatedResponse<IntentionResponse> => ({
    page: 1,
    pageSize: 10,
    total: total ?? list.length,
    list,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (intentionService.getMyIntentions as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<MyIntentionsScreen />);
    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render intention cards after loading', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockIntention]),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
    expect(screen.getByText('3v3短赛')).toBeTruthy();
    // '等待匹配' appears in both filter tab and status badge
    expect(screen.getAllByText('等待匹配').length).toBeGreaterThanOrEqual(2);
  });

  it('should show empty state when no intentions', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([]),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无意向')).toBeTruthy();
    });
  });

  it('should show error state with retry button on failure', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockRejectedValue(new Error('网络错误'));

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeTruthy();
    });
    expect(screen.getByLabelText('重试')).toBeTruthy();
  });

  it('should reload on retry press', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock)
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce(mockPaginatedResponse([mockIntention]));

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });
  });

  it('should navigate to IntentionDetail on card press', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockIntention]),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('意向卡片-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('意向卡片-1'));
    expect(mockNavigate).toHaveBeenCalledWith('IntentionDetail', { intentionId: 1 });
  });

  it('should navigate to CreateIntention on fab press', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockIntention]),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('发布意向')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('发布意向'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateIntention');
  });

  it('should show correct status badges', async () => {
    jest.useRealTimers();
    const intentions: IntentionResponse[] = [
      { ...mockIntention, id: 1, status: 'pending' },
      { ...mockIntention, id: 2, status: 'matched' },
      { ...mockIntention, id: 3, status: 'confirmed' },
      { ...mockIntention, id: 4, status: 'cancelled' },
      { ...mockIntention, id: 5, status: 'expired' },
      { ...mockIntention, id: 6, status: 'failed' },
    ];
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse(intentions, 6),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      // '等待匹配' appears in filter tab + each pending card badge
      expect(screen.getAllByText('等待匹配').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText('已匹配').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已确认').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已取消').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已过期').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('匹配失败').length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by status when tab is pressed', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockIntention]),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('筛选等待匹配'));

    await waitFor(() => {
      expect(intentionService.getMyIntentions).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });
  });

  it('should pass pagination params correctly', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockIntention]),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(intentionService.getMyIntentions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 10 }),
      );
    });
  });

  it('should not trigger load more when no more data', async () => {
    jest.useRealTimers();
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([mockIntention], 1),
    );

    render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });

    // total(1) <= page(1) * pageSize(10) → hasMore should be false
    expect(intentionService.getMyIntentions).toHaveBeenCalledTimes(1);
  });
});
