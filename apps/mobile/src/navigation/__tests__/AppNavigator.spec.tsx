import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from '../AppNavigator';
import { useAppStore } from '@/stores';

jest.mock('@/screens/auth/RoleSelectScreen', () => ({
  RoleSelectScreen: () => {
    return <div testID="role-select-screen">RoleSelect</div>;
  },
}));

jest.mock('@/screens/auth/LoginScreen', () => ({
  LoginScreen: () => {
    return <div testID="login-screen">Login</div>;
  },
}));

jest.mock('@/screens/auth/RegisterScreen', () => ({
  RegisterScreen: () => <div testID="register-screen">Register</div>,
}));

jest.mock('@/screens/auth/PlayerRegisterScreen', () => ({
  PlayerRegisterScreen: () => <div testID="player-register-screen">PlayerRegister</div>,
}));

jest.mock('@/screens/auth/VenueManagerRegisterScreen', () => ({
  VenueManagerRegisterScreen: () => (
    <div testID="venue-manager-register-screen">VenueManagerRegister</div>
  ),
}));

jest.mock('@/screens/home/HomeScreen', () => ({
  HomeScreen: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAppStore: mockUseAppStore } = require('@/stores');
    const user = mockUseAppStore.getState().user;
    return (
      <div testID="home-screen">
        {user?.userType === 'player' ? 'PlayerHome' : 'VenueManagerHome'}
      </div>
    );
  },
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

jest.mock('@/screens/venue/VenueListScreen', () => ({
  VenueListScreen: () => <div testID="venues-screen">Venues</div>,
}));

jest.mock('@/screens/venue/VenueManagerProfileScreen', () => ({
  VenueManagerProfileScreen: () => (
    <div testID="venue-manager-profile-screen">VenueManagerProfile</div>
  ),
}));

describe('AppNavigator', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({ token: null, user: null });
    });
  });

  it('should render AuthStack when user is not logged in', () => {
    render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('role-select-screen')).toBeTruthy();
  });

  it('should render PlayerTabNavigator when player is logged in', () => {
    act(() => {
      useAppStore.setState({
        user: { id: 1, userType: 'player', nickname: 'TestPlayer' },
      });
    });

    render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });

  it('should render VenueManagerTabNavigator when venue manager is logged in', () => {
    act(() => {
      useAppStore.setState({
        user: { id: 2, userType: 'venue_manager', nickname: 'TestManager' },
      });
    });

    render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });

  it('should switch to AuthStack after logout', () => {
    act(() => {
      useAppStore.setState({
        user: { id: 1, userType: 'player', nickname: 'TestPlayer' },
      });
    });

    const { rerender } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('home-screen')).toBeTruthy();

    // Simulate logout
    act(() => {
      useAppStore.setState({ user: null });
    });

    rerender(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('role-select-screen')).toBeTruthy();
  });
});
