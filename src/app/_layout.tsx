import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertProvider } from '../components/AlertProvider';
import { ThemeProvider as CustomThemeProvider, useTheme } from '../theme/ThemeContext';
import { registerPushToken, requestNotificationPermissions } from '../utils/notifications';
import { checkForInAppUpdates } from '../utils/inAppUpdates';
import { useAuth } from '../api/auth';
import OfflineBanner from '../components/OfflineBanner';
import EventModal from '../components/EventModal';

SplashScreen.preventAutoHideAsync();

// 24-hour offline cache so data persists when the user has no connection
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,    // 5 minutes before refetch
      retry: 1,
    },
  },
});

function AppNavigator() {
  const { isDark } = useTheme();
  const { session } = useAuth();

  // Register device push token whenever auth state resolves to a logged-in user
  useEffect(() => {
    if (session?.user?.id) {
      registerPushToken(session.user.id);
    }
  }, [session?.user?.id]);

  // Check for Google Play In-App Updates when the app launches
  useEffect(() => {
    checkForInAppUpdates();
  }, []);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AlertProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="catalog/[id]" />
          <Stack.Screen name="studio/[id]" />
          <Stack.Screen name="studio/new" />
          <Stack.Screen name="testing/[id]" />
          <Stack.Screen name="setup/[id]" />
          <Stack.Screen name="pricing" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="how-it-works" />
          <Stack.Screen name="transactions" />
          <Stack.Screen name="notifications" />
        </Stack>
        <OfflineBanner />
        <StatusBar style={isDark ? "light" : "dark"} />
      </AlertProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    requestNotificationPermissions();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <AppNavigator />
      </CustomThemeProvider>
    </QueryClientProvider>
  );
}
