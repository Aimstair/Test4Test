import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X, ShieldCheck, TrendingUp, Flame } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KarmaGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function KarmaGuideModal({ visible, onClose }: KarmaGuideModalProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.title}>What is Karma?</Text>
          <Text style={styles.subtitle}>Karma is your reputation score in the Test4Test community. A higher Karma score means your apps will rank higher in the catalog!</Text>

          <ScrollView style={styles.stepsContainer}>
            
            <View style={styles.stepBox}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Flame size={24} color="#ef4444" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>1. Test Diligently</Text>
                <Text style={styles.stepDesc}>Join campaigns and test other developers' apps reliably without missing days.</Text>
              </View>
            </View>

            <View style={styles.connector} />

            <View style={styles.stepBox}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <ShieldCheck size={24} color="#22c55e" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>2. Follow Instructions</Text>
                <Text style={styles.stepDesc}>Upload correct daily screenshots and provide constructive feedback. Good behavior earns developer approval.</Text>
              </View>
            </View>

            <View style={styles.connector} />

            <View style={styles.stepBox}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <TrendingUp size={24} color="#3b82f6" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>3. Rank Higher</Text>
                <Text style={styles.stepDesc}>High Karma testers are trusted by the community. When you publish your own app, it will be promoted and ranked higher!</Text>
              </View>
            </View>

          </ScrollView>

          <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
            <Text style={styles.actionBtnText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 32,
    maxHeight: '90%',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  stepsContainer: {
    marginBottom: 24,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  connector: {
    width: 2,
    height: 32,
    backgroundColor: colors.border,
    marginLeft: 23,
    marginVertical: 4,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
