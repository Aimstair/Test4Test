import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ContractDay } from '../store/app';
import { useTheme } from '../theme/ThemeContext';

interface HeatmapProps {
  days: ContractDay[];
  onDayPress?: (day: ContractDay) => void;
}

export default function Heatmap({ days, onDayPress }: HeatmapProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  // 14 cells, split into 2 rows of 7
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {days.slice(0, 7).map((day) => (
          <Cell key={day.dayNumber} day={day} onPress={() => onDayPress?.(day)} isDark={isDark} styles={styles} />
        ))}
      </View>
      <View style={styles.row}>
        {days.slice(7, 14).map((day) => (
          <Cell key={day.dayNumber} day={day} onPress={() => onDayPress?.(day)} isDark={isDark} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function Cell({ day, onPress, isDark, styles }: { day: ContractDay; onPress: () => void; isDark: boolean; styles: any }) {
  let bgColor = isDark ? '#1C3322' : '#E5F1FF'; // future
  if (day.status === 'done') bgColor = '#34C759'; // Green
  else if (day.status === 'partial' || day.status === 'rejected') bgColor = '#FF9F0A'; // Amber
  else if (day.status === 'missed') bgColor = '#FF3B30'; // Red

  return (
    <TouchableOpacity 
      style={[styles.cell, { backgroundColor: bgColor }]} 
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    />
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    width: 24,
    height: 24,
    borderRadius: 4, // slight continuous corner
  },
});
