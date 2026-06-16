import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeType = 'light' | 'dark' | 'system';

export const Colors = {
  light: {
    background: '#F3F4F6',
    card: '#fff',
    text: '#000',
    textSecondary: '#8E8E93',
    textTertiary: '#A0A0AB',
    primary: '#0A84FF',
    border: '#E5E5EA',
    danger: '#FF3B30',
    warning: '#FF9500',
    success: '#34C759',
    overlay: 'rgba(0,0,0,0.6)',
    cardShadow: '#000',
    tabBar: '#fff',
    badgeText: '#fff',
    tagBg: '#F2F2F7',
    tagText: '#4A4A4A',
    placeholder: '#8E8E93',
    pillBg: '#fff',
  },
  dark: {
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#636366',
    primary: '#0A84FF',
    border: '#38383A',
    danger: '#FF453A',
    warning: '#FF9F0A',
    success: '#32D74B',
    overlay: 'rgba(0,0,0,0.8)',
    cardShadow: 'transparent',
    tabBar: '#1C1C1E',
    badgeText: '#fff',
    tagBg: '#2C2C2E',
    tagText: '#EBEBF5',
    placeholder: '#8E8E93',
    pillBg: '#2C2C2E',
  }
};

type ThemeContextType = {
  theme: ThemeType;
  isDark: boolean;
  colors: typeof Colors.light;
  setTheme: (theme: ThemeType) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>('light'); // default until loaded
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('appearance').then(val => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemeState(val as ThemeType);
      } else {
        setThemeState('system'); 
      }
      setIsLoaded(true);
    });
  }, []);

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('appearance', newTheme);
  };

  const isDark = theme === 'system' ? systemColorScheme === 'dark' : theme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  if (!isLoaded) return null; // Or return children with default colors

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
