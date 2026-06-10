import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { VenueDetailScreen } from '../VenueDetailScreen';
import { venueService } from '@/api/venue.service';
import { useAppStore } from '@/stores';
import type { VenueDetail, VenueTimeSlot } from '@shared/venue';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: { venueId: 1 },
    }),
    useFocusEffect: (cb: () => (() => void) | void) => {
      React.useEffect(() => {
        const cleanup = cb();
        return cleanup;
      }, []);
    },
  };
});

jest.mock('@/api/venue.service', () => ({
  venueService: {
    getVenueDetail: jest.fn(),
    getVenueTimeSlots: jest.fn(),
    deleteVenue: jest.fn(),
  },
}));

describe('VenueDetailScreen', () => {
  const mockVenueDetail: VenueDetail = {
    id: 1,
    managerId: 1,
    name: '深圳湾体育中心篮球场',
    address: '南山区滨海大道3001号',
    pricePerHour: 120,
    courtCount: 4,
    floorMaterial: 'wood',
    courtType: 'indoor',
    lighting: 'LED专业照明',
    ventilation: true,
    bigFan: false,
    airCondition: true,
    parking: true,
    restroom: true,
    shower: true,
    lockerRoom: true,
    videoRecord: false,
    turnoverTime: 15,
    status: 'active',
    ratingAvg: 4.8,
    ratingCount: 128,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };

  const mockTimeSlots: VenueTimeSlot[] = [
    {
      id: 1,
      venueId: 1,
      slotDate: '2026-06-10',
      startTime: '09:00',
      endTime: '11:00',
      isBooked: false,
    },
    {
      id: 2,
      venueId: 1,
      slotDate: '2026-06-10',
      startTime: '11:00',
      endTime: '13:00',
      isBooked: true,
      matchId: 5,
    },
    {
      id: 3,
      venueId: 1,
      slotDate: '2026-06-11',
      startTime: '09:00',
      endTime: '11:00',
      isBooked: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ user: null, token: null });
    jest.useRealTimers();
  });

  it('should render loading state initially', () => {
    (venueService.getVenueDetail as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<VenueDetailScreen />);

    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render venue detail after loading', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });

    expect(screen.getByText('南山区滨海大道3001号')).toBeTruthy();
    expect(screen.getByText('¥120/小时')).toBeTruthy();
    expect(screen.getByLabelText('球场数量值')).toBeTruthy();
    expect(screen.getByText('木地板')).toBeTruthy();
    expect(screen.getByText('室内')).toBeTruthy();
    expect(screen.getByText('LED专业照明')).toBeTruthy();
    expect(screen.getByLabelText('翻场时间值')).toBeTruthy();
  });

  it('should render status badge correctly', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('场地状态')).toBeTruthy();
    });

    expect(screen.getByText('营业中')).toBeTruthy();
  });

  it('should render rating information when available', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('评分信息')).toBeTruthy();
    });

    expect(screen.getByLabelText('评分信息')).toBeTruthy();
    expect(screen.getByText('128')).toBeTruthy();
    expect(screen.getByText('人评价)')).toBeTruthy();
  });

  it('should render facility tags with correct active/inactive states', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('配套设施')).toBeTruthy();
    });

    expect(screen.getByLabelText('设施-通风-有')).toBeTruthy();
    expect(screen.getByLabelText('设施-空调-有')).toBeTruthy();
    expect(screen.getByLabelText('设施-大风扇-无')).toBeTruthy();
    expect(screen.getByLabelText('设施-录像-无')).toBeTruthy();
  });

  it('should render time slots grouped by date', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('时段列表')).toBeTruthy();
    });

    expect(screen.getByText('2026-06-10')).toBeTruthy();
    expect(screen.getByText('2026-06-11')).toBeTruthy();
    expect(screen.getAllByLabelText('时段-可预订').length).toBe(2);
    expect(screen.getByLabelText('时段-已预订')).toBeTruthy();
  });

  it('should show player view actions when user is a player', async () => {
    jest.useRealTimers();
    useAppStore.setState({
      user: { id: 1, nickname: 'Test', userType: 'player' },
      token: 'token',
    });
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('返回列表')).toBeTruthy();
    });

    expect(screen.queryByLabelText('编辑场地')).toBeNull();
    expect(screen.queryByLabelText('删除场地')).toBeNull();
  });

  it('should show manager view actions when user is a venue_manager', async () => {
    jest.useRealTimers();
    useAppStore.setState({
      user: { id: 1, nickname: 'Manager', userType: 'venue_manager' },
      token: 'token',
    });
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('编辑场地')).toBeTruthy();
      expect(screen.getByLabelText('删除场地')).toBeTruthy();
    });

    expect(screen.queryByLabelText('返回列表')).toBeNull();
  });

  it('should navigate back when player clicks back button', async () => {
    jest.useRealTimers();
    useAppStore.setState({
      user: { id: 1, nickname: 'Test', userType: 'player' },
      token: 'token',
    });
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('返回列表')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('返回列表'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('should navigate to EditVenue when manager clicks edit', async () => {
    jest.useRealTimers();
    useAppStore.setState({
      user: { id: 1, nickname: 'Manager', userType: 'venue_manager' },
      token: 'token',
    });
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('编辑场地')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('编辑场地'));
    expect(mockNavigate).toHaveBeenCalledWith('EditVenue', { venue: mockVenueDetail });
  });

  it('should display error message on API failure', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockRejectedValue(new Error('加载失败'));

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeTruthy();
    });
  });

  it('should retry loading when retry button pressed', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock)
      .mockRejectedValueOnce(new Error('加载失败'))
      .mockResolvedValueOnce(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(venueService.getVenueDetail).toHaveBeenCalledTimes(2);
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });
  });

  it('should refresh venue detail on pull-to-refresh', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });

    const scrollView = screen.getByLabelText('场地详情滚动区');
    const refreshControl = scrollView.props.refreshControl;
    refreshControl.props.onRefresh();

    await waitFor(() => {
      expect(venueService.getVenueDetail).toHaveBeenCalledTimes(2);
    });
  });

  it('should render empty state when venue not found', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(null);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('场地不存在')).toBeTruthy();
    });
  });

  it('should render venue without optional fields gracefully', async () => {
    jest.useRealTimers();
    const minimalVenue: VenueDetail = {
      id: 1,
      managerId: 1,
      name: '简易篮球场',
      address: '某街道',
      pricePerHour: 50,
      courtCount: 1,
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    };
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(minimalVenue);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue([]);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('简易篮球场')).toBeTruthy();
    });

    expect(screen.queryByLabelText('评分信息')).toBeNull();
  });

  it('should call getVenueDetail and getVenueTimeSlots with correct venueId', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(venueService.getVenueDetail).toHaveBeenCalledWith(1);
      expect(venueService.getVenueTimeSlots).toHaveBeenCalledWith(1);
    });
  });

  it('should render inactive status badge', async () => {
    jest.useRealTimers();
    const inactiveVenue = { ...mockVenueDetail, status: 'inactive' as const };
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(inactiveVenue);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('场地状态')).toBeTruthy();
    });

    expect(screen.getByText('已停业')).toBeTruthy();
  });

  it('should render empty time slots message', async () => {
    jest.useRealTimers();
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue([]);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无可用时段')).toBeTruthy();
    });

    expect(screen.queryByLabelText('时段列表')).toBeNull();
  });

  it('should show delete confirmation for manager', async () => {
    jest.useRealTimers();
    useAppStore.setState({
      user: { id: 1, nickname: 'Manager', userType: 'venue_manager' },
      token: 'token',
    });
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('删除场地')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('删除场地'));

    expect(alertSpy).toHaveBeenCalledWith(
      '确认删除',
      expect.stringContaining('深圳湾体育中心篮球场'),
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });

  it('should navigate to EditVenue with correct params', async () => {
    jest.useRealTimers();
    useAppStore.setState({
      user: { id: 1, nickname: 'Manager', userType: 'venue_manager' },
      token: 'token',
    });
    (venueService.getVenueDetail as jest.Mock).mockResolvedValue(mockVenueDetail);
    (venueService.getVenueTimeSlots as jest.Mock).mockResolvedValue(mockTimeSlots);

    render(<VenueDetailScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('编辑场地')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('编辑场地'));
    expect(mockNavigate).toHaveBeenCalledWith('EditVenue', { venue: mockVenueDetail });
  });
});
