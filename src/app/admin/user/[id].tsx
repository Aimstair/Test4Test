import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, ChevronLeft, Clock, Save } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminUpdateUser, useAdminUsers } from '../../../api/queries';
import { useCustomAlert } from '../../../components/AlertProvider';
import { useTheme } from '../../../theme/ThemeContext';
import { sendNotification } from '../../../utils/notifications';

const DURATION_OPTIONS = [
  { label: '1 Week', days: 7 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '1 Year', days: 365 },
  { label: 'Permanent', days: 0 },
];

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { data: users, isLoading } = useAdminUsers(true);
  const user = users?.find(u => u.id === id);

  const { mutate: updateUser, isPending } = useAdminUpdateUser();

  const [karma, setKarma] = useState(user?.karma?.toString() || '0');
  const [tokens, setTokens] = useState(user?.tokens?.toString() || '0');
  const [tier, setTier] = useState(user?.subscription_tier || 'Basic');
  const [selectedDuration, setSelectedDuration] = useState<{ label: string; days: number } | null>(null);
  const [showDurationModal, setShowDurationModal] = useState(false);

  // Sync state once data loads
  React.useEffect(() => {
    if (user) {
      setKarma(user.karma?.toString() || '0');
      setTokens(user.tokens?.toString() || '0');
      setTier(user.subscription_tier || 'Basic');
    }
  }, [user]);

  const handleSave = () => {
    const newKarma = parseFloat(karma) || 0;
    const newTokens = parseInt(tokens, 10) || 0;

    const updates: any = {
      karma: newKarma,
      tokens: newTokens,
      subscription_tier: tier,
    };

    // Calculate subscription expiry
    if (tier !== 'Basic') {
      if (selectedDuration && selectedDuration.days > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + selectedDuration.days);
        updates.subscription_expires_at = expiresAt.toISOString();
      } else if (selectedDuration?.days === 0) {
        // Permanent — clear expiry
        updates.subscription_expires_at = null;
      }
    } else {
      updates.subscription_expires_at = null;
    }

    updateUser({ user_id: id as string, updates }, {
      onSuccess: () => {
        // Send notifications for changes
        if (user) {
          const karmaChanged = newKarma !== (user.karma || 0);
          const tokensChanged = newTokens !== (user.tokens || 0);
          const tierChanged = tier !== (user.subscription_tier || 'Basic');

          if (karmaChanged) {
            const diff = newKarma - (user.karma || 0);
            sendNotification(
              id as string,
              'Karma Adjusted',
              `An admin ${diff >= 0 ? 'added' : 'removed'} ${Math.abs(diff)} Karma ${diff >= 0 ? 'to' : 'from'} your account.`,
              'subscription',
              id as string
            );
          }

          if (tokensChanged) {
            const diff = newTokens - (user.tokens || 0);
            sendNotification(
              id as string,
              'Tokens Adjusted',
              `An admin ${diff >= 0 ? 'added' : 'removed'} ${Math.abs(diff)} token${Math.abs(diff) !== 1 ? 's' : ''} ${diff >= 0 ? 'to' : 'from'} your account.`,
              'subscription',
              id as string
            );
          }

          if (tierChanged) {
            const durationLabel = selectedDuration ? ` for ${selectedDuration.label}` : '';
            sendNotification(
              id as string,
              'Subscription Updated',
              `An admin updated your subscription to ${tier}${durationLabel}.`,
              'subscription',
              id as string
            );
          }
        }

        showAlert('Success', 'User profile updated successfully.');
      },
      onError: (err: any) => {
        showAlert('Error', err.message);
      }
    });
  };

  const handleToggleBan = () => {
    const isBanned = user?.status === 'banned';
    const newStatus = isBanned ? 'active' : 'banned';
    const title = isBanned ? 'Unban User' : 'Ban User';
    const msg = isBanned ? 'Are you sure you want to unban this user?' : 'Are you sure you want to ban this user? They will not be able to use the app.';

    showAlert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: title, style: isBanned ? 'default' : 'destructive', onPress: () => {
          updateUser({
            user_id: id as string,
            updates: { status: newStatus }
          }, {
            onSuccess: () => showAlert('Success', `User has been ${newStatus}.`)
          });
        }
      }
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>User not found.</Text>
      </View>
    );
  }

  const currentExpiry = user.subscription_expires_at
    ? new Date(user.subscription_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 48) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Manage User</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isPending}>
          {isPending ? <ActivityIndicator size="small" color="#fff" /> : <Save size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User Info</Text>
          <Text style={styles.infoText}>ID: {user.id}</Text>
          <Text style={styles.infoText}>Name: {user.name || 'Unknown'}</Text>
          <Text style={styles.infoText}>Role: {user.role}</Text>
          <Text style={styles.infoText}>Status: <Text style={{ color: user.status === 'banned' ? colors.danger : colors.success }}>{user.status.toUpperCase()}</Text></Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Metrics & Balances</Text>
          <Text style={styles.hint}>Changes will notify the user automatically.</Text>

          <Text style={styles.label}>KARMA SCORE</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={karma}
            onChangeText={setKarma}
          />

          <Text style={styles.label}>TEST TOKENS</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={tokens}
            onChangeText={setTokens}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription</Text>
          {currentExpiry && (
            <View style={styles.expiryRow}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={styles.expiryText}>Current expiry: {currentExpiry}</Text>
            </View>
          )}

          <Text style={styles.label}>TIER</Text>
          <View style={styles.tierContainer}>
            {['Basic', 'Pro', 'Pro+'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tierBtn, tier === t && { borderColor: colors.primary, backgroundColor: 'rgba(10,132,255,0.1)' }]}
                onPress={() => setTier(t)}
              >
                <Text style={[styles.tierText, tier === t && { color: colors.primary, fontWeight: 'bold' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tier !== 'Basic' && (
            <>
              <Text style={styles.label}>DURATION</Text>
              <TouchableOpacity
                style={styles.durationBtn}
                onPress={() => setShowDurationModal(true)}
              >
                <Clock size={16} color={colors.textSecondary} />
                <Text style={styles.durationBtnText}>
                  {selectedDuration ? selectedDuration.label : 'Select Duration'}
                </Text>
              </TouchableOpacity>
              {!selectedDuration && (
                <Text style={styles.hint}>No change to current expiry unless you select a duration.</Text>
              )}
            </>
          )}
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleToggleBan}>
            <Ban size={20} color="#fff" />
            <Text style={styles.dangerBtnText}>{user.status === 'banned' ? 'UNBAN USER' : 'BAN USER'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Duration Selection Modal */}
      <Modal visible={showDurationModal} transparent animationType="fade" onRequestClose={() => setShowDurationModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Duration</Text>
            <Text style={styles.modalSubtitle}>How long should this subscription last?</Text>
            {DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[styles.durationOption, selectedDuration?.label === option.label && styles.durationOptionSelected]}
                onPress={() => {
                  setSelectedDuration(option);
                  setShowDurationModal(false);
                }}
              >
                <Text style={[styles.durationOptionText, selectedDuration?.label === option.label && { color: colors.primary, fontWeight: '800' }]}>
                  {option.label}
                </Text>
                {selectedDuration?.label === option.label && (
                  <Text style={{ color: colors.primary }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDurationModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 4,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: isDark ? '#1C2B36' : '#E1F0FF',
    padding: 10,
    borderRadius: 8,
  },
  expiryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tierContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tierBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  tierText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  durationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
  },
  durationBtnText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  dangerZone: {
    backgroundColor: isDark ? 'rgba(255,59,48,0.1)' : '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    marginBottom: 16,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  dangerBtn: {
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  durationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? '#1C1C1E' : '#F9F9F9',
  },
  durationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(10,132,255,0.08)',
  },
  durationOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
