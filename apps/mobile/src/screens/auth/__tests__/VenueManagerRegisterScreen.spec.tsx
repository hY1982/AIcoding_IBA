import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { VenueManagerRegisterScreen } from '../VenueManagerRegisterScreen';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';
import type { VenueManagerRegisterScreenRouteProp } from '@/navigation/types';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: (): Partial<VenueManagerRegisterScreenRouteProp> => ({
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

describe('VenueManagerRegisterScreen', () => {
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
    render(<VenueManagerRegisterScreen />);

    expect(screen.getByLabelText('公司名称输入框')).toBeTruthy();
    expect(screen.getByLabelText('联系人姓名输入框')).toBeTruthy();
    expect(screen.getByLabelText('联系人手机号输入框')).toBeTruthy();
    expect(screen.getByLabelText('注册')).toBeTruthy();
  });

  it('should allow typing in input fields', () => {
    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '13900139000');

    expect(screen.getByLabelText('公司名称输入框').props.value).toBe('ABC Sports');
    expect(screen.getByLabelText('联系人姓名输入框').props.value).toBe('张三');
    expect(screen.getByLabelText('联系人手机号输入框').props.value).toBe('13900139000');
  });

  it('should show validation error for empty company name', () => {
    render(<VenueManagerRegisterScreen />);

    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('请输入公司名称')).toBeTruthy();
  });

  it('should show validation error for empty contact name', () => {
    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('请输入联系人姓名')).toBeTruthy();
  });

  it('should show validation error for invalid contact phone', () => {
    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '123');
    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('请输入有效的11位手机号码')).toBeTruthy();
  });

  it('should call authService.register on valid form submission', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockResolvedValue({
      user: { id: 2, nickname: 'TestUser', userType: 'venue_manager' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '13900139000');
    fireEvent.press(screen.getByLabelText('注册'));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        phone: '13800138000',
        password: 'Password123',
        nickname: 'TestUser',
        userType: 'venue_manager',
        companyName: 'ABC Sports',
        contactName: '张三',
        contactPhone: '13900139000',
      });
    });
  });

  it('should save token and navigate to Home on successful registration', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockResolvedValue({
      user: { id: 2, nickname: 'TestUser', userType: 'venue_manager' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '13900139000');
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

    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '13900139000');
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

    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '13900139000');
    fireEvent.press(screen.getByLabelText('注册'));

    await waitFor(() => {
      const registerButton = screen.getByLabelText('注册');
      expect(registerButton.props.accessibilityState.disabled).toBe(true);
    });

    resolveRegister!({
      user: { id: 2, nickname: 'TestUser', userType: 'venue_manager' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });
  });

  it('should show required errors on empty form submission', () => {
    render(<VenueManagerRegisterScreen />);

    fireEvent.press(screen.getByLabelText('注册'));

    expect(screen.getByText('请输入公司名称')).toBeTruthy();
    expect(screen.getByText('请输入联系人姓名')).toBeTruthy();
    expect(screen.getByText('请输入联系人手机号')).toBeTruthy();
  });
});
