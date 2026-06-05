import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  RoleSelect: undefined;
  Login: undefined;
  Register: { userType: 'player' | 'venue_manager' };
  PlayerRegister: { phone: string; password: string; nickname: string };
  VenueManagerRegister: { phone: string; password: string; nickname: string };
};

// Navigation prop types for type-safe navigation.navigate()
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
export type RoleSelectScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoleSelect'>;
export type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;
export type PlayerRegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PlayerRegister'>;
export type VenueManagerRegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VenueManagerRegister'>;

// Route prop types for type-safe route.params
export type RegisterScreenRouteProp = RouteProp<RootStackParamList, 'Register'>;
export type PlayerRegisterScreenRouteProp = RouteProp<RootStackParamList, 'PlayerRegister'>;
export type VenueManagerRegisterScreenRouteProp = RouteProp<RootStackParamList, 'VenueManagerRegister'>;
