import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import { apiClient } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';

// Mock dependencies
jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    defaults: { headers: {} as Record<string, string> },
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

describe('LoginPage', () => {
  const mockLogin = jest.fn();
  const mockNavigate = jest.fn();
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  it('should render login form', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('管理后台登录')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入管理员手机号')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show validation error for empty fields', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('请输入手机号')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid phone', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('请输入管理员手机号'), {
      target: { value: '123' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('请输入有效的手机号')).toBeInTheDocument();
    });
  });

  it('should handle successful login', async () => {
    const mockUser = { id: 1, phone: '13800138000', nickname: 'Admin', userType: 'player', status: 'active' };
    mockApiClient.post.mockResolvedValue({
      data: { data: { user: mockUser, tokens: { accessToken: 'test-token' } } },
    } as never);
    mockApiClient.get.mockResolvedValue({ data: { data: {} } } as never);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('请输入管理员手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', {
        phone: '13800138000',
        password: 'password123',
      });
      expect(mockLogin).toHaveBeenCalledWith('test-token', mockUser);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should show error for non-admin user (403)', async () => {
    mockApiClient.post.mockResolvedValue({
      data: { data: { user: {}, tokens: { accessToken: 'token' } } },
    } as never);
    mockApiClient.get.mockRejectedValue({
      response: { status: 403, data: { message: '无权访问' } },
    } as never);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('请输入管理员手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('该账号不是管理员，无权访问管理后台')).toBeInTheDocument();
    });
  });

  it('should show error for invalid credentials (401)', async () => {
    mockApiClient.post.mockRejectedValue({
      response: { status: 401, data: { message: '手机号或密码错误' } },
    } as never);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('请输入管理员手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('手机号或密码错误')).toBeInTheDocument();
    });
  });

  it('should show generic error for network failure', async () => {
    mockApiClient.post.mockRejectedValue({
      response: { status: 500, data: { message: '服务器内部错误' } },
    } as never);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('请输入管理员手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('服务器内部错误')).toBeInTheDocument();
    });
  });

  it('should show default error message when no error message provided', async () => {
    mockApiClient.post.mockRejectedValue({
      response: { status: 500, data: {} },
    } as never);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('请输入管理员手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('登录失败，请稍后重试')).toBeInTheDocument();
    });
  });
});
