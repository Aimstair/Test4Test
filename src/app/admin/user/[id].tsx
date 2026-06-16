import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, ChevronLeft, Save } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminUpdateUser, useAdminUsers } from '../../../api/queries';
import { useCustomAlert } from '../../../components/AlertProvider';
import { useTheme } from '../../../theme/ThemeContext';

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

  // Sync state once data loads
  React.useEffect(() => {
    if (user) {
      setKarma(user.karma?.toString() || '0');
      setTokens(user.tokens?.toString() || '0');
      setTier(user.subscription_tier || 'Basic');
    }
  }, [user]);

  const handleSave = () => {
    updateUser({
      user_id: id as string,
      updates: {
        karma: parseFloat(karma) || 0,
        tokens: parseInt(tokens, 10) || 0,
        subscription_tier: tier,
      }
    }, {
      onSuccess: () => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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

          <Text style={styles.label}>SUBSCRIPTION TIER</Text>
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
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleToggleBan}>
            <Ban size={20} color="#fff" />
            <Text style={styles.dangerBtnText}>{user.status === 'banned' ? 'UNBAN USER' : 'BAN USER'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingTop: 64,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 1,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    color: colors.text,
    fontSize: 16,
  },
  tierContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tierText: {
    color: colors.text,
    fontWeight: '500',
  },
  dangerZone: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.danger,
    marginBottom: 12,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 8,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1,
  },
});
