import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TierBadgeProps {
  tier: 'Basic' | 'Pro' | 'Pro+';
}

export default function TierBadge({ tier }: TierBadgeProps) {
  let bgColor = '#2C2C2E';
  let textColor = '#8E8E93';

  if (tier === 'Pro') {
    bgColor = 'rgba(10, 132, 255, 0.2)'; // tint of system blue
    textColor = '#0A84FF';
  } else if (tier === 'Pro+') {
    bgColor = 'rgba(191, 90, 242, 0.2)'; // purple
    textColor = '#BF5AF2';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
