import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from '../App';
import { useAppStore } from './stores';

jest.mock('@/navigation/AppNavigator', () => ({
  AppNavigator: () => <div testID="app-navigator">AppNavigator</div>,
}));

describe('App', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, user: null });
  });

  it('should render AppNavigator', () => {
    render(<App />);

    expect(screen.getByTestId('app-navigator')).toBeTruthy();
  });
});
