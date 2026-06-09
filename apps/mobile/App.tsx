import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/navigation/types';
import { RoleSelectScreen } from './src/screens/auth/RoleSelectScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { PlayerRegisterScreen } from './src/screens/auth/PlayerRegisterScreen';
import { VenueManagerRegisterScreen } from './src/screens/auth/VenueManagerRegisterScreen';
import { ProfileScreen } from './src/screens/player/ProfileScreen';
import { EditProfileScreen } from './src/screens/player/EditProfileScreen';
import { AbilityScreenContainer } from './src/screens/player/AbilityScreen';

function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Basketball Match</Text>
      <Text style={styles.subtitle}>Find your perfect game</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="RoleSelect">
        <Stack.Screen
          name="RoleSelect"
          component={RoleSelectScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: '登录' }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: '注册' }}
        />
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
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: '我的资料' }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: '编辑资料' }}
        />
        <Stack.Screen
          name="Ability"
          component={AbilityScreenContainer}
          options={{ title: '能力值详情' }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Basketball Match' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

registerRootComponent(App);

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
});
