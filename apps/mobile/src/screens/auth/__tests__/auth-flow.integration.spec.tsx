import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from '../RegisterScreen';
import { PlayerRegisterScreen } from '../PlayerRegisterScreen';
import { VenueManagerRegisterScreen } from '../VenueManagerRegisterScreen';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
  };
});

jest.mock('@/api/auth.service', () => ({
  authService: {
    register: jest.fn(),
    saveTokens: jest.fn(),
  },
}));

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    useAppStore.setState({ token: null, user: null });
  });

  afterEach(() => {
    if (!jest.isMockFunction(setTimeout)) {
      jest.useFakeTimers();
    }
  });

  it('should pass params from RegisterScreen to PlayerRegisterScreen and complete registration', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockResolvedValue({
      user: { id: 1, nickname: 'TestUser', userType: 'player' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    });

    // Step 1: Render RegisterScreen with player userType
    mockRouteParams = { userType: 'player' };
    const { unmount: unmountRegister } = render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13800138000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.changeText(screen.getByLabelText('昵称输入框'), 'TestUser');
    fireEvent.press(screen.getByLabelText('下一步'));

    // Verify navigation to PlayerRegister with correct params
    expect(mockNavigate).toHaveBeenCalledWith('PlayerRegister', {
      phone: '13800138000',
      password: 'Password123',
      nickname: 'TestUser',
    });

    unmountRegister();

    // Step 2: Render PlayerRegisterScreen with params from RegisterScreen
    mockRouteParams = { phone: '13800138000', password: 'Password123', nickname: 'TestUser' };
    render(<PlayerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('年龄输入框'), '25');
    fireEvent.changeText(screen.getByLabelText('球龄输入框'), '5');
    fireEvent.press(screen.getByLabelText('男'));
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    fireEvent.changeText(screen.getByLabelText('体重输入框'), '75');
    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('注册'));

    // Step 3: Verify complete registration payload
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '13800138000',
          password: 'Password123',
          nickname: 'TestUser',
          userType: 'player',
          age: 25,
          basketballAge: 5,
          gender: 'male',
          height: 180,
          weight: 75,
          positions: ['PG'],
        }),
      );
    });

    // Step 4: Verify auth state updated
    await waitFor(() => {
      expect(authService.saveTokens).toHaveBeenCalledWith('token', 'refresh');
      expect(useAppStore.getState().token).toBe('token');
      expect(useAppStore.getState().user).toEqual({
        id: 1,
        nickname: 'TestUser',
        userType: 'player',
      });
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  it('should pass params from RegisterScreen to VenueManagerRegisterScreen and complete registration', async () => {
    jest.useRealTimers();
    (authService.register as jest.Mock).mockResolvedValue({
      user: { id: 2, nickname: 'VenueOwner', userType: 'venue_manager' },
      tokens: { accessToken: 'vtoken', refreshToken: 'vrefresh' },
    });

    // Step 1: Render RegisterScreen with venue_manager userType
    mockRouteParams = { userType: 'venue_manager' };
    const { unmount: unmountRegister } = render(<RegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('手机号输入框'), '13900139000');
    fireEvent.changeText(screen.getByLabelText('密码输入框'), 'Password123');
    fireEvent.changeText(screen.getByLabelText('昵称输入框'), 'VenueOwner');
    fireEvent.press(screen.getByLabelText('下一步'));

    expect(mockNavigate).toHaveBeenCalledWith('VenueManagerRegister', {
      phone: '13900139000',
      password: 'Password123',
      nickname: 'VenueOwner',
    });

    unmountRegister();

    // Step 2: Render VenueManagerRegisterScreen with params
    mockRouteParams = { phone: '13900139000', password: 'Password123', nickname: 'VenueOwner' };
    render(<VenueManagerRegisterScreen />);

    fireEvent.changeText(screen.getByLabelText('公司名称输入框'), 'ABC Sports');
    fireEvent.changeText(screen.getByLabelText('联系人姓名输入框'), '张三');
    fireEvent.changeText(screen.getByLabelText('联系人手机号输入框'), '13900139001');
    fireEvent.press(screen.getByLabelText('注册'));

    // Step 3: Verify registration payload
    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        phone: '13900139000',
        password: 'Password123',
        nickname: 'VenueOwner',
        userType: 'venue_manager',
        companyName: 'ABC Sports',
        contactName: '张三',
        contactPhone: '13900139001',
      });
    });

    // Step 4: Verify auth state updated
    await waitFor(() => {
      expect(authService.saveTokens).toHaveBeenCalledWith('vtoken', 'vrefresh');
      expect(useAppStore.getState().token).toBe('vtoken');
      expect(useAppStore.getState().user).toEqual({
        id: 2,
        nickname: 'VenueOwner',
        userType: 'venue_manager',
      });
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });
});
