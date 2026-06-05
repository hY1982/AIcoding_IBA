import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RegisterScreen } from '../RegisterScreen';
import type { RegisterScreenRouteProp } from '@/navigation/types';

const mockNavigate = jest.fn();
let mockUserType: 'player' | 'venue_manager' = 'player';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: (): Partial<RegisterScreenRouteProp> => ({
      params: { userType: mockUserType },
    }),
  };
});

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserType = 'player';
  });

  afterEach(() => {
    if (!jest.isMockFunction(setTimeout)) {
      jest.useFakeTimers();
    }
  });

  it('should render phone, password, nickname inputs and next button', () => {
    render(<RegisterScreen />);

    expect(screen.getByLabelText('手机号输入框')).toBeTruthy();
    expect(screen.getByLabelText('密码输入框')).toBeTruthy();
    expect(screen.getByLabelText('昵称输入框')).toBeTruthy();
    expect(screen.getByLabelText('下一步')).toBeTruthy();
  });

  it('should allow typing in input fields', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.changeText(screen.getByLabelText('昵称输入框'), 'TestUser');

    expect(screen.getByLabelText('手机号输入框').props.value).toBe('13800138000');
    expect(screen.getByLabelText('密码输入框').props.value).toBe('Password123');
    expect(screen.getByLabelText('昵称输入框').props.value).toBe('TestUser');
  });

  it('should show validation error for invalid phone', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '123');
    fireEvent.press(screen.getByLabelText('下一步'));

    expect(screen.getByText('请输入有效的11位手机号码')).toBeTruthy();
  });

  it('should show validation error for invalid password', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('密码输入框'), '123');
    fireEvent.press(screen.getByLabelText('下一步'));

    expect(screen.getByText('密码必须至少8位，且包含至少1个字母和1个数字')).toBeTruthy();
  });

  it('should show validation error for empty nickname', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.press(screen.getByLabelText('下一步'));

    expect(screen.getByText('请输入昵称')).toBeTruthy();
  });

  it('should navigate to PlayerRegister with params for player role', () => {
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.changeText(screen.getByLabelText('昵称输入框'), 'TestUser');
    fireEvent.press(screen.getByLabelText('下一步'));

    expect(mockNavigate).toHaveBeenCalledWith('PlayerRegister', {
      phone: '13800138000',
      password: 'Password123',
      nickname: 'TestUser',
    });
  });

  it('should navigate to VenueManagerRegister with params for venue_manager role', () => {
    mockUserType = 'venue_manager';
    render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.changeText(screen.getByLabelText('昵称输入框'), 'TestUser');
    fireEvent.press(screen.getByLabelText('下一步'));

    expect(mockNavigate).toHaveBeenCalledWith('VenueManagerRegister', {
      phone: '13800138000',
      password: 'Password123',
      nickname: 'TestUser',
    });
  });

  it('should show required errors on empty form submission', () => {
    render(<RegisterScreen />);

    fireEvent.press(screen.getByLabelText('下一步'));

    expect(screen.getByText('请输入手机号')).toBeTruthy();
    expect(screen.getByText('请输入密码')).toBeTruthy();
    expect(screen.getByText('请输入昵称')).toBeTruthy();
  });
});
