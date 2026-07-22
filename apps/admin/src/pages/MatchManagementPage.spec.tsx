import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MatchManagementPage from './MatchManagementPage';
import { getMatches } from '@/api/admin';
import type { AdminMatchListResponse } from '@shared/admin';

jest.mock('@/api/admin', () => ({
  getMatches: jest.fn(),
}));

describe('MatchManagementPage', () => {
  const mockGetMatches = getMatches as jest.MockedFunction<typeof getMatches>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render match table with status tags', async () => {
    const mockData: AdminMatchListResponse = {
      page: 1,
      pageSize: 10,
      total: 1,
      list: [
        {
          id: 1,
          venueId: 1,
          formatId: 1,
          venueName: 'Test Venue',
          formatName: '3v3短赛',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T12:00:00Z',
          status: 'pending_players',
          teamCount: 2,
          playersPerTeam: 3,
          requiredPlayers: 6,
          confirmedPlayers: 3,
          depositAmount: '50.00',
          confirmDeadline: null,
          venueConfirmDeadline: null,
          groupChatId: null,
          regionCode: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    };
    mockGetMatches.mockResolvedValue(mockData);

    render(<MatchManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
      expect(screen.getByText('3v3短赛')).toBeInTheDocument();
      expect(screen.getByText('等待球员确认')).toBeInTheDocument();
      expect(screen.getByText('3 / 6')).toBeInTheDocument();
    });
  });

  it('should handle status filter', async () => {
    mockGetMatches.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 0,
      list: [],
    } as AdminMatchListResponse);

    render(<MatchManagementPage />);

    await waitFor(() => {
      expect(mockGetMatches).toHaveBeenCalled();
    });
  });

  it('should handle search', async () => {
    mockGetMatches.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 0,
      list: [],
    } as AdminMatchListResponse);

    render(<MatchManagementPage />);

    const searchInput = screen.getByPlaceholderText('搜索场地或赛制');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockGetMatches).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'test' }),
      );
    });
  });
});
