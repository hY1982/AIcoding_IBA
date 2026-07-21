import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import { HomeStackNavigator } from './HomeStackNavigator';
import { VenuesStackNavigator } from './VenuesStackNavigator';
import { VenueManagerProfileStackNavigator } from './VenueManagerProfileStackNavigator';
import type { VenueManagerTabParamList } from './types';

const Tab = createBottomTabNavigator<VenueManagerTabParamList>();

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>;
}

export function VenueManagerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="首页" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="VenuesTab"
        component={VenuesStackNavigator}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="场地" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={VenueManagerProfileStackNavigator}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="我的" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 4,
    paddingBottom: 4,
    height: 56,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999',
  },
  tabLabelActive: {
    color: '#3498db',
    fontWeight: '600',
  },
});
