import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';
import { playerService } from '@/api/player.service';
import type { PlayerProfile } from '@shared/player';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

jest.mock('@/api/player.service', () => ({
  playerService: {
    getProfile: jest.fn(),
  },
}));

describe('ProfileScreen', () => {
  const mockProfile: PlayerProfile = {
    id: 1,
    userId: 1,
    phone: '138****8000',
    nickname: 'TestPlayer',
    realName: '张**',
    avatarUrl: 'https://example.com/avatar.jpg',
    age: 25,
    basketballAge: 5,
    gender: 'male',
    height: 180,
    weight: 75,
    wingspan: 190,
    standingReach: 230,
    jumpingReach: 310,
    positions: ['PG', 'SG'],
    baseAbilityScore: 72.5,
    matchAdjustValue: 2.0,
    totalAbilityScore: 74.5,
    regionCode: 'shenzhen_futian',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (!jest.isMockFunction(setTimeout)) {
      jest.useFakeTimers();
    }
  });

  it('should render loading state initially', () => {
    (playerService.getProfile as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<ProfileScreen />);

    expect(screen.getByLabelText('加载中')).toBeTruthy();
  });

  it('should render full player profile after loading', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('昵称')).toBeTruthy();
    });

    expect(screen.getByText('TestPlayer')).toBeTruthy();
    expect(screen.getByText('138****8000')).toBeTruthy();
    expect(screen.getByText('张**')).toBeTruthy();
    expect(screen.getByText('25岁')).toBeTruthy();
    expect(screen.getByText('180cm')).toBeTruthy();
    expect(screen.getByText('75kg')).toBeTruthy();
    expect(screen.getByText('控球后卫')).toBeTruthy();
    expect(screen.getByText('得分后卫')).toBeTruthy();
  });

  it('should render avatar placeholder when no avatarUrl', async () => {
    jest.useRealTimers();
    const profileWithoutAvatar = { ...mockProfile, avatarUrl: undefined };
    (playerService.getProfile as jest.Mock).mockResolvedValue(profileWithoutAvatar);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('默认头像')).toBeTruthy();
    });
  });

  it('should display ability score summary', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('基础能力值')).toBeTruthy();
      expect(screen.getByLabelText('综合能力值')).toBeTruthy();
    });

    expect(screen.getByText('72.5')).toBeTruthy();
    expect(screen.getByText('74.5')).toBeTruthy();
  });

  it('should navigate to EditProfile when edit button pressed', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('编辑资料')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('编辑资料'));

    expect(mockNavigate).toHaveBeenCalledWith('EditProfile', { profile: mockProfile });
  });

  it('should navigate to Ability when ability button pressed', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('查看能力值详情')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('查看能力值详情'));

    expect(mockNavigate).toHaveBeenCalledWith('Ability', {
      ability: {
        baseAbilityScore: 72.5,
        matchAdjustValue: 2.0,
        totalAbilityScore: 74.5,
      },
    });
  });

  it('should display error message on API failure', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockRejectedValue(new Error('网络错误'));

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeTruthy();
    });
  });

  it('should retry loading when retry button pressed', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock)
      .mockRejectedValueOnce(new Error('网络错误'))
      .mockResolvedValueOnce(mockProfile);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('重试')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('重试'));

    await waitFor(() => {
      expect(playerService.getProfile).toHaveBeenCalledTimes(2);
      expect(screen.getByText('TestPlayer')).toBeTruthy();
    });
  });

  it('should show empty state when profile response is null', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockResolvedValue(null);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByText('暂无资料')).toBeTruthy();
    });
  });

  it('should render all accessibility labels correctly', async () => {
    jest.useRealTimers();
    (playerService.getProfile as jest.Mock).mockResolvedValue(mockProfile);

    render(<ProfileScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('昵称')).toBeTruthy();
      expect(screen.getByLabelText('手机号')).toBeTruthy();
      expect(screen.getByLabelText('真实姓名')).toBeTruthy();
      expect(screen.getByLabelText('年龄')).toBeTruthy();
      expect(screen.getByLabelText('球龄')).toBeTruthy();
      expect(screen.getByLabelText('性别')).toBeTruthy();
      expect(screen.getByLabelText('身高')).toBeTruthy();
      expect(screen.getByLabelText('体重')).toBeTruthy();
      expect(screen.getByLabelText('臂展')).toBeTruthy();
      expect(screen.getByLabelText('站立摸高')).toBeTruthy();
      expect(screen.getByLabelText('起跳摸高')).toBeTruthy();
      expect(screen.getByLabelText('位置')).toBeTruthy();
    });
  });
});
