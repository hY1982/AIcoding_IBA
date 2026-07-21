import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PlayerTabNavigator } from '../PlayerTabNavigator';
import { useAppStore } from '@/stores';

jest.mock('@/screens/home/HomeScreen', () => ({
  HomeScreen: () => <div testID="home-screen">PlayerHome</div>,
}));

jest.mock('@/screens/intention/MyIntentionsScreen', () => ({
  MyIntentionsScreen: () => <div testID="intentions-screen">Intentions</div>,
}));

jest.mock('@/screens/match/MyMatchesScreen', () => ({
  MyMatchesScreen: () => <div testID="matches-screen">Matches</div>,
}));

jest.mock('@/screens/player/ProfileScreen', () => ({
  ProfileScreen: () => <div testID="profile-screen">Profile</div>,
}));

describe('PlayerTabNavigator', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: { id: 1, userType: 'player', nickname: 'TestPlayer' },
    });
  });

  it('should render 4 tabs with correct labels', () => {
    render(
      <NavigationContainer>
        <PlayerTabNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByText('首页')).toBeTruthy();
    expect(screen.getByText('意向')).toBeTruthy();
    expect(screen.getByText('比赛')).toBeTruthy();
    expect(screen.getByText('我的')).toBeTruthy();
  });

  it('should default to Home tab', () => {
    render(
      <NavigationContainer>
        <PlayerTabNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });
});
