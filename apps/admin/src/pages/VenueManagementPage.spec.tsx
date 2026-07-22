import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VenueManagementPage from './VenueManagementPage';
import { getVenues } from '@/api/admin';
import type { AdminVenueListResponse } from '@shared/admin';

jest.mock('@/api/admin', () => ({
  getVenues: jest.fn(),
}));

describe('VenueManagementPage', () => {
  const mockGetVenues = getVenues as jest.MockedFunction<typeof getVenues>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render venue table with data', async () => {
    const mockData: AdminVenueListResponse = {
      page: 1,
      pageSize: 10,
      total: 1,
      list: [
        {
          id: 1,
          managerId: 1,
          name: 'Test Venue',
          address: 'Test Address',
          pricePerHour: 100,
          courtCount: 2,
          status: 'active',
          regionCode: 'shenzhen',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    };
    mockGetVenues.mockResolvedValue(mockData);

    render(<VenueManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
      expect(screen.getByText('Test Address')).toBeInTheDocument();
      expect(screen.getByText('营业中')).toBeInTheDocument();
    });
  });

  it('should render inactive venue status', async () => {
    const mockData: AdminVenueListResponse = {
      page: 1,
      pageSize: 10,
      total: 1,
      list: [
        {
          id: 1,
          managerId: 1,
          name: 'Closed Venue',
          address: 'Closed Address',
          pricePerHour: 100,
          courtCount: 2,
          status: 'inactive',
          regionCode: 'shenzhen',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    };
    mockGetVenues.mockResolvedValue(mockData);

    render(<VenueManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('已停业')).toBeInTheDocument();
    });
  });

  it('should render venue with undefined rating', async () => {
    const mockData: AdminVenueListResponse = {
      page: 1,
      pageSize: 10,
      total: 1,
      list: [
        {
          id: 1,
          managerId: 1,
          name: 'New Venue',
          address: 'New Address',
          pricePerHour: 100,
          courtCount: 2,
          status: 'active',
          regionCode: 'shenzhen',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    };
    mockGetVenues.mockResolvedValue(mockData);

    render(<VenueManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('暂无')).toBeInTheDocument();
    });
  });

  it('should handle search', async () => {
    mockGetVenues.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 0,
      list: [],
    } as AdminVenueListResponse);

    render(<VenueManagementPage />);

    const searchInput = screen.getByPlaceholderText('搜索名称或地址');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockGetVenues).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'test' }),
      );
    });
  });
});
