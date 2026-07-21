import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleSelectScreen } from '@/screens/auth/RoleSelectScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { PlayerRegisterScreen } from '@/screens/auth/PlayerRegisterScreen';
import { VenueManagerRegisterScreen } from '@/screens/auth/VenueManagerRegisterScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="RoleSelect">
      <Stack.Screen
        name="RoleSelect"
        component={RoleSelectScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
      <Stack.Screen
        name="PlayerRegister"
        component={PlayerRegisterScreen}
        options={{ title: '球员信息' }}
      />
      <Stack.Screen
        name="VenueManagerRegister"
        component={VenueManagerRegisterScreen}
        options={{ title: '场地方信息' }}
      />
    </Stack.Navigator>
  );
}
