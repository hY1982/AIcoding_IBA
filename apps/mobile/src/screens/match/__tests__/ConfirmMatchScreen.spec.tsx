import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ConfirmMatchScreen } from '../ConfirmMatchScreen';
import { matchService } from '@/api/match.service';
import type { ConfirmParticipationResult } from '@/api/match.service';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line prefer-const
let mockRouteParams: Record<string, unknown> = { matchId: 1, depositAmount: '50.00' };

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
    confirmParticipation: jest.fn(),
  },
}));

describe('ConfirmMatchScreen', () => {
  const mockConfirmResult: ConfirmParticipationResult = {
    success: true,
    matchId: 1,
    playerId: 42,
    orderNo: 'ORD20260614100000',
    status: 'confirmed',
    matchStatus: 'pending_confirmation',
    message: '确认参赛成功，等待其他球员确认',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouteParams = { matchId: 1, depositAmount: '50.00' };
  });

  it('should render initial confirm info with deposit amount', () => {
    render(<ConfirmMatchScreen />);
    expect(screen.getByText('¥50.00')).toBeTruthy();
    expect(screen.getByLabelText('确认并支付')).toBeTruthy();
  });

  it('should call service on confirm press', async () => {
    (matchService.confirmParticipation as jest.Mock).mockResolvedValue(mockConfirmResult);

    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('确认并支付'));

    await waitFor(() => {
      expect(matchService.confirmParticipation).toHaveBeenCalledWith(1);
    });
  });

  it('should show processing state while confirming', () => {
    (matchService.confirmParticipation as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('确认并支付'));

    expect(screen.getByLabelText('处理中')).toBeTruthy();
  });

  it('should show success result after confirm', async () => {
    (matchService.confirmParticipation as jest.Mock).mockResolvedValue(mockConfirmResult);

    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('确认并支付'));

    await waitFor(() => {
      expect(screen.getByText('ORD20260614100000')).toBeTruthy();
    });
    expect(screen.getByText('确认参赛成功，等待其他球员确认')).toBeTruthy();
    expect(screen.getByLabelText('查看比赛详情')).toBeTruthy();
  });

  it('should show error on confirm failure', async () => {
    (matchService.confirmParticipation as jest.Mock).mockRejectedValue(
      new Error('已超过截止时间'),
    );

    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('确认并支付'));

    await waitFor(() => {
      expect(screen.getByText('已超过截止时间')).toBeTruthy();
    });
  });

  it('should handle alreadyConfirmed idempotent response', async () => {
    const idempotentResult = {
      success: true,
      message: '已确认参赛',
      alreadyConfirmed: true,
    };
    (matchService.confirmParticipation as jest.Mock).mockResolvedValue(idempotentResult);

    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('确认并支付'));

    await waitFor(() => {
      expect(screen.getByText('已确认参赛')).toBeTruthy();
    });
  });

  it('should goBack on return button press', () => {
    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('返回'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should goBack on view detail button press after success', async () => {
    (matchService.confirmParticipation as jest.Mock).mockResolvedValue(mockConfirmResult);

    render(<ConfirmMatchScreen />);

    fireEvent.press(screen.getByLabelText('确认并支付'));

    await waitFor(() => {
      expect(screen.getByLabelText('查看比赛详情')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('查看比赛详情'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
