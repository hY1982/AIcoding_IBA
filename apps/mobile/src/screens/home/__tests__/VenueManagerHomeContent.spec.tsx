import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useAppStore } from '@/stores';
import { VenueManagerHomeContent } from '../VenueManagerHomeContent';
import { venueService } from '@/api/venue.service';

jest.mock('@/api/venue.service');

describe('VenueManagerHomeContent', () => {
  const mockVenues = [
    {
      id: 1,
      name: 'Test Venue',
      address: 'Test Address',
      pricePerHour: 100,
      courtCount: 2,
      status: 'active',
    },
  ];

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    act(() => {
      useAppStore.setState({
        user: { id: 2, userType: 'venue_manager', nickname: 'TestManager' },
      });
    });
    (venueService.getMyVenues as jest.Mock).mockResolvedValue(mockVenues);
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('should render welcome message with user nickname', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('欢迎回来，TestManager')).toBeTruthy();
    });
  });

  it('should render quick action buttons', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('管理场地')).toBeTruthy();
      expect(screen.getByLabelText('新建场地')).toBeTruthy();
    });
  });

  it('should render venue overview cards when data exists', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('我的场地')).toBeTruthy();
      expect(screen.getByLabelText('场地卡片-1')).toBeTruthy();
    });
  });

  it('should show empty state when no venues', async () => {
    (venueService.getMyVenues as jest.Mock).mockResolvedValue([]);

    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('暂无场地，点击新建场地添加')).toBeTruthy();
    });
  });

  it('should render manage venues button', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('管理场地')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('管理场地'));
    expect(screen.getByLabelText('管理场地')).toBeTruthy();
  });

  it('should render create venue button', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('新建场地')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('新建场地'));
    expect(screen.getByLabelText('新建场地')).toBeTruthy();
  });

  it('should render venue card', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('场地卡片-1')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('场地卡片-1'));
    expect(screen.getByLabelText('场地卡片-1')).toBeTruthy();
  });

  it('should call API on mount', async () => {
    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(venueService.getMyVenues).toHaveBeenCalledTimes(1);
    });
  });

  it('should display error and retry button on API failure', async () => {
    (venueService.getMyVenues as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });
  });

  it('should retry loading when retry button pressed', async () => {
    (venueService.getMyVenues as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockVenues);

    render(<VenueManagerHomeContent />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(venueService.getMyVenues).toHaveBeenCalledTimes(2);
    });
  });
});
