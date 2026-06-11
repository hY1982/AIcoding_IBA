import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PlayerRegisterScreen } from '../PlayerRegisterScreen';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';
import type { PlayerRegisterScreenRouteProp } from '@/navigation/types';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: (): Partial<PlayerRegisterScreenRouteProp> => ({
      params: { phone: '13800138000', password: 'Password123', nickname: 'TestUser' },
    }),
  };
});

jest.mock('@/api/auth.service', () => ({
  authService: {
    register: jest.fn(),
    saveTokens: jest.fn(),
  },
}));

describe('PlayerRegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ token: null, user: null });
  });

  afterEach(() => {
    if (!jest.isMockFunction(setTimeout)) {
      jest.useFakeTimers();
    }
  });

  it('should render all input fields and register button', () => {
    render(<PlayerRegisterScreen />);

    expect(screen.getByLabelText('生日输入框')).toBeTruthy();
    expect(screen.getByLabelText('开始打球年月输入框')).toBeTruthy();
    expect(screen.getByLabelText('男')).toBeTruthy();
    expect(screen.getByLabelText('女')).toBeTruthy();
    expect(screen.getByLabelText('身高输入框')).toBeTruthy();
    expect(screen.getByLabelText('体重输入框')).toBeTruthy();
    expect(screen.getByLabelText('控球后卫')).toBeTruthy();
    expect(screen.getByLabelText('注册')).toBeTruthy();
  });

  it('should allow typing in numeric fields', () => {
    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-06-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-03');
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.changeText(screen.getByLabelText('体重输入框'), '75');

    expect(screen.getByLabelText('生日输入框').props.value).toBe('1999-06-10');
    expect(screen.getByLabelText('开始打球年月输入框').props.value).toBe('2019-03');
    expect(screen.getByLabelText('身高输入框').props.value).toBe('180');
    expect(screen.getByLabelText('体重输入框').props.value).toBe('75');
  });

  it('should select gender', () => {
    render(<PlayerRegisterScreen />);

    const maleButton = screen.getByLabelText('男');
    fireEvent.press(maleButton);

    expect(maleButton.props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('女').props.accessibilityState.checked).toBe(false);
  });

  it('should toggle positions with max 3 selection', () => {
    render(<PlayerRegisterScreen />);

    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('得分后卫'));
    fireEvent.press(screen.getByLabelText('小前锋'));

    expect(screen.getByLabelText('控球后卫').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('得分后卫').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('小前锋').props.accessibilityState.checked).toBe(true);

    // Try selecting a 4th — should be ignored
    fireEvent.press(screen.getByLabelText('大前锋'));
    expect(screen.getByLabelText('大前锋').props.accessibilityState.checked).toBe(false);
  });

  it('should show validation error for invalid age', () => {
    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), 'invalid');
    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('生日格式不正确，应为 YYYY-MM-DD')).toBeTruthy();
  });

  it('should show validation error for invalid height', () => {
    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('身高输入框'), '20');
    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('身高必须在50-300cm之间')).toBeTruthy();
  });

  it('should show error when no position selected', () => {
    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-06-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-03');
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.press(screen.getByLabelText('男'));
    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('请至少选择一个位置')).toBeTruthy();
  });

  it('should call authService.register on valid form submission', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockResolvedValue({
      user: { id: 1, nickname: 'TestUser', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-06-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-03');
    fireEvent.press(screen.getByLabelText('男'));
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.changeText(screen.getByLabelText('体重输入框'), '75');
    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('注册'));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '13800138000',
          password: 'Password123',
          nickname: 'TestUser',
          userType: 'player',
          birthDate: '1999-06-10',
          startPlayingDate: '2019-03',
          gender: 'male',
          height: 180,
          weight: 75,
          positions: ['PG'],
        }),
      );
    });
  });

  it('should save token and navigate to Home on successful registration', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockResolvedValue({
      user: { id: 1, nickname: 'TestUser', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-06-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-03');
    fireEvent.press(screen.getByLabelText('男'));
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('注册'));

    await waitFor(() => {
      expect(authService.saveTokens).toHaveBeenCalledWith('token', 'refresh');
      expect(useAppStore.getState().token).toBe('token');
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  it('should display error message on registration failure', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockRejectedValue(new Error('该手机号已被注册'));

    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-06-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-03');
    fireEvent.press(screen.getByLabelText('男'));
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('注册'));

    await waitFor(() => {
      expect(screen.getByText('该手机号已被注册')).toBeTruthy();
    });
  });

  it('should show loading state while submitting', async () => {
    jest.useRealTimers();
    let resolveRegister: (value: unknown) => void;
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    (authService.register as jest.Mock).mockReturnValue(registerPromise);

    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-06-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-03');
    fireEvent.press(screen.getByLabelText('男'));
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('注册'));

    await waitFor(() => {
      const registerButton = screen.getByLabelText('注册');
      expect(registerButton.props.accessibilityState.disabled).toBe(true);
    });

    resolveRegister!({
      user: { id: 1, nickname: 'TestUser', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });
  });

  it('should have accessibility roles on gender and position chips', () => {
    render(<PlayerRegisterScreen />);

    expect(screen.getByLabelText('男').props.accessibilityRole).toBe('radio');
    expect(screen.getByLabelText('控球后卫').props.accessibilityRole).toBe('checkbox');
  });
});
