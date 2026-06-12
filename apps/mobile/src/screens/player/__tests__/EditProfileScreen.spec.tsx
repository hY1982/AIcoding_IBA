import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { EditProfileScreen } from '../EditProfileScreen';
import { playerService } from '@/api/player.service';
import type { EditProfileScreenRouteProp } from '@/navigation/types';
import type { PlayerProfile } from '@shared/player';

const mockGoBack = jest.fn();

const mockProfile: PlayerProfile = {
  id: 1,
  userId: 1,
  phone: '138****8000',
  nickname: 'TestPlayer',
  realName: '张**',
  avatarUrl: 'https://example.com/avatar.jpg',
  age: 25,
  basketballAge: 5,
  birthDate: '2000-06-15',
  startPlayingDate: '2020-03',
  gender: 'male',
  height: 180,
  weight: 75,
  wingspan: 190,
  standingReach: 230,
  jumpingReach: 310,
  positions: [{ position: 'PG', priority: 1 }, { position: 'SG', priority: 2 }],
  baseAbilityScore: 72.5,
  matchAdjustValue: 2.0,
  totalAbilityScore: 74.5,
  regionCode: 'shenzhen_futian',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: mockGoBack,
    }),
    useRoute: (): Partial<EditProfileScreenRouteProp> => ({
      params: {
        profile: mockProfile,
      },
    }),
  };
});

jest.mock('@/api/player.service', () => ({
  playerService: {
    updateProfile: jest.fn(),
  },
}));

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all editable fields and submit button', () => {
    render(<EditProfileScreen />);

    expect(screen.getByLabelText('生日输入框')).toBeTruthy();
    expect(screen.getByLabelText('开始打球年月输入框')).toBeTruthy();
    expect(screen.getByLabelText('身高输入框')).toBeTruthy();
    expect(screen.getByLabelText('体重输入框')).toBeTruthy();
    expect(screen.getByLabelText('臂展输入框')).toBeTruthy();
    expect(screen.getByLabelText('站立摸高输入框')).toBeTruthy();
    expect(screen.getByLabelText('起跳摸高输入框')).toBeTruthy();
    expect(screen.getByLabelText('男')).toBeTruthy();
    expect(screen.getByLabelText('女')).toBeTruthy();
    expect(screen.getByLabelText('控球后卫')).toBeTruthy();
    expect(screen.getByLabelText('保存')).toBeTruthy();
  });

  it('should prefill form from route params', () => {
    render(<EditProfileScreen />);

    expect(screen.getByLabelText('生日输入框').props.value).toBe('2000-06-15');
    expect(screen.getByLabelText('开始打球年月输入框').props.value).toBe('2020-03');
    expect(screen.getByLabelText('身高输入框').props.value).toBe('180');
    expect(screen.getByLabelText('体重输入框').props.value).toBe('75');
    expect(screen.getByLabelText('臂展输入框').props.value).toBe('190');
    expect(screen.getByLabelText('站立摸高输入框').props.value).toBe('230');
    expect(screen.getByLabelText('起跳摸高输入框').props.value).toBe('310');
    expect(screen.getByLabelText('男').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('控球后卫').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('得分后卫').props.accessibilityState.checked).toBe(true);
  });

  it('should allow editing text fields', () => {
    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-05-10');
    fireEvent.changeText(screen.getByLabelText('开始打球年月输入框'), '2019-06');
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '181');
    fireEvent.changeText(screen.getByLabelText('体重输入框'), '76');

    expect(screen.getByLabelText('生日输入框').props.value).toBe('1999-05-10');
    expect(screen.getByLabelText('开始打球年月输入框').props.value).toBe('2019-06');
    expect(screen.getByLabelText('身高输入框').props.value).toBe('181');
    expect(screen.getByLabelText('体重输入框').props.value).toBe('76');
  });

  it('should toggle gender selection', () => {
    render(<EditProfileScreen />);

    expect(screen.getByLabelText('男').props.accessibilityState.checked).toBe(true);

    fireEvent.press(screen.getByLabelText('女'));

    expect(screen.getByLabelText('女').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('男').props.accessibilityState.checked).toBe(false);
  });

  it('should toggle positions with max 3 selection', () => {
    render(<EditProfileScreen />);

    fireEvent.press(screen.getByLabelText('小前锋'));

    expect(screen.getByLabelText('控球后卫').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('得分后卫').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('小前锋').props.accessibilityState.checked).toBe(true);

    fireEvent.press(screen.getByLabelText('大前锋'));
    expect(screen.getByLabelText('大前锋').props.accessibilityState.checked).toBe(false);
  });

  it('should show validation error for invalid height', () => {
    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('身高输入框'), '20');
    fireEvent.press(screen.getByLabelText('保存'));

    expect(screen.getByText('身高必须在50-300cm之间')).toBeTruthy();
  });

  it('should show validation error for invalid birthDate', () => {
    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), 'invalid-date');
    fireEvent.press(screen.getByLabelText('保存'));

    expect(screen.getByText('生日格式不正确，应为 YYYY-MM-DD')).toBeTruthy();
  });

  it('should show validation error when no position selected', () => {
    render(<EditProfileScreen />);

    fireEvent.press(screen.getByLabelText('控球后卫'));
    fireEvent.press(screen.getByLabelText('得分后卫'));
    fireEvent.press(screen.getByLabelText('保存'));

    expect(screen.getByText('请至少选择一个位置')).toBeTruthy();
  });

  it('should call playerService.updateProfile on valid form submission', async () => {
    jest.useRealTimers();
    (playerService.updateProfile as jest.Mock).mockResolvedValue({
      ...mockProfile,
      birthDate: '1999-05-10',
      height: 181,
    });

    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-05-10');
    fireEvent.changeText(screen.getByLabelText('身高输入框'), '181');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(playerService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          birthDate: '1999-05-10',
          height: 181,
          gender: 'male',
          positions: ['PG', 'SG'],
        }),
      );
    });
  });

  it('should show success message and goBack on successful update', async () => {
    jest.useRealTimers();
    (playerService.updateProfile as jest.Mock).mockResolvedValue(mockProfile);

    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-05-10');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(screen.getByText('资料更新成功')).toBeTruthy();
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('should display error message on update failure', async () => {
    jest.useRealTimers();
    (playerService.updateProfile as jest.Mock).mockRejectedValue(new Error('更新失败'));

    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-05-10');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(screen.getByText('更新失败')).toBeTruthy();
    });
  });

  it('should show loading state while submitting', async () => {
    jest.useRealTimers();
    let resolveUpdate: (value: unknown) => void;
    const updatePromise = new Promise((resolve) => {
      resolveUpdate = resolve;
    });
    (playerService.updateProfile as jest.Mock).mockReturnValue(updatePromise);

    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('生日输入框'), '1999-05-10');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      const saveButton = screen.getByLabelText('保存');
      expect(saveButton.props.accessibilityState.disabled).toBe(true);
    });

    resolveUpdate!(mockProfile);
  });

  it('should clear field error when user starts typing', () => {
    render(<EditProfileScreen />);

    fireEvent.changeText(screen.getByLabelText('身高输入框'), '20');
    fireEvent.press(screen.getByLabelText('保存'));
    expect(screen.getByText('身高必须在50-300cm之间')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('身高输入框'), '180');
    expect(screen.queryByText('身高必须在50-300cm之间')).toBeNull();
  });
});
