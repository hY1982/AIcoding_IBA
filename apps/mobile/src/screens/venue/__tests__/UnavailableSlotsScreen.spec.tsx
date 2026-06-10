import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { UnavailableSlotsScreen } from '../UnavailableSlotsScreen';
import { venueService } from '@/api/venue.service';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: { venueId: 1, venueName: '测试场馆' },
    }),
  };
});

jest.mock('@/api/venue.service', () => ({
  venueService: {
    getUnavailableSlots: jest.fn(),
    createUnavailableSlot: jest.fn(),
    deleteUnavailableSlot: jest.fn(),
  },
}));

describe('UnavailableSlotsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (venueService.getUnavailableSlots as jest.Mock).mockResolvedValue([]);
  });

  it('should render header with venue name', () => {
    render(<UnavailableSlotsScreen />);
    expect(screen.getByText('测试场馆')).toBeTruthy();
    expect(screen.getByText('管理不可预订时段')).toBeTruthy();
  });

  it('should render date selection chips', () => {
    render(<UnavailableSlotsScreen />);
    // 应该显示未来14天的日期
    const dateChips = screen.getAllByText(/^\d{2}-\d{2}$/);
    expect(dateChips.length).toBeGreaterThan(0);
  });

  it('should render form fields', () => {
    render(<UnavailableSlotsScreen />);
    expect(screen.getByText('录入不可预订时段')).toBeTruthy();
    expect(screen.getByText('开始时间')).toBeTruthy();
    expect(screen.getByText('结束时间')).toBeTruthy();
    expect(screen.getByText('添加不可预订时段')).toBeTruthy();
  });

  it('should render time picker chips', () => {
    render(<UnavailableSlotsScreen />);
    // 时间 chip 在开始时间和结束时间区域都会出现
    expect(screen.getAllByText('08:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('12:00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('16:00').length).toBeGreaterThanOrEqual(1);
  });

  it('should render empty state after loading', async () => {
    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('该日期暂无不可预订时段')).toBeTruthy();
    });
  });

  it('should call getUnavailableSlots on mount', async () => {
    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(venueService.getUnavailableSlots).toHaveBeenCalledWith(1, expect.any(String));
    });
  });

  it('should render unavailable slots after loading', async () => {
    (venueService.getUnavailableSlots as jest.Mock).mockResolvedValue([
      { id: 1, venueId: 1, slotDate: '2024-01-01', startTime: '10:00', endTime: '12:00', reason: '维护' },
      { id: 2, venueId: 1, slotDate: '2024-01-01', startTime: '14:00', endTime: '16:00', reason: null },
    ]);

    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('10:00 - 12:00')).toBeTruthy();
      expect(screen.getByText('维护')).toBeTruthy();
      expect(screen.getByText('14:00 - 16:00')).toBeTruthy();
    });

    const deleteButtons = screen.getAllByText('删除');
    expect(deleteButtons.length).toBe(2);
  });

  it('should show error state when API fails', async () => {
    (venueService.getUnavailableSlots as jest.Mock).mockRejectedValue(new Error('网络错误'));

    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeTruthy();
      expect(screen.getByText('重试')).toBeTruthy();
    });
  });

  it('should call createUnavailableSlot on valid submit', async () => {
    (venueService.createUnavailableSlot as jest.Mock).mockResolvedValue({
      id: 3, venueId: 1, slotDate: '2024-01-01', startTime: '08:00', endTime: '10:00', reason: '测试',
    });

    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('该日期暂无不可预订时段')).toBeTruthy();
    });

    // 选择 08:00 作为开始时间
    const startTimeChips = screen.getAllByText('08:00');
    fireEvent.press(startTimeChips[0]);

    // 选择 10:00 作为结束时间
    const endTimeChips = screen.getAllByText('10:00');
    fireEvent.press(endTimeChips[endTimeChips.length - 1]);

    // 点击提交
    fireEvent.press(screen.getByText('添加不可预订时段'));

    await waitFor(() => {
      expect(venueService.createUnavailableSlot).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startTime: '08:00',
          endTime: '10:00',
        }),
      );
    });
  });

  it('should show form error when end time is not after start time', async () => {
    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('该日期暂无不可预订时段')).toBeTruthy();
    });

    // 选择 14:00 作为开始时间
    const startTimeChips = screen.getAllByText('14:00');
    fireEvent.press(startTimeChips[0]);

    // 选择 12:00 作为结束时间（早于开始时间）
    const endTimeChips = screen.getAllByText('12:00');
    fireEvent.press(endTimeChips[endTimeChips.length - 1]);

    // 点击提交
    fireEvent.press(screen.getByText('添加不可预订时段'));

    await waitFor(() => {
      expect(screen.getByText('结束时间必须晚于开始时间')).toBeTruthy();
    });
  });

  it('should show form error when times overlap', async () => {
    (venueService.getUnavailableSlots as jest.Mock).mockResolvedValue([
      { id: 1, venueId: 1, slotDate: '2024-01-01', startTime: '10:00', endTime: '12:00', reason: '维护' },
    ]);

    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('10:00 - 12:00')).toBeTruthy();
    });

    // 选择 11:00 作为开始时间
    const startTimeChips = screen.getAllByText('11:00');
    fireEvent.press(startTimeChips[0]);

    // 选择 13:00 作为结束时间（与 10:00-12:00 重叠）
    const endTimeChips = screen.getAllByText('13:00');
    fireEvent.press(endTimeChips[endTimeChips.length - 1]);

    // 点击提交
    fireEvent.press(screen.getByText('添加不可预订时段'));

    await waitFor(() => {
      expect(screen.getByText(/与已有时段.*重叠/)).toBeTruthy();
    });
  });

  it('should call deleteUnavailableSlot when delete pressed', async () => {
    (venueService.getUnavailableSlots as jest.Mock).mockResolvedValue([
      { id: 1, venueId: 1, slotDate: '2024-01-01', startTime: '10:00', endTime: '12:00', reason: '维护' },
    ]);
    (venueService.deleteUnavailableSlot as jest.Mock).mockResolvedValue(undefined);

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<UnavailableSlotsScreen />);
    await waitFor(() => {
      expect(screen.getByText('10:00 - 12:00')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('删除'));
    expect(alertSpy).toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
