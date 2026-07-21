import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '@/stores';
import { PlayerHomeContent } from './PlayerHomeContent';
import { VenueManagerHomeContent } from './VenueManagerHomeContent';
import type { RootStackNavigationProp } from '@/navigation/types';

export function HomeScreen() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const user = useAppStore((state) => state.user);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>I Basketball</Text>
        <Text style={styles.subtitle}>Find your perfect game</Text>
        <Text style={styles.loginPrompt}>请先登录</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
          accessibilityLabel="登录"
          accessibilityRole="button"
        >
          <Text style={styles.loginButtonText}>登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (user.userType === 'player') {
    return <PlayerHomeContent />;
  }

  if (user.userType === 'venue_manager') {
    return <VenueManagerHomeContent />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>I Basketball</Text>
      <Text style={styles.subtitle}>未知角色类型，请联系客服</Text>
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
  loginPrompt: {
    fontSize: 16,
    color: '#666',
    marginTop: 32,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
