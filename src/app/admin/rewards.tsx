import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Save } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAdminSettings, useUpdateAdminSettings } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';

export default function AdminRewards() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { showAlert } = useCustomAlert();

  const { data: settings, isLoading } = useAdminSettings();
  const { mutate: updateSettings, isPending } = useUpdateAdminSettings();

  const [defaultBounty, setDefaultBounty] = useState('10');
  const [boostBonus, setBoostBonus] = useState('5');

  useEffect(() => {
    if (settings) {
      setDefaultBounty(settings.default_bounty.toString());
      setBoostBonus(settings.boost_bounty_bonus.toString());
    }
  }, [settings]);

  const handleSave = () => {
    const default_bounty = parseInt(defaultBounty, 10);
    const boost_bounty_bonus = parseInt(boostBonus, 10);

    if (isNaN(default_bounty) || isNaN(boost_bounty_bonus)) {
      showAlert('Error', 'Please enter valid numbers');
      return;
    }

    updateSettings(
      { default_bounty, boost_bounty_bonus },
      {
        onSuccess: () => {
          showAlert('Success', 'Reward settings updated successfully');
          router.back();
        },
        onError: (err) => {
          showAlert('Error', err.message);
        },
      }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Economy & Rewards</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Global Bounty Settings</Text>
              <Text style={styles.cardDesc}>
                These values control the base payout that testers receive when they start a testing contract. 
                All tiers will default to these rewards.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Default App Bounty (Tokens)</Text>
                <TextInput
                  style={styles.input}
                  value={defaultBounty}
                  onChangeText={setDefaultBounty}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Boost Bonus Bounty (Tokens)</Text>
                <TextInput
                  style={styles.input}
                  value={boostBonus}
                  onChangeText={setBoostBonus}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.inputHelp}>Extra tokens awarded if the app is currently boosted.</Text>
              </View>

              <TouchableOpacity 
                style={[styles.saveBtn, isPending && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Save size={20} color="#FFF" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 17,
    color: colors.text,
    marginLeft: 4,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputHelp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
}
