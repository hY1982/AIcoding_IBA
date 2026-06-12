import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import { VenueManagerProfileScreen } from './src/screens/venue/VenueManagerProfileScreen';
import { EditVenueManagerProfileScreen } from './src/screens/venue/EditVenueManagerProfileScreen';
import { CreateVenueScreen } from './src/screens/venue/CreateVenueScreen';
import { VenueDetailScreen } from './src/screens/venue/VenueDetailScreen';
import { VenueListScreen } from './src/screens/venue/VenueListScreen';
import { EditVenueScreen } from './src/screens/venue/EditVenueScreen';
import { UnavailableSlotsScreen } from './src/screens/venue/UnavailableSlotsScreen';
import { MyIntentionsScreen } from './src/screens/intention/MyIntentionsScreen';
import { CreateIntentionScreen } from './src/screens/intention/CreateIntentionScreen';
import { IntentionDetailScreen } from './src/screens/intention/IntentionDetailScreen';
import { MyMatchesScreen } from './src/screens/match/MyMatchesScreen';
import { MatchDetailScreen } from './src/screens/match/MatchDetailScreen';
import { ConfirmMatchScreen } from './src/screens/match/ConfirmMatchScreen';
import { ChatScreen } from './src/screens/chat/ChatScreen';
import { useAppStore } from './src/stores';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

  const handleIntentionPress = () => {
    navigation.navigate('MyIntentions');
  };

  const handleMatchesPress = () => {
    navigation.navigate('MyMatches');
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
      {user?.userType === 'player' && (
        <>
          <TouchableOpacity
            style={styles.intentionButton}
            onPress={handleIntentionPress}
            accessibilityLabel="我的意向"
            accessibilityRole="button"
          >
            <Text style={styles.intentionButtonText}>我的意向</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.matchButton}
            onPress={handleMatchesPress}
            accessibilityLabel="我的比赛"
            accessibilityRole="button"
          >
            <Text style={styles.matchButtonText}>我的比赛</Text>
          </TouchableOpacity>
        </>
      )}
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
          name="VenueManagerProfile"
          component={VenueManagerProfileScreen}
          options={{ title: '我的资料' }}
        />
        <Stack.Screen
          name="EditVenueManagerProfile"
          component={EditVenueManagerProfileScreen}
          options={{ title: '编辑资料' }}
        />
        <Stack.Screen
          name="CreateVenue"
          component={CreateVenueScreen}
          options={{ title: '新建场地' }}
        />
        <Stack.Screen
          name="VenueList"
          component={VenueListScreen}
          options={{ title: '场地列表' }}
        />
        <Stack.Screen
          name="VenueDetail"
          component={VenueDetailScreen}
          options={{ title: '场地详情' }}
        />
        <Stack.Screen
          name="EditVenue"
          component={EditVenueScreen}
          options={{ title: '编辑场地' }}
        />
        <Stack.Screen
          name="UnavailableSlots"
          component={UnavailableSlotsScreen}
          options={{ title: '不可预订时段' }}
        />
        <Stack.Screen
          name="MyIntentions"
          component={MyIntentionsScreen}
          options={{ title: '我的意向' }}
        />
        <Stack.Screen
          name="CreateIntention"
          component={CreateIntentionScreen}
          options={{ title: '创建意向' }}
        />
        <Stack.Screen
          name="IntentionDetail"
          component={IntentionDetailScreen}
          options={{ title: '意向详情' }}
        />
        <Stack.Screen
          name="MyMatches"
          component={MyMatchesScreen}
          options={{ title: '我的比赛' }}
        />
        <Stack.Screen
          name="MatchDetail"
          component={MatchDetailScreen}
          options={{ title: '比赛详情' }}
        />
        <Stack.Screen
          name="ConfirmMatch"
          component={ConfirmMatchScreen}
          options={{ title: '确认参赛' }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: '群聊' }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'I Basketball',
            headerTitleStyle: { fontSize: 18 },
          }}
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
  profileButton: {
    marginTop: 32,
    backgroundColor: '#3498db',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  venueButton: {
    marginTop: 16,
    backgroundColor: '#27ae60',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  intentionButton: {
    marginTop: 16,
    backgroundColor: '#f39c12',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  venueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  intentionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  matchButton: {
    marginTop: 16,
    backgroundColor: '#9b59b6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  matchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
