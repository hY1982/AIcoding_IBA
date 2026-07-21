import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackNavigator } from './AuthStackNavigator';
import { PlayerTabNavigator } from './PlayerTabNavigator';
import { VenueManagerTabNavigator } from './VenueManagerTabNavigator';
import { useAppStore } from '@/stores';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const user = useAppStore((state) => state.user);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user == null ? (
        <Stack.Screen name="Auth" component={AuthStackNavigator} />
      ) : user.userType === 'player' ? (
        <Stack.Screen name="PlayerTabs" component={PlayerTabNavigator} />
      ) : (
        <Stack.Screen name="VenueManagerTabs" component={VenueManagerTabNavigator} />
      )}
    </Stack.Navigator>
  );
}
