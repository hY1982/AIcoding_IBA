import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PlayerProfile, PlayerAbility } from '@shared/player';
import type { VenueManagerProfile } from '@shared/venue-manager';
import type { VenueDetail } from '@shared/venue';

export type RootStackParamList = {
  Home: undefined;
  RoleSelect: undefined;
  Login: undefined;
  Register: { userType: 'player' | 'venue_manager' };
  PlayerRegister: { phone: string; password: string; nickname: string };
  VenueManagerRegister: { phone: string; password: string; nickname: string };
  Profile: undefined;
  EditProfile: { profile: PlayerProfile };
  Ability: { ability: PlayerAbility };
  VenueManagerProfile: undefined;
  EditVenueManagerProfile: { profile: VenueManagerProfile };
  CreateVenue: undefined;
  VenueDetail: { venueId: number };
  EditVenue: { venue: VenueDetail };
};

// Navigation prop types for type-safe navigation.navigate()
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
export type RoleSelectScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoleSelect'>;
export type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;
export type PlayerRegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PlayerRegister'>;
export type VenueManagerRegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VenueManagerRegister'>;
export type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;
export type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;
export type AbilityScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Ability'>;
export type VenueManagerProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VenueManagerProfile'>;
export type EditVenueManagerProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditVenueManagerProfile'>;
export type CreateVenueScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateVenue'>;
export type VenueDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VenueDetail'>;
export type EditVenueScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditVenue'>;

// Route prop types for type-safe route.params
export type RegisterScreenRouteProp = RouteProp<RootStackParamList, 'Register'>;
export type PlayerRegisterScreenRouteProp = RouteProp<RootStackParamList, 'PlayerRegister'>;
export type VenueManagerRegisterScreenRouteProp = RouteProp<RootStackParamList, 'VenueManagerRegister'>;
export type EditProfileScreenRouteProp = RouteProp<RootStackParamList, 'EditProfile'>;
export type AbilityScreenRouteProp = RouteProp<RootStackParamList, 'Ability'>;
export type EditVenueManagerProfileScreenRouteProp = RouteProp<RootStackParamList, 'EditVenueManagerProfile'>;
export type VenueDetailScreenRouteProp = RouteProp<RootStackParamList, 'VenueDetail'>;
export type EditVenueScreenRouteProp = RouteProp<RootStackParamList, 'EditVenue'>;
