import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';

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

jest.mock('@/api/auth.service', () => ({
  authService: {
    login: jest.fn(),
    saveTokens: jest.fn(),
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ token: null, user: null });
  });

  afterEach(() => {
    // Ensure fake timers are restored after each test
    if (!jest.isMockFunction(setTimeout)) {
      jest.useFakeTimers();
    }
  });

  it('should render phone and password inputs and login button', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText('手机号输入框')).toBeTruthy();
    expect(screen.getByLabelText('密码输入框')).toBeTruthy();
    expect(screen.getByLabelText('登录')).toBeTruthy();
  });

  it('should allow typing in input fields', () => {
    render(<LoginScreen />);

    const phoneInput = screen.getByLabelText('手机号输入框');
    const passwordInput = screen.getByLabelText('密码输入框');

    fireEvent.changeText(phoneInput, '13800138000');
    fireEvent.changeText(passwordInput, 'Password123');

    expect(phoneInput.props.value).toBe('13800138000');
    expect(passwordInput.props.value).toBe('Password123');
  });

  it('should show validation error for invalid phone', () => {
    render(<LoginScreen />);

    const phoneInput = screen.getByLabelText('手机号输入框');
    fireEvent.changeText(phoneInput, '123');

    const loginButton = screen.getByLabelText('登录');
    fireEvent.press(loginButton);

    expect(screen.getByText('请输入有效的11位手机号码')).toBeTruthy();
  });

  it('should show validation error for invalid password', () => {
    render(<LoginScreen />);

    const passwordInput = screen.getByLabelText('密码输入框');
    fireEvent.changeText(passwordInput, '123');

    const loginButton = screen.getByLabelText('登录');
    fireEvent.press(loginButton);

    expect(screen.getByText('密码必须至少8位，且包含至少1个字母和1个数字')).toBeTruthy();
  });

  it('should call authService.login on valid form submission', async () => {
    jest.useRealTimers();
    (authService.login as jest.Mock).mockResolvedValue({
      user: { id: 1, nickname: 'Test', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.press(screen.getByLabelText('登录'));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        phone: '13800138000',
        password: 'Password123',
      });
    });
  });

  it('should save token and navigate to Home on successful login', async () => {
    jest.useRealTimers();
    (authService.login as jest.Mock).mockResolvedValue({
      user: { id: 1, nickname: 'Test', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.press(screen.getByLabelText('登录'));

    await waitFor(() => {
      expect(authService.saveTokens).toHaveBeenCalledWith('token', 'refresh');
      expect(useAppStore.getState().token).toBe('token');
      expect(useAppStore.getState().user).toEqual({
        id: 1,
        nickname: 'Test',
        userType: 'player',
      });
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  it('should display error message on login failure', async () => {
    jest.useRealTimers();
    (authService.login as jest.Mock).mockRejectedValue(new Error('手机号或密码错误'));

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.press(screen.getByLabelText('登录'));

    await waitFor(() => {
      expect(screen.getByText('手机号或密码错误')).toBeTruthy();
    });
  });

  it('should show required errors on empty form submission', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByLabelText('登录'));

    expect(screen.getByText('请输入手机号')).toBeTruthy();
    expect(screen.getByText('请输入密码')).toBeTruthy();
  });

  it('should show loading state while submitting', async () => {
    jest.useRealTimers();
    let resolveLogin: (value: unknown) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    (authService.login as jest.Mock).mockReturnValue(loginPromise);

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.press(screen.getByLabelText('登录'));

    await waitFor(() => {
      const loginButton = screen.getByLabelText('登录');
      expect(loginButton.props.accessibilityState.disabled).toBe(true);
    });

    resolveLogin!({
      user: { id: 1, nickname: 'Test', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });
  });
});
