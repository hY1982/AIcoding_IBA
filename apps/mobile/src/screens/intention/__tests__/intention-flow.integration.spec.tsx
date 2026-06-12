/**
 * Integration test — Intention management flow
 *
 * Tests navigation and data flow between screens:
 * 1. Happy path: List → Create → Submit → Back to List
 * 2. Cancel flow: List → Detail → Cancel → Status updated
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MyIntentionsScreen } from '../MyIntentionsScreen';
import { CreateIntentionScreen } from '../CreateIntentionScreen';
import { IntentionDetailScreen } from '../IntentionDetailScreen';
import { intentionService } from '@/api/intention.service';
import { venueService } from '@/api/venue.service';
import { formatService } from '@/api/format.service';
import type { IntentionResponse } from '@/api/intention.service';
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

jest.mock('@/api/intention.service', () => ({
  intentionService: {
    getMyIntentions: jest.fn(),
    createIntention: jest.fn(),
    getMyIntentionById: jest.fn(),
    cancelIntention: jest.fn(),
  },
}));

jest.mock('@/api/venue.service', () => ({
  venueService: {
    getVenues: jest.fn(),
  },
}));

jest.mock('@/api/format.service', () => ({
  formatService: {
    getFormats: jest.fn(),
  },
}));

jest.spyOn(Alert, 'alert');

const mockIntention: IntentionResponse = {
  id: 1,
  playerId: 42,
  startTime: '2026-06-13T08:00:00.000Z',
  durationMinutes: 120,
  acceptableWaitMinutes: 30,
  endTime: '2026-06-13T10:00:00.000Z',
  status: 'pending',
  matchId: null,
  regionCode: null,
  submittedAt: '2026-06-12T20:00:00.000Z',
  updatedAt: '2026-06-12T20:00:00.000Z',
  expiresAt: '2026-06-13T10:00:00.000Z',
  venues: [{ venueId: 1, priority: 1, venueName: '深圳湾体育中心' }],
  formats: [{ formatId: 1, priority: 1, formatName: '3v3短赛' }],
};

const mockPaginated = (list: IntentionResponse[]): PaginatedResponse<IntentionResponse> => ({
  page: 1, pageSize: 10, total: list.length, list,
});

const mockVenues = [
  { id: 1, name: '深圳湾体育中心', address: '南山区', pricePerHour: 100, courtCount: 2, status: 'active' },
];

const mockFormats = [
  { id: 1, name: '3v3短赛', formatType: 'short', teamSize: 3, teamCountMin: 3, teamCountMax: 4, isActive: true, createdAt: '2026-01-01' },
];

describe('Intention Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouteParams = {};
  });

  it('Happy path: list → create → submit → goBack', async () => {
    // Step 1: MyIntentionsScreen renders with empty list
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(mockPaginated([]));

    const { unmount: unmountList } = render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无意向')).toBeTruthy();
    });

    // User taps "发布意向" → should navigate
    fireEvent.press(screen.getByLabelText('发布意向'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateIntention');
    unmountList();

    // Step 2: CreateIntentionScreen renders
    (venueService.getVenues as jest.Mock).mockResolvedValue({ list: mockVenues, page: 1, pageSize: 100, total: 1 });
    (formatService.getFormats as jest.Mock).mockResolvedValue(mockFormats);
    (intentionService.createIntention as jest.Mock).mockResolvedValue(mockIntention);

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Fill form via dropdowns
    fireEvent.press(screen.getByLabelText('请选择日期'));
    await waitFor(() => { expect(screen.getByLabelText('明天')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('明天'));

    await waitFor(() => { expect(screen.getByLabelText('请选择时间')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('请选择时间'));
    await waitFor(() => { expect(screen.getByLabelText('08:00')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('08:00'));

    await waitFor(() => { expect(screen.getByLabelText('请选择持续时长')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('请选择持续时长'));
    await waitFor(() => { expect(screen.getByLabelText('2小时')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('2小时'));

    fireEvent.press(screen.getByText('深圳湾体育中心'));
    fireEvent.press(screen.getByText('3v3短赛'));

    // Select acceptable wait
    await waitFor(() => { expect(screen.getByLabelText('请选择可接受等待时长')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('请选择可接受等待时长'));
    await waitFor(() => { expect(screen.getByLabelText('30分钟')).toBeTruthy(); });
    fireEvent.press(screen.getByLabelText('30分钟'));

    // Submit
    fireEvent.press(screen.getByLabelText('提交意向'));

    await waitFor(() => {
      expect(intentionService.createIntention).toHaveBeenCalled();
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('Cancel flow: list → detail → cancel → status updated', async () => {
    // Step 1: List shows pending intention
    (intentionService.getMyIntentions as jest.Mock).mockResolvedValue(mockPaginated([mockIntention]));

    const { unmount: unmountList } = render(<MyIntentionsScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('意向卡片-1')).toBeTruthy();
    });

    // Tap card → navigate to detail
    fireEvent.press(screen.getByLabelText('意向卡片-1'));
    expect(mockNavigate).toHaveBeenCalledWith('IntentionDetail', { intentionId: 1 });
    unmountList();

    // Step 2: Detail screen
    mockRouteParams = { intentionId: 1 };
    (intentionService.getMyIntentionById as jest.Mock).mockResolvedValue(mockIntention);
    (intentionService.cancelIntention as jest.Mock).mockResolvedValue({
      ...mockIntention,
      status: 'cancelled',
    });

    render(<IntentionDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('取消意向')).toBeTruthy();
    });

    // Press cancel
    fireEvent.press(screen.getByLabelText('取消意向'));

    // Confirm in Alert
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
});
