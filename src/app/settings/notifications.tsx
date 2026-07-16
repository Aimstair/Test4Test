import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../api/auth';
import { supabase } from '../../lib/supabase';
import { useCustomAlert } from '../../components/AlertProvider';
import { NotificationType } from '../../utils/notifications';

export default function NotificationSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();

  const [isLoading, setIsLoading] = useState(true);
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>({
    new_tester: true,
    new_review: true,
    app_expiry: true,
    app_full: true,
    daily_reports: true,
    subscription: true,
    new_proof: true,
    check_in: true,
    testing_finished: true,
    support: true,
    report: true,
  });

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!session?.user?.id) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('notification_prefs')
          .eq('id', session.user.id)
          .single();
        if (error) throw error;

        if (data?.notification_prefs) {
          setPrefs((prev) => ({ ...prev, ...(data.notification_prefs as any) }));
        }
      } catch (err) {
        console.error('Error fetching notification prefs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrefs();
  }, [session?.user?.id]);

  const togglePref = async (type: NotificationType) => {
    if (!session?.user?.id) return;
    const newPrefs = { ...prefs, [type]: !prefs[type] };
    setPrefs(newPrefs);

    try {
      const { error } = await supabase
        .from('users')
        .update({ notification_prefs: newPrefs })
        .eq('id', session.user.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating notification prefs:', err);
      showAlert('Error', 'Failed to update settings. Please try again.');
      setPrefs(prefs); // Revert on error
    }
  };

  const renderToggle = (title: string, description: string, type: NotificationType) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextCol}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={prefs[type]}
        onValueChange={() => togglePref(type)}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.pageSubtitle}>Manage your alerts and daily reminders.</Text>

          <Text style={styles.sectionTitle}>APP DEVELOPER</Text>
          <View style={styles.card}>
            {renderToggle('New Tester', 'When someone starts testing your app', 'new_tester')}
            <View style={styles.divider} />
            {renderToggle('New Review', 'When a tester leaves a rating/review', 'new_review')}
            <View style={styles.divider} />
            {renderToggle('New Proof Submitted', 'When a tester submits a daily proof', 'new_proof')}
            <View style={styles.divider} />
            {renderToggle('App Full', 'When your app reaches tester capacity', 'app_full')}
            <View style={styles.divider} />
            {renderToggle('App Expiry', 'When your app listing is about to expire', 'app_expiry')}
            <View style={styles.divider} />
            {renderToggle('Daily Reports', 'Daily summary of active apps (9:00 AM)', 'daily_reports')}
          </View>

          <Text style={styles.sectionTitle}>APP TESTER</Text>
          <View style={styles.card}>
            {renderToggle('Daily Check-in', 'Reminder to submit proof (8:00 PM)', 'check_in')}
            <View style={styles.divider} />
            {renderToggle('Testing Finished', 'When you complete a 14-day test', 'testing_finished')}
          </View>

          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            {renderToggle('Subscription Updates', 'Successful upgrades or expiries', 'subscription')}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
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
  content: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
});
