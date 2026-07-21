import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { PlayerProfile } from '@shared/player';
import type { VenueManagerProfile } from '@shared/venue-manager';
import type { VenueDetail } from '@shared/venue';

// ============================================
// Auth Stack (未登录流程)
// ============================================
export type AuthStackParamList = {
  RoleSelect: undefined;
  Login: undefined;
  Register: { userType: 'player' | 'venue_manager' };
  PlayerRegister: { phone: string; password: string; nickname: string };
  VenueManagerRegister: { phone: string; password: string; nickname: string };
};

// ============================================
// Player Tab (球员底部导航)
// ============================================
export type PlayerTabParamList = {
  HomeTab: undefined;
  IntentionsTab: undefined;
  MatchesTab: undefined;
  ProfileTab: undefined;
};

// ============================================
// Venue Manager Tab (场地方底部导航)
// ============================================
export type VenueManagerTabParamList = {
  HomeTab: undefined;
  VenuesTab: undefined;
  ProfileTab: undefined;
};

// ============================================
// Home Stack (首页Tab内部Stack)
// ============================================
export type HomeStackParamList = {
  Home: undefined;
  VenueList: undefined;
  VenueDetail: { venueId: number };
  CreateIntention: { intentionId?: number } | undefined;
  IntentionDetail: { intentionId: number };
  MatchDetail: { matchId: number };
  ConfirmMatch: { matchId: number; depositAmount: string };
  Chat: { matchId: number; matchTitle?: string };
  EditVenue: { venue: VenueDetail };
  UnavailableSlots: { venueId: number; venueName: string };
};

// ============================================
// Intentions Stack (意向Tab内部Stack)
// ============================================
export type IntentionsStackParamList = {
  MyIntentions: undefined;
  CreateIntention: { intentionId?: number } | undefined;
  IntentionDetail: { intentionId: number };
};

// ============================================
// Matches Stack (比赛Tab内部Stack)
// ============================================
export type MatchesStackParamList = {
  MyMatches: undefined;
  MatchDetail: { matchId: number };
  ConfirmMatch: { matchId: number; depositAmount: string };
  Chat: { matchId: number; matchTitle?: string };
};

// ============================================
// Profile Stack (我的Tab内部Stack - Player)
// ============================================
export type PlayerProfileStackParamList = {
  Profile: undefined;
  EditProfile: { profile: PlayerProfile };
  Ability: {
    ability: { baseAbilityScore: number; matchAdjustValue: number; totalAbilityScore: number };
  };
};

// ============================================
// Venues Stack (场地Tab内部Stack - Venue Manager)
// ============================================
export type VenuesStackParamList = {
  VenueList: undefined;
  VenueDetail: { venueId: number };
  CreateVenue: undefined;
  EditVenue: { venue: VenueDetail };
  UnavailableSlots: { venueId: number; venueName: string };
};

// ============================================
// Venue Manager Profile Stack (我的Tab内部Stack)
// ============================================
export type VenueManagerProfileStackParamList = {
  VenueManagerProfile: undefined;
  EditVenueManagerProfile: { profile: VenueManagerProfile };
  CreateVenue: undefined;
  VenueDetail: { venueId: number };
};

// ============================================
// Root Stack (根导航，用于跨导航器跳转)
// ============================================
export type RootStackParamList = {
  Auth:
    | { screen?: keyof AuthStackParamList; params?: AuthStackParamList[keyof AuthStackParamList] }
    | undefined;
  PlayerTabs: undefined;
  VenueManagerTabs: undefined;
};

// ============================================
// Navigation prop types for type-safe navigation.navigate()
// ============================================
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type AuthStackNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type PlayerTabNavigationProp = BottomTabNavigationProp<PlayerTabParamList>;
export type VenueManagerTabNavigationProp = BottomTabNavigationProp<VenueManagerTabParamList>;

export type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;
export type RoleSelectScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RoleSelect'
>;
export type RegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;
export type PlayerRegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'PlayerRegister'
>;
export type VenueManagerRegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'VenueManagerRegister'
>;

export type HomeStackNavigationProp = NativeStackNavigationProp<HomeStackParamList>;
export type IntentionsStackNavigationProp = NativeStackNavigationProp<IntentionsStackParamList>;
export type MatchesStackNavigationProp = NativeStackNavigationProp<MatchesStackParamList>;
export type PlayerProfileStackNavigationProp =
  NativeStackNavigationProp<PlayerProfileStackParamList>;
export type VenuesStackNavigationProp = NativeStackNavigationProp<VenuesStackParamList>;
export type VenueManagerProfileStackNavigationProp =
  NativeStackNavigationProp<VenueManagerProfileStackParamList>;

export type ProfileScreenNavigationProp = NativeStackNavigationProp<
  PlayerProfileStackParamList,
  'Profile'
>;
export type EditProfileScreenNavigationProp = NativeStackNavigationProp<
  PlayerProfileStackParamList,
  'EditProfile'
>;
export type AbilityScreenNavigationProp = NativeStackNavigationProp<
  PlayerProfileStackParamList,
  'Ability'
>;
export type VenueManagerProfileScreenNavigationProp = NativeStackNavigationProp<
  VenueManagerProfileStackParamList,
  'VenueManagerProfile'
>;
export type EditVenueManagerProfileScreenNavigationProp = NativeStackNavigationProp<
  VenueManagerProfileStackParamList,
  'EditVenueManagerProfile'
>;
export type CreateVenueScreenNavigationProp = NativeStackNavigationProp<
  VenuesStackParamList,
  'CreateVenue'
>;
export type VenueListScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'VenueList'
>;
export type VenueDetailScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'VenueDetail'
>;
export type EditVenueScreenNavigationProp = NativeStackNavigationProp<
  VenuesStackParamList,
  'EditVenue'
>;
export type UnavailableSlotsScreenNavigationProp = NativeStackNavigationProp<
  VenuesStackParamList,
  'UnavailableSlots'
>;
export type CreateIntentionScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'CreateIntention'
>;
export type MyIntentionsScreenNavigationProp = NativeStackNavigationProp<
  IntentionsStackParamList,
  'MyIntentions'
>;
export type IntentionDetailScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'IntentionDetail'
>;
export type MyMatchesScreenNavigationProp = NativeStackNavigationProp<
  MatchesStackParamList,
  'MyMatches'
>;
export type MatchDetailScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'MatchDetail'
>;
export type ConfirmMatchScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'ConfirmMatch'
>;
export type ChatScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Chat'>;

// ============================================
// Route prop types for type-safe route.params
// ============================================
export type RegisterScreenRouteProp = RouteProp<AuthStackParamList, 'Register'>;
export type PlayerRegisterScreenRouteProp = RouteProp<AuthStackParamList, 'PlayerRegister'>;
export type VenueManagerRegisterScreenRouteProp = RouteProp<
  AuthStackParamList,
  'VenueManagerRegister'
>;
export type EditProfileScreenRouteProp = RouteProp<PlayerProfileStackParamList, 'EditProfile'>;
export type AbilityScreenRouteProp = RouteProp<PlayerProfileStackParamList, 'Ability'>;
export type EditVenueManagerProfileScreenRouteProp = RouteProp<
  VenueManagerProfileStackParamList,
  'EditVenueManagerProfile'
>;
export type VenueDetailScreenRouteProp = RouteProp<HomeStackParamList, 'VenueDetail'>;
export type EditVenueScreenRouteProp = RouteProp<VenuesStackParamList, 'EditVenue'>;
export type UnavailableSlotsScreenRouteProp = RouteProp<VenuesStackParamList, 'UnavailableSlots'>;
export type IntentionDetailScreenRouteProp = RouteProp<HomeStackParamList, 'IntentionDetail'>;
export type CreateIntentionScreenRouteProp = RouteProp<HomeStackParamList, 'CreateIntention'>;
export type MatchDetailScreenRouteProp = RouteProp<HomeStackParamList, 'MatchDetail'>;
export type ConfirmMatchScreenRouteProp = RouteProp<HomeStackParamList, 'ConfirmMatch'>;
export type ChatScreenRouteProp = RouteProp<HomeStackParamList, 'Chat'>;
