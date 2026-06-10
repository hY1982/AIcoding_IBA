import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { VenueListScreen } from '../VenueListScreen';
import { venueService } from '@/api/venue.service';
import type { VenueListItem } from '@shared/venue';
import type { PaginatedResponse } from '@shared/common';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

jest.mock('@/api/venue.service', () => ({
  venueService: {
    getVenues: jest.fn(),
  },
}));

describe('VenueListScreen', () => {
  const mockVenues: VenueListItem[] = [
    {
      id: 1,
      name: '深圳湾体育中心篮球场',
      address: '南山区滨海大道3001号',
      pricePerHour: 120,
      courtCount: 4,
      floorMaterial: 'wood',
      courtType: 'indoor',
      ventilation: true,
      airCondition: true,
      parking: true,
      status: 'active',
      ratingAvg: 4.8,
      ratingCount: 128,
    },
    {
      id: 2,
      name: '福田体育公园篮球场',
      address: '福田区福强路3030号',
      pricePerHour: 100,
      courtCount: 6,
      floorMaterial: 'pu',
      courtType: 'indoor',
      ventilation: true,
      status: 'active',
      ratingAvg: 4.5,
      ratingCount: 86,
    },
  ];

  const mockPaginatedResponse = (
    list: VenueListItem[],
    _hasMore = false,
  ): PaginatedResponse<VenueListItem> => ({
    page: 1,
    pageSize: 10,
    total: list.length,
    list,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (!jest.isMockFunction(setTimeout)) {
      jest.useFakeTimers();
    }
  });

  it('should render loading state initially', () => {
    (venueService.getVenues as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<VenueListScreen />);

    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render venue list after loading', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });

    expect(screen.getByText('福田体育公园篮球场')).toBeTruthy();
    expect(screen.getByText('南山区滨海大道3001号')).toBeTruthy();
    expect(screen.getByText('福田区福强路3030号')).toBeTruthy();
    expect(screen.getByText('¥120/小时')).toBeTruthy();
    expect(screen.getByText('¥100/小时')).toBeTruthy();
  });

  it('should display rating information when available', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('深圳湾体育中心篮球场评分')).toBeTruthy();
    });

    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('128')).toBeTruthy();
    expect(screen.getAllByText('人评价)')[0]).toBeTruthy();
  });

  it('should display facility tags for venues', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('深圳湾体育中心篮球场设施标签')).toBeTruthy();
    });

    expect(screen.getAllByText('室内')[0]).toBeTruthy();
    expect(screen.getByText('木地板')).toBeTruthy();
    expect(screen.getByText('空调')).toBeTruthy();
  });

  it('should render empty state when no venues', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse([]));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无场地')).toBeTruthy();
    });
  });

  it('should display error message on API failure', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockRejectedValue(new Error('网络请求失败'));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('网络请求失败')).toBeTruthy();
    });
  });

  it('should retry loading when retry button pressed', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock)
      .mockRejectedValueOnce(new Error('网络请求失败'))
      .mockResolvedValueOnce(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(venueService.getVenues).toHaveBeenCalledTimes(2);
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });
  });

  it('should refresh list on pull-to-refresh', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });

    const scrollView = screen.getByLabelText('场地列表');
    const refreshControl = scrollView.props.refreshControl;

    refreshControl.props.onRefresh();

    await waitFor(() => {
      expect(venueService.getVenues).toHaveBeenCalledTimes(2);
    });
  });

  it('should navigate to VenueDetail when venue card pressed', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('场地卡片-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('场地卡片-1'));

    expect(mockNavigate).toHaveBeenCalledWith('VenueDetail', { venueId: 1 });
  });

  it('should load more venues on scroll to bottom', async () => {
    jest.useRealTimers();
    const page1Venues = Array.from({ length: 10 }, (_, i) => ({
      ...mockVenues[0],
      id: 100 + i,
      name: `场地${i}`,
    }));
    const page2Venues = [{ ...mockVenues[1], id: 200 }];

    (venueService.getVenues as jest.Mock)
      .mockResolvedValueOnce({ page: 1, pageSize: 10, total: 11, list: page1Venues })
      .mockResolvedValueOnce({ page: 2, pageSize: 10, total: 11, list: page2Venues });

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('场地0')).toBeTruthy();
    });

    const flatList = screen.getByLabelText('场地列表');
    flatList.props.onEndReached();

    await waitFor(() => {
      expect(venueService.getVenues).toHaveBeenCalledTimes(2);
    });
  });

  it('should render court count information', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('场地卡片-1')).toBeTruthy();
    });

    expect(screen.getByLabelText('场地卡片-2')).toBeTruthy();
  });

  it('should call getVenues with correct pagination params', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(venueService.getVenues).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    });
  });

  it('should not load more when already loading more', async () => {
    jest.useRealTimers();
    const page1Venues = Array.from({ length: 10 }, (_, i) => ({
      ...mockVenues[0],
      id: 100 + i,
      name: `场地${i}`,
    }));

    (venueService.getVenues as jest.Mock)
      .mockResolvedValueOnce({ page: 1, pageSize: 10, total: 20, list: page1Venues })
      .mockReturnValue(new Promise(() => {}));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('场地0')).toBeTruthy();
    });

    const flatList = screen.getByLabelText('场地列表');
    flatList.props.onEndReached();

    await waitFor(() => {
      expect(screen.getByText('加载中...')).toBeTruthy();
    });

    flatList.props.onEndReached();

    expect(venueService.getVenues).toHaveBeenCalledTimes(2);
  });

  it('should not load more when no more data', async () => {
    jest.useRealTimers();
    (venueService.getVenues as jest.Mock).mockResolvedValue(mockPaginatedResponse(mockVenues));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });

    const flatList = screen.getByLabelText('场地列表');
    flatList.props.onEndReached();

    expect(venueService.getVenues).toHaveBeenCalledTimes(1);
  });

  it('should render loading more footer', async () => {
    jest.useRealTimers();
    const page1Venues = Array.from({ length: 10 }, (_, i) => ({
      ...mockVenues[0],
      id: 100 + i,
      name: `场地${i}`,
    }));

    (venueService.getVenues as jest.Mock)
      .mockResolvedValueOnce({ page: 1, pageSize: 10, total: 20, list: page1Venues })
      .mockReturnValue(new Promise(() => {}));

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('场地0')).toBeTruthy();
    });

    const flatList = screen.getByLabelText('场地列表');
    flatList.props.onEndReached();

    await waitFor(() => {
      expect(screen.getByText('加载中...')).toBeTruthy();
    });
  });

  it('should handle venue without rating gracefully', async () => {
    jest.useRealTimers();
    const venueWithoutRating = { ...mockVenues[0], ratingAvg: undefined, ratingCount: undefined };
    (venueService.getVenues as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([venueWithoutRating]),
    );

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('深圳湾体育中心篮球场')).toBeTruthy();
    });

    expect(screen.queryByLabelText('深圳湾体育中心篮球场评分')).toBeNull();
  });

  it('should handle venue without facility tags gracefully', async () => {
    jest.useRealTimers();
    const venueWithoutTags: VenueListItem = {
      id: 3,
      name: '简易场地',
      address: '某地址',
      pricePerHour: 50,
      courtCount: 1,
      status: 'active',
    };
    (venueService.getVenues as jest.Mock).mockResolvedValue(
      mockPaginatedResponse([venueWithoutTags]),
    );

    render(<VenueListScreen />);

    await waitFor(() => {
      expect(screen.getByText('简易场地')).toBeTruthy();
    });

    expect(screen.getByLabelText('简易场地设施标签')).toBeTruthy();
  });
});
