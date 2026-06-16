import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertProvider } from '../components/AlertProvider';
import { ThemeProvider as CustomThemeProvider, useTheme } from '../theme/ThemeContext';
import { requestNotificationPermissions } from '../utils/notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppNavigator() {
  const { isDark } = useTheme();

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
