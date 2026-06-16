import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../api/auth';
import { useTheme } from '../theme/ThemeContext';

export default function Splash() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  useEffect(() => {
    if (loading) return; // Wait for auth state
    const timer = setTimeout(() => {
      if (session) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/onboarding');
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [session, loading, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.brandMark}>[ TEST4TEST ]</Text>
      <Text style={styles.tagline}>Accountable Peer Testing</Text>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#fff', // Deep dark for Linear feel
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMark: {
    fontFamily: 'monospace',
    fontSize: 18,
    color: isDark ? '#fff' : '#000',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
});
