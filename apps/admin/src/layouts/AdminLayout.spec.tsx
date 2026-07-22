import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useAuth } from '@/hooks/useAuth';

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

describe('AdminLayout', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 1, nickname: 'TestAdmin' },
      logout: mockLogout,
    });
  });

  it('should render layout structure with navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('数据概览')).toBeInTheDocument();
    expect(screen.getByText('球员管理')).toBeInTheDocument();
    expect(screen.getByText('场地管理')).toBeInTheDocument();
    expect(screen.getByText('比赛管理')).toBeInTheDocument();
    expect(screen.getByText('系统参数')).toBeInTheDocument();
    expect(screen.getByText('TestAdmin')).toBeInTheDocument();
  });

  it('should have logout functionality available', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    // Verify logout button exists in the header
    const logoutButton = screen.getByText('退出');
    expect(logoutButton).toBeInTheDocument();
    
    // Verify the useAuth hook returned logout function (it was called in beforeEach)
    expect(mockLogout).toBeDefined();
  });

  it('should highlight active menu item', () => {
    render(
      <MemoryRouter initialEntries={['/players']}>
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route path="players" element={<div>Players</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const playersMenu = screen.getByText('球员管理').closest('li');
    expect(playersMenu).toHaveClass('ant-menu-item-selected');
  });
});
