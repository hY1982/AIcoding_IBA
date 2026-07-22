import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { getStats } from '@/api/admin';

jest.mock('@/api/admin', () => ({
  getStats: jest.fn(),
}));

describe('DashboardPage', () => {
  const mockGetStats = getStats as jest.MockedFunction<typeof getStats>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGetStats.mockImplementation(() => new Promise(() => {}));
    render(<DashboardPage />);
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should render statistics cards after loading', async () => {
    const mockStats = {
      totalPlayers: 100,
      totalVenueManagers: 10,
      totalVenues: 15,
      todayMatches: 5,
      pendingIntentions: 20,
      weeklyMatchTrend: [
        { date: '2024-01-01', count: 2 },
        { date: '2024-01-02', count: 3 },
        { date: '2024-01-03', count: 1 },
        { date: '2024-01-04', count: 4 },
        { date: '2024-01-05', count: 2 },
        { date: '2024-01-06', count: 5 },
        { date: '2024-01-07', count: 3 },
      ],
      matchStatusDistribution: [
        { status: 'pending_players', count: 10 },
        { status: 'confirmed', count: 5 },
      ],
    };
    mockGetStats.mockResolvedValue(mockStats);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('总注册球员')).toBeInTheDocument();
      expect(screen.getByText('总场地数')).toBeInTheDocument();
      expect(screen.getByText('今日比赛')).toBeInTheDocument();
      expect(screen.getByText('待处理意向')).toBeInTheDocument();
    });

    // Check statistic values using queryAllByText for numbers that may appear multiple times
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    // Use queryAllByText for '5' since it may appear in multiple places
    const fives = screen.queryAllByText('5');
    expect(fives.length).toBeGreaterThanOrEqual(1);
  });

  it('should render weekly match trend', async () => {
    const mockStats = {
      totalPlayers: 100,
      totalVenueManagers: 10,
      totalVenues: 15,
      todayMatches: 5,
      pendingIntentions: 20,
      weeklyMatchTrend: [
        { date: '2024-01-01', count: 2 },
        { date: '2024-01-02', count: 3 },
        { date: '2024-01-03', count: 1 },
        { date: '2024-01-04', count: 4 },
        { date: '2024-01-05', count: 2 },
        { date: '2024-01-06', count: 5 },
        { date: '2024-01-07', count: 3 },
      ],
      matchStatusDistribution: [],
    };
    mockGetStats.mockResolvedValue(mockStats);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('近7天比赛趋势')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('2024-01-07')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    mockGetStats.mockRejectedValue(new Error('Network error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('加载统计数据失败')).toBeInTheDocument();
    });
  });
});
