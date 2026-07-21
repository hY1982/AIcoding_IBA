import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { VenueListScreen } from '@/screens/venue/VenueListScreen';
import { VenueDetailScreen } from '@/screens/venue/VenueDetailScreen';
import { CreateIntentionScreen } from '@/screens/intention/CreateIntentionScreen';
import { IntentionDetailScreen } from '@/screens/intention/IntentionDetailScreen';
import { MatchDetailScreen } from '@/screens/match/MatchDetailScreen';
import { ConfirmMatchScreen } from '@/screens/match/ConfirmMatchScreen';
import { ChatScreen } from '@/screens/chat/ChatScreen';
import { EditVenueScreen } from '@/screens/venue/EditVenueScreen';
import { UnavailableSlotsScreen } from '@/screens/venue/UnavailableSlotsScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'I Basketball', headerTitleStyle: { fontSize: 18 } }}
      />
      <Stack.Screen name="VenueList" component={VenueListScreen} options={{ title: '场地列表' }} />
      <Stack.Screen
        name="VenueDetail"
        component={VenueDetailScreen}
        options={{ title: '场地详情' }}
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
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{ title: '比赛详情' }}
      />
      <Stack.Screen
        name="ConfirmMatch"
        component={ConfirmMatchScreen}
        options={{ title: '确认参赛' }}
      />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '群聊' }} />
      <Stack.Screen name="EditVenue" component={EditVenueScreen} options={{ title: '编辑场地' }} />
      <Stack.Screen
        name="UnavailableSlots"
        component={UnavailableSlotsScreen}
        options={{ title: '不可预订时段' }}
      />
    </Stack.Navigator>
  );
}
