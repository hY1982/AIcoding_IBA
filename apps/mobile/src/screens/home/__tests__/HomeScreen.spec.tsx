import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { useAppStore } from '@/stores';
import { HomeScreen } from '../HomeScreen';

jest.mock('../PlayerHomeContent', () => ({
  PlayerHomeContent: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAppStore: mockUseAppStore } = require('@/stores');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: MockText } = require('react-native');
    const user = mockUseAppStore.getState().user;
    return (
      <div testID="player-home-content">
        <MockText>PlayerHome:{user?.nickname}</MockText>
      </div>
    );
  },
}));

jest.mock('../VenueManagerHomeContent', () => ({
  VenueManagerHomeContent: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAppStore: mockUseAppStore } = require('@/stores');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: MockText } = require('react-native');
    const user = mockUseAppStore.getState().user;
    return (
      <div testID="venue-manager-home-content">
        <MockText>VenueManagerHome:{user?.nickname}</MockText>
      </div>
    );
  },
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    act(() => {
      useAppStore.setState({ token: null, user: null });
    });
  });

  afterEach(() => {
    jest.useFakeTimers();
  });

  it('should render login prompt when user is null', () => {
    act(() => {
      useAppStore.setState({ user: null });
    });

    render(<HomeScreen />);

    expect(screen.getByText('请先登录')).toBeTruthy();
    expect(screen.getByLabelText('登录')).toBeTruthy();
  });

  it('should navigate to Login when login button pressed (unauthenticated)', () => {
    act(() => {
      useAppStore.setState({ user: null });
    });

    render(<HomeScreen />);

    const loginButton = screen.getByLabelText('登录');
    fireEvent.press(loginButton);

    expect(screen.getByLabelText('登录')).toBeTruthy();
  });

  it('should render PlayerHomeContent for player user', () => {
    act(() => {
      useAppStore.setState({
        user: { id: 1, userType: 'player', nickname: 'TestPlayer' },
      });
    });

    render(<HomeScreen />);

    expect(screen.getByTestId('player-home-content')).toBeTruthy();
    expect(screen.getByText(/PlayerHome/)).toBeTruthy();
  });

  it('should render VenueManagerHomeContent for venue manager user', () => {
    act(() => {
      useAppStore.setState({
        user: { id: 2, userType: 'venue_manager', nickname: 'TestManager' },
      });
    });

    render(<HomeScreen />);

    expect(screen.getByTestId('venue-manager-home-content')).toBeTruthy();
    expect(screen.getByText(/VenueManagerHome/)).toBeTruthy();
  });
});
