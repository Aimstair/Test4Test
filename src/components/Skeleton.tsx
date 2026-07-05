import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  flex?: number;
}

export default function Skeleton({ width, height, borderRadius = 8, style, flex }: SkeletonProps) {
  const { isDark } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      true // reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseStyle: ViewStyle = {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    borderRadius,
    overflow: 'hidden',
  };

  if (width !== undefined) baseStyle.width = width as any;
  if (height !== undefined) baseStyle.height = height as any;
  if (flex !== undefined) baseStyle.flex = flex;

  return (
    <Animated.View style={[baseStyle, style, animatedStyle]} />
  );
}
