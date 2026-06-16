import React from 'react';
import { View, Image as RNImage, StyleSheet, ViewStyle } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

interface AppIconProps {
  url?: string;
  size?: number;
  style?: any;
}

export default function AppIcon({ url, size = 48, style }: AppIconProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  if (url && url.startsWith('http')) {
    return (
      <RNImage 
        source={{ uri: url }} 
        style={[
          { width: size, height: size, borderRadius: size * 0.2 },
          style
        ]} 
      />
    );
  }

  return (
    <View style={[
      styles.placeholder,
      { width: size, height: size, borderRadius: size * 0.2 },
      style
    ]}>
      <ImageIcon size={size * 0.5} color={colors.textSecondary} />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  placeholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
