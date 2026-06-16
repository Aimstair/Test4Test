import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MetricProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export default function Metric({ label, value, highlight = false }: MetricProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'flex-start',
  },
  label: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
  },
  highlight: {
    color: '#34C759', // Green
  },
});
