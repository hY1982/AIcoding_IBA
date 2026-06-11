import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { CreateIntentionScreen } from '../CreateIntentionScreen';
import { intentionService } from '@/api/intention.service';
import { venueService } from '@/api/venue.service';
import { formatService } from '@/api/format.service';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
    }),
  };
});

jest.mock('@/api/intention.service', () => ({
  intentionService: {
    createIntention: jest.fn(),
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

const mockVenues = [
  { id: 1, name: '深圳湾体育中心', address: '南山区', pricePerHour: 100, courtCount: 2, status: 'active' },
  { id: 2, name: '福田体育公园', address: '福田区', pricePerHour: 80, courtCount: 3, status: 'active' },
  { id: 3, name: '南山文体中心', address: '南山区', pricePerHour: 90, courtCount: 2, status: 'active' },
  { id: 4, name: '宝安体育馆', address: '宝安区', pricePerHour: 70, courtCount: 4, status: 'active' },
];

const mockFormats = [
  { id: 1, name: '3v3短赛', formatType: 'short', teamSize: 3, teamCountMin: 3, teamCountMax: 4, isActive: true, createdAt: '2026-01-01' },
  { id: 2, name: '4v4短赛', formatType: 'short', teamSize: 4, teamCountMin: 3, teamCountMax: 4, isActive: true, createdAt: '2026-01-01' },
  { id: 3, name: '5v5短赛', formatType: 'short', teamSize: 5, teamCountMin: 3, teamCountMax: 4, isActive: true, createdAt: '2026-01-01' },
];

describe('CreateIntentionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (venueService.getVenues as jest.Mock).mockResolvedValue({ list: mockVenues, page: 1, pageSize: 100, total: 4 });
    (formatService.getFormats as jest.Mock).mockResolvedValue(mockFormats);
  });

  it('should show loading state while fetching data', () => {
    (venueService.getVenues as jest.Mock).mockReturnValue(new Promise(() => {}));
    (formatService.getFormats as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<CreateIntentionScreen />);
    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render form after data loads', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('选择日期')).toBeTruthy();
    });
    expect(screen.getByText('选择时间')).toBeTruthy();
    expect(screen.getByText('持续时长')).toBeTruthy();
    expect(screen.getByText('选择场地')).toBeTruthy();
    expect(screen.getByText('选择赛制')).toBeTruthy();
  });

  it('should show error when data loading fails', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockRejectedValue(new Error('加载失败'));

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeTruthy();
    });
  });

  it('should select date chip and highlight', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('今天')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('今天'));
    // after pressing, time slots should be visible
    expect(screen.getByText('选择时间')).toBeTruthy();
  });

  it('should select time chip', async () => {
    jest.useRealTimers();

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('明天')).toBeTruthy();
    });

    // Select "tomorrow" so all time slots are available regardless of timezone
    fireEvent.press(screen.getByText('明天'));

    await waitFor(() => {
      expect(screen.getByText('08:00')).toBeTruthy();
    });
  });

  it('should filter time slots for today (>= now + 1h)', async () => {
    jest.useRealTimers();
    // Mock Date.now to a fixed time where filtering makes a visible difference
    // We'll verify by checking that selecting "today" shows fewer time slots
    // than selecting "tomorrow" (which shows all slots)
    const mockNow = new Date();
    mockNow.setHours(15, 30, 0, 0); // 15:30 local time
    jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('今天')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('今天'));

    // After pressing today with now=15:30, only times >= 16:30 should show
    // So 17:00 should be available
    await waitFor(() => {
      expect(screen.getByText('17:00')).toBeTruthy();
    });

    // 15:00 should NOT be shown (< 15:30 + 1h = 16:30)
    expect(screen.queryByText('15:00')).toBeNull();
    // 14:00 should NOT be shown
    expect(screen.queryByText('14:00')).toBeNull();

    jest.restoreAllMocks();
  });

  it('should select duration chip', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('2h')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('3h'));
    // Chip should be selected - we just verify no crash
    expect(screen.getByText('3h')).toBeTruthy();
  });

  it('should handle venue multi-select (max 3)', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('深圳湾体育中心'));
    fireEvent.press(screen.getByText('福田体育公园'));
    fireEvent.press(screen.getByText('南山文体中心'));

    // After 3 selections, 4th should be disabled
    const fourthChip = screen.getByLabelText('宝安体育馆');
    expect(fourthChip.props.accessibilityState?.disabled).toBe(true);
  });

  it('should handle format multi-select (max 3)', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('3v3短赛')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('3v3短赛'));
    fireEvent.press(screen.getByText('4v4短赛'));

    expect(screen.getByText('1. 3v3短赛')).toBeTruthy();
    expect(screen.getByText('2. 4v4短赛')).toBeTruthy();
  });

  it('should show validation error when no date selected on submit', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('提交意向')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('提交意向'));

    await waitFor(() => {
      expect(screen.getByText('请选择日期')).toBeTruthy();
    });
  });

  it('should show validation error when no venue selected on submit', async () => {
    jest.useRealTimers();
  
    render(<CreateIntentionScreen />);
  
    await waitFor(() => {
      expect(screen.getByText('明天')).toBeTruthy();
    });
  
    // Select date (tomorrow so all times available), time, duration but no venue
    fireEvent.press(screen.getByText('明天'));
    await waitFor(() => { expect(screen.getByText('08:00')).toBeTruthy(); });
    fireEvent.press(screen.getByText('08:00'));
    fireEvent.press(screen.getByText('2h'));
  
    // Select a format
    fireEvent.press(screen.getByText('3v3短赛'));
  
    fireEvent.press(screen.getByLabelText('提交意向'));
  
    await waitFor(() => {
      expect(screen.getByText('请至少选择一个场地')).toBeTruthy();
    });
  });

  it('should show validation error when no format selected on submit', async () => {
    jest.useRealTimers();
  
    render(<CreateIntentionScreen />);
  
    await waitFor(() => {
      expect(screen.getByText('明天')).toBeTruthy();
    });
  
    // Select date (tomorrow), time, duration, venue but no format
    fireEvent.press(screen.getByText('明天'));
    await waitFor(() => { expect(screen.getByText('08:00')).toBeTruthy(); });
    fireEvent.press(screen.getByText('08:00'));
    fireEvent.press(screen.getByText('2h'));
    fireEvent.press(screen.getByText('深圳湾体育中心'));
  
    fireEvent.press(screen.getByLabelText('提交意向'));
  
    await waitFor(() => {
      expect(screen.getByText('请至少选择一个赛制')).toBeTruthy();
    });
  });

  it('should submit successfully and go back', async () => {
    jest.useRealTimers();
    (intentionService.createIntention as jest.Mock).mockResolvedValue({ id: 1 });

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('明天')).toBeTruthy();
    });

    // Fill form completely using tomorrow (all times available)
    fireEvent.press(screen.getByText('明天'));
    await waitFor(() => { expect(screen.getByText('08:00')).toBeTruthy(); });
    fireEvent.press(screen.getByText('08:00'));
    fireEvent.press(screen.getByText('2h'));
    fireEvent.press(screen.getByText('深圳湾体育中心'));
    fireEvent.press(screen.getByText('3v3短赛'));

    fireEvent.press(screen.getByLabelText('提交意向'));

    await waitFor(() => {
      expect(intentionService.createIntention).toHaveBeenCalled();
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should show error message on submit failure', async () => {
    jest.useRealTimers();
    (intentionService.createIntention as jest.Mock).mockRejectedValue(new Error('时间重叠'));

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByText('明天')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('明天'));
    await waitFor(() => { expect(screen.getByText('08:00')).toBeTruthy(); });
    fireEvent.press(screen.getByText('08:00'));
    fireEvent.press(screen.getByText('2h'));
    fireEvent.press(screen.getByText('深圳湾体育中心'));
    fireEvent.press(screen.getByText('3v3短赛'));

    fireEvent.press(screen.getByLabelText('提交意向'));

    await waitFor(() => {
      expect(screen.getByText('时间重叠')).toBeTruthy();
    });
  });
});
