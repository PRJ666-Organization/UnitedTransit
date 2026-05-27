import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        headerShown: true,
        headerTitleAlign: 'center',
        tabBarButton: HapticTab,
        tabBarStyle: { backgroundColor: theme.background },

        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,

        headerTitle: ({ children }) => {
          const tabName = typeof children === 'string' ? children : '';

          return (
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: theme.text,
                }}
              >
                United Transit
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '400',
                  color: theme.text,
                  opacity: 0.6,
                  marginTop: 2,
                }}
              >
                {tabName}
              </Text>
            </View>
          );
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="bookmarks"
        options={{
          title: 'Bookmarks',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      </Tabs>
  );
}
