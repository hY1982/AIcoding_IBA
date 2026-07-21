import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { VenueManagerTabNavigator } from '../VenueManagerTabNavigator';
import { useAppStore } from '@/stores';

jest.mock('@/screens/home/HomeScreen', () => ({
  HomeScreen: () => <div testID="home-screen">VenueManagerHome</div>,
}));

jest.mock('@/screens/venue/VenueListScreen', () => ({
  VenueListScreen: () => <div testID="venues-screen">Venues</div>,
}));

jest.mock('@/screens/venue/VenueManagerProfileScreen', () => ({
  VenueManagerProfileScreen: () => <div testID="profile-screen">Profile</div>,
}));

describe('VenueManagerTabNavigator', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: { id: 2, userType: 'venue_manager', nickname: 'TestManager' },
    });
  });

  it('should render 3 tabs with correct labels', () => {
    render(
      <NavigationContainer>
        <VenueManagerTabNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByText('首页')).toBeTruthy();
    expect(screen.getByText('场地')).toBeTruthy();
    expect(screen.getByText('我的')).toBeTruthy();
  });

  it('should default to Home tab', () => {
    render(
      <NavigationContainer>
        <VenueManagerTabNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });
});
