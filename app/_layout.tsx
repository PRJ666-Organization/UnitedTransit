import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '@/components/auth-provider';
import { useAuth } from '@/hooks/use-auth';
import { ThemeProvider } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDatabase } from '../server/src/db/database';
import { TripProvider } from '@/contexts/TripContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Database initialization failed:', err);
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>DB Error: {error}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Initializing database...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <TripProviderWrapper>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ presentation: 'modal', title: 'Account' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </TripProviderWrapper>
      </NavThemeProvider>
    </AuthProvider>
  );
}

// Wrapper component to pass auth context to TripProvider
function TripProviderWrapper({ children }: { children: React.ReactNode }) {
  const { user, getDeviceId } = useAuth();
  const [deviceId, setDeviceId] = useState<string | undefined>();

  useEffect(() => {
    // Get device ID for anonymous users
    if (!user) {
      getDeviceId().then(id => setDeviceId(id));
    }
  }, [user, getDeviceId]);

  return (
    <TripProvider userId={user?.userId} deviceId={deviceId}>
      {children}
    </TripProvider>
  );
}
