import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
export default function OfflineBanner() {
  return null;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 80, // sits above the tab bar
    left: 16,
    right: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
