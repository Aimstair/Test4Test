import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface UtcCountdownProps {
  compact?: boolean;
}

export default function UtcCountdown({ compact = false }: UtcCountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(now.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const format = (n: number) => n.toString().padStart(2, '0');
      setTimeLeft(`${format(hours)}:${format(mins)}:${format(secs)}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactText}>{timeLeft}</Text>
      </View>
    );
  }

  // The design for the homepage features a very specific text layout
  // 10 : 48 : 38 where colons might be styled slightly differently or spaced
  const parts = timeLeft.split(':');
  
  if (parts.length === 3) {
    return (
      <View style={styles.row}>
        <Text style={styles.timeText}>{parts[0]}</Text>
        <Text style={styles.colon}>:</Text>
        <Text style={styles.timeText}>{parts[1]}</Text>
        <Text style={styles.colon}>:</Text>
        <Text style={styles.timeText}>{parts[2]}</Text>
      </View>
    );
  }

  return <Text style={styles.timeText}>{timeLeft}</Text>;
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeText: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  colon: {
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontSize: 32,
    fontWeight: '800',
    marginHorizontal: 4,
    transform: [{ translateY: -4 }],
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compactText: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '600',
  },
});
