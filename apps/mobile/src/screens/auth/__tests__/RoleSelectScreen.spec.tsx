import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { RoleSelectScreen } from '../RoleSelectScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

describe('RoleSelectScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should render two role selection buttons', () => {
    render(<RoleSelectScreen />);

    expect(screen.getByLabelText('选择球员角色')).toBeTruthy();
    expect(screen.getByLabelText('选择场地方角色')).toBeTruthy();
  });

  it('should navigate to Register with userType player when player button is pressed', () => {
    render(<RoleSelectScreen />);

    const playerButton = screen.getByLabelText('选择球员角色');
    fireEvent.press(playerButton);

    expect(mockNavigate).toHaveBeenCalledWith('Register', { userType: 'player' });
  });

  it('should navigate to Register with userType venue_manager when venue manager button is pressed', () => {
    render(<RoleSelectScreen />);

    const venueButton = screen.getByLabelText('选择场地方角色');
    fireEvent.press(venueButton);

    expect(mockNavigate).toHaveBeenCalledWith('Register', { userType: 'venue_manager' });
  });

  it('should render page title and description', () => {
    render(<RoleSelectScreen />);

    expect(screen.getByText('I Basketball')).toBeTruthy();
    expect(screen.getByText('请选择您的角色')).toBeTruthy();
  });
});
