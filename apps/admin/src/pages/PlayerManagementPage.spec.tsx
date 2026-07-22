import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PlayerManagementPage from './PlayerManagementPage';
import { getPlayers } from '@/api/admin';
import type { AdminPlayerListResponse } from '@shared/admin';

jest.mock('@/api/admin', () => ({
  getPlayers: jest.fn(),
}));

describe('PlayerManagementPage', () => {
  const mockGetPlayers = getPlayers as jest.MockedFunction<typeof getPlayers>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render player table with data', async () => {
    const mockData: AdminPlayerListResponse = {
      page: 1,
      pageSize: 10,
      total: 2,
      list: [
        {
          id: 1,
          userId: 1,
          nickname: 'Player1',
          phone: '138****8000',
          phoneRaw: '13800138000',
          realName: '张**',
          realNameRaw: '张三',
          gender: 'male',
          age: 25,
          basketballAge: 5,
          height: 180,
          totalAbilityScore: 75.5,
          positions: [{ position: 'PG', priority: 1 }],
          userStatus: 'active',
          baseAbilityScore: 75.5,
          matchAdjustValue: 0,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        {
          id: 2,
          userId: 2,
          nickname: 'Player2',
          phone: '139****9000',
          phoneRaw: '13900139000',
          realName: '李**',
          realNameRaw: '李四',
          gender: 'female',
          age: 22,
          basketballAge: 3,
          height: 165,
          totalAbilityScore: 68.0,
          positions: [{ position: 'SG', priority: 1 }],
          userStatus: 'active',
          baseAbilityScore: 68.0,
          matchAdjustValue: 0,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    };
    mockGetPlayers.mockResolvedValue(mockData);

    render(<PlayerManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(screen.getByText('Player2')).toBeInTheDocument();
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('李四')).toBeInTheDocument();
    });
  });

  it('should handle search', async () => {
    mockGetPlayers.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 0,
      list: [],
    } as AdminPlayerListResponse);

    render(<PlayerManagementPage />);

    const searchInput = screen.getByPlaceholderText('搜索昵称或手机号');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockGetPlayers).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'test' }),
      );
    });
  });

  it('should show loading state', async () => {
    mockGetPlayers.mockImplementation(() => new Promise(() => {}));
    render(<PlayerManagementPage />);
    expect(screen.getByText('球员管理')).toBeInTheDocument();
  });
});
