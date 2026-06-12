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

// Helper: open a dropdown and select an option
function openDropdown(labelText: string) {
  fireEvent.press(screen.getByLabelText(labelText));
}

function selectDropdownOption(optionText: string) {
  fireEvent.press(screen.getByLabelText(optionText));
}

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

  it('should select date via dropdown', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Open date dropdown
    openDropdown('请选择日期');

    // Select "今天" option
    await waitFor(() => {
      expect(screen.getByLabelText('今天')).toBeTruthy();
    });
    selectDropdownOption('今天');

    // After selecting, the trigger should show "今天"
    expect(screen.getByLabelText('今天')).toBeTruthy();
  });

  it('should select time via dropdown after date selected', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Select "明天" first (all times available)
    openDropdown('请选择日期');
    await waitFor(() => { expect(screen.getByLabelText('明天')).toBeTruthy(); });
    selectDropdownOption('明天');

    // Open time dropdown
    await waitFor(() => {
      expect(screen.getByLabelText('请选择时间')).toBeTruthy();
    });
    openDropdown('请选择时间');

    // Time options should be available
    await waitFor(() => {
      expect(screen.getByLabelText('08:00')).toBeTruthy();
    });
  });

  it('should filter time slots for today (>= now + 1h)', async () => {
    jest.useRealTimers();
    const mockNow = new Date();
    mockNow.setHours(15, 30, 0, 0);
    jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Select "今天"
    openDropdown('请选择日期');
    await waitFor(() => { expect(screen.getByLabelText('今天')).toBeTruthy(); });
    selectDropdownOption('今天');

    // Open time dropdown
    await waitFor(() => {
      expect(screen.getByLabelText('请选择时间')).toBeTruthy();
    });
    openDropdown('请选择时间');

    // After selecting today with now=15:30, only times >= 16:30 should show
    await waitFor(() => {
      expect(screen.getByLabelText('17:00')).toBeTruthy();
    });

    // 15:00 should NOT be shown
    expect(screen.queryByLabelText('15:00')).toBeNull();
    // 14:00 should NOT be shown
    expect(screen.queryByLabelText('14:00')).toBeNull();

    jest.restoreAllMocks();
  });

  it('should select duration via dropdown', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择持续时长')).toBeTruthy();
    });

    // Open duration dropdown
    openDropdown('请选择持续时长');

    // Select 3小时
    await waitFor(() => {
      expect(screen.getByLabelText('3小时')).toBeTruthy();
    });
    selectDropdownOption('3小时');

    // Trigger should now show selected value
    expect(screen.getByLabelText('3小时')).toBeTruthy();
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
      // "请选择日期" appears in both placeholder and error text
      const matches = screen.getAllByText('请选择日期');
      expect(matches.length).toBeGreaterThanOrEqual(2); // placeholder + error
    });
  });

  it('should show validation error when no venue selected on submit', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Select date (tomorrow), time, duration via dropdowns but no venue
    openDropdown('请选择日期');
    await waitFor(() => { expect(screen.getByLabelText('明天')).toBeTruthy(); });
    selectDropdownOption('明天');

    await waitFor(() => { expect(screen.getByLabelText('请选择时间')).toBeTruthy(); });
    openDropdown('请选择时间');
    await waitFor(() => { expect(screen.getByLabelText('08:00')).toBeTruthy(); });
    selectDropdownOption('08:00');

    await waitFor(() => { expect(screen.getByLabelText('请选择持续时长')).toBeTruthy(); });
    openDropdown('请选择持续时长');
    await waitFor(() => { expect(screen.getByLabelText('2小时')).toBeTruthy(); });
    selectDropdownOption('2小时');

    // Select a format
    fireEvent.press(screen.getByText('3v3短赛'));

    // Select acceptable wait
    openDropdown('请选择可接受等待时长');
    await waitFor(() => { expect(screen.getByLabelText('30分钟')).toBeTruthy(); });
    selectDropdownOption('30分钟');

    fireEvent.press(screen.getByLabelText('提交意向'));

    await waitFor(() => {
      expect(screen.getByText('请至少选择一个场地')).toBeTruthy();
    });
  });

  it('should show validation error when no format selected on submit', async () => {
    jest.useRealTimers();
    render(<CreateIntentionScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Select date (tomorrow), time, duration, venue but no format
    openDropdown('请选择日期');
    await waitFor(() => { expect(screen.getByLabelText('明天')).toBeTruthy(); });
    selectDropdownOption('明天');

    await waitFor(() => { expect(screen.getByLabelText('请选择时间')).toBeTruthy(); });
    openDropdown('请选择时间');
    await waitFor(() => { expect(screen.getByLabelText('08:00')).toBeTruthy(); });
    selectDropdownOption('08:00');

    await waitFor(() => { expect(screen.getByLabelText('请选择持续时长')).toBeTruthy(); });
    openDropdown('请选择持续时长');
    await waitFor(() => { expect(screen.getByLabelText('2小时')).toBeTruthy(); });
    selectDropdownOption('2小时');

    fireEvent.press(screen.getByText('深圳湾体育中心'));

    // Select acceptable wait
    openDropdown('请选择可接受等待时长');
    await waitFor(() => { expect(screen.getByLabelText('30分钟')).toBeTruthy(); });
    selectDropdownOption('30分钟');

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
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    // Fill form using dropdowns
    openDropdown('请选择日期');
    await waitFor(() => { expect(screen.getByLabelText('明天')).toBeTruthy(); });
    selectDropdownOption('明天');

    await waitFor(() => { expect(screen.getByLabelText('请选择时间')).toBeTruthy(); });
    openDropdown('请选择时间');
    await waitFor(() => { expect(screen.getByLabelText('08:00')).toBeTruthy(); });
    selectDropdownOption('08:00');

    await waitFor(() => { expect(screen.getByLabelText('请选择持续时长')).toBeTruthy(); });
    openDropdown('请选择持续时长');
    await waitFor(() => { expect(screen.getByLabelText('2小时')).toBeTruthy(); });
    selectDropdownOption('2小时');

    // Select acceptable wait
    openDropdown('请选择可接受等待时长');
    await waitFor(() => { expect(screen.getByLabelText('30分钟')).toBeTruthy(); });
    selectDropdownOption('30分钟');

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
      expect(screen.getByLabelText('请选择日期')).toBeTruthy();
    });

    openDropdown('请选择日期');
    await waitFor(() => { expect(screen.getByLabelText('明天')).toBeTruthy(); });
    selectDropdownOption('明天');

    await waitFor(() => { expect(screen.getByLabelText('请选择时间')).toBeTruthy(); });
    openDropdown('请选择时间');
    await waitFor(() => { expect(screen.getByLabelText('08:00')).toBeTruthy(); });
    selectDropdownOption('08:00');

    await waitFor(() => { expect(screen.getByLabelText('请选择持续时长')).toBeTruthy(); });
    openDropdown('请选择持续时长');
    await waitFor(() => { expect(screen.getByLabelText('2小时')).toBeTruthy(); });
    selectDropdownOption('2小时');

    // Select acceptable wait
    openDropdown('请选择可接受等待时长');
    await waitFor(() => { expect(screen.getByLabelText('30分钟')).toBeTruthy(); });
    selectDropdownOption('30分钟');

    fireEvent.press(screen.getByText('深圳湾体育中心'));
    fireEvent.press(screen.getByText('3v3短赛'));

    fireEvent.press(screen.getByLabelText('提交意向'));

    await waitFor(() => {
      expect(screen.getByText('时间重叠')).toBeTruthy();
    });
  });
});
