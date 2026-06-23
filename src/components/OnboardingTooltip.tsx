import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OnboardingTooltipProps {
  visible: boolean;
  targetLayout: LayoutRect | null;
  title: string;
  description: string;
  onNext: () => void;
  onDismiss: () => void;
  stepIndex: number;
  totalSteps: number;
}

export default function OnboardingTooltip({
  visible,
  targetLayout,
  title,
  description,
  onNext,
  onDismiss,
  stepIndex,
  totalSteps,
}: OnboardingTooltipProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && targetLayout) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, targetLayout]);

  if (!visible || !targetLayout) return null;

  // Determine if the tooltip should go above or below the target
  // Arbitrary threshold: if target is in top half of screen, place tooltip below it.
  const padding = 8;
  const isTopHalf = targetLayout.y < 300; 

  const tooltipTop = isTopHalf
    ? targetLayout.y + targetLayout.height + padding
    : targetLayout.y - padding - 150; // Approximated height of the tooltip

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {/* Dark overlay backdrop */}
        <View style={styles.overlay}>
          {/* A rudimentary way to highlight the target in a Modal is to render borders that fill the screen around the target */}
          <View style={[styles.cutout, {
            top: targetLayout.y - padding,
            left: targetLayout.x - padding,
            width: targetLayout.width + padding * 2,
            height: targetLayout.height + padding * 2,
          }]} />
        </View>

        <View style={[styles.tooltipContainer, { top: tooltipTop, alignSelf: 'center' }]}>
          <View style={styles.tooltipCard}>
            <View style={styles.tooltipHeaderRow}>
              <Text style={styles.tooltipTitle}>{title}</Text>
              <Text style={styles.tooltipStep}>{stepIndex}/{totalSteps}</Text>
            </View>
            <Text style={styles.tooltipDescription}>{description}</Text>
            
            <View style={styles.tooltipActions}>
              <TouchableOpacity onPress={onDismiss}>
                <Text style={styles.dismissText}>Skip Tour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
                <Text style={styles.nextText}>{stepIndex === totalSteps ? 'Got it' : 'Next'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  cutout: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2000,
    borderColor: 'rgba(0,0,0,0.7)',
    margin: -2000,
  },
  tooltipContainer: {
    position: 'absolute',
    width: '90%',
    maxWidth: 400,
    zIndex: 100,
  },
  tooltipCard: {
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: isDark ? '#38383A' : '#E5E5EA',
  },
  tooltipHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: isDark ? '#FFFFFF' : '#000000',
  },
  tooltipStep: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: isDark ? 'rgba(10, 132, 255, 0.15)' : '#E1F0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tooltipDescription: {
    fontSize: 15,
    color: isDark ? '#8E8E93' : '#3C3C43',
    lineHeight: 22,
    marginBottom: 20,
  },
  tooltipActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: isDark ? '#8E8E93' : '#8E8E93',
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  nextText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
