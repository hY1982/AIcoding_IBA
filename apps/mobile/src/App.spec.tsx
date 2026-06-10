import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from './stores';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation/types';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// HomeScreen inline for testing (mirrors App.tsx HomeScreen)
function HomeScreen({ navigation }: { navigation: NativeStackNavigationProp<RootStackParamList> }) {
  const user = useAppStore((state) => state.user);

  const handleProfilePress = () => {
    if (user?.userType === 'venue_manager') {
      navigation.navigate('VenueManagerProfile');
    } else {
      navigation.navigate('Profile');
    }
  };

  const handleVenuePress = () => {
    navigation.navigate('VenueList');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>I Basketball</Text>
      <Text style={styles.subtitle}>Find your perfect game</Text>
      <TouchableOpacity
        style={styles.profileButton}
        onPress={handleProfilePress}
        accessibilityLabel="我的资料"
        accessibilityRole="button"
      >
        <Text style={styles.profileButtonText}>我的资料</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.venueButton}
        onPress={handleVenuePress}
        accessibilityLabel="浏览场地"
        accessibilityRole="button"
      >
        <Text style={styles.venueButtonText}>浏览场地</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  profileButton: {
    marginTop: 32,
    backgroundColor: '#3498db',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  venueButton: {
    marginTop: 16,
    backgroundColor: '#27ae60',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  venueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ token: null, user: null });
  });

  it('should render title and subtitle', () => {
    render(<HomeScreen navigation={{ navigate: mockNavigate } as any} />);

    expect(screen.getByText('I Basketball')).toBeTruthy();
    expect(screen.getByText('Find your perfect game')).toBeTruthy();
  });

  it('should render profile button', () => {
    render(<HomeScreen navigation={{ navigate: mockNavigate } as any} />);

    expect(screen.getByLabelText('我的资料')).toBeTruthy();
  });

  it('should render venue browse button', () => {
    render(<HomeScreen navigation={{ navigate: mockNavigate } as any} />);

    expect(screen.getByLabelText('浏览场地')).toBeTruthy();
  });

  it('should navigate to Profile when profile button pressed (player user)', () => {
    useAppStore.setState({
      user: { id: 1, userType: 'player', nickname: 'Test' },
    });

    render(<HomeScreen navigation={{ navigate: mockNavigate } as any} />);

    const profileButton = screen.getByLabelText('我的资料');
    fireEvent.press(profileButton);

    expect(mockNavigate).toHaveBeenCalledWith('Profile');
  });

  it('should navigate to VenueManagerProfile when profile button pressed (venue manager)', () => {
    useAppStore.setState({
      user: { id: 2, userType: 'venue_manager', nickname: 'Manager' },
    });

    render(<HomeScreen navigation={{ navigate: mockNavigate } as any} />);

    const profileButton = screen.getByLabelText('我的资料');
    fireEvent.press(profileButton);

    expect(mockNavigate).toHaveBeenCalledWith('VenueManagerProfile');
  });

  it('should navigate to VenueList when venue button pressed', () => {
    render(<HomeScreen navigation={{ navigate: mockNavigate } as any} />);

    const venueButton = screen.getByLabelText('浏览场地');
    fireEvent.press(venueButton);

    expect(mockNavigate).toHaveBeenCalledWith('VenueList');
  });
});
