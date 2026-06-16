import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, CreditCard, HelpCircle, Monitor, Receipt, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { useUserProfile } from '../api/queries';
import { useTheme } from '../theme/ThemeContext';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: userProfile } = useUserProfile(session?.user?.id);
  const { theme, setTheme, colors } = useTheme();

  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#000" />
          <Text style={styles.backText}>Me</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>

        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Monitor size={20} color="#8E8E93" />
            <Text style={styles.cardTitle}>Interface theme</Text>
          </View>
          <View style={styles.themeToggleRow}>
            <TouchableOpacity
              style={[styles.themeBtn, theme === 'dark' && styles.themeBtnActive]}
              onPress={() => setTheme('dark')}
            >
              <Text style={[styles.themeBtnText, theme === 'dark' && styles.themeBtnTextActive]}>Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeBtn, theme === 'light' && styles.themeBtnActive]}
              onPress={() => setTheme('light')}
            >
              <Text style={[styles.themeBtnText, theme === 'light' && styles.themeBtnTextActive]}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeBtn, theme === 'system' && styles.themeBtnActive]}
              onPress={() => setTheme('system')}
            >
              <Text style={[styles.themeBtnText, theme === 'system' && styles.themeBtnTextActive]}>System</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
        <View style={[styles.card, { padding: 0 }]}>
          <TouchableOpacity style={styles.listItem} onPress={() => router.push('/settings/notifications')}>
            <View style={styles.iconContainer}>
              <Bell size={20} color="#8E8E93" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Notification Preferences</Text>
              <Text style={styles.rowSub}>Manage app and system alerts</Text>
            </View>
            <ChevronRight size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>PURCHASES</Text>
        <View style={[styles.card, { padding: 0 }]}>
          <TouchableOpacity style={styles.listItem} onPress={() => router.push('/pricing')}>
            <View style={styles.iconContainer}>
              <CreditCard size={20} color="#8E8E93" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Buy test tokens</Text>
              <Text style={styles.rowSub}>Add balance for bounties and listings</Text>
            </View>
            <ChevronRight size={16} color="#C7C7CC" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.listItem}>
            <View style={styles.iconContainer}>
              <Receipt size={20} color="#8E8E93" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Invoices</Text>
              <Text style={styles.rowSub}>Receipts and purchase history</Text>
            </View>
            <Text style={styles.soonText}>Soon</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowCenter}>
            <View style={styles.iconContainer}>
              <ShieldCheck size={20} color="#8E8E93" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Developer verification</Text>
              <Text style={styles.rowSub}>Identity, devices, and Play Console compliance</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>SUPPORT & HELP</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowCenter} onPress={() => router.push('/support')}>
            <View style={styles.iconContainer}>
              <HelpCircle size={20} color="#8E8E93" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Help & Support</Text>
              <Text style={styles.rowSub}>Report bugs, feedback, and view tickets</Text>
            </View>
            <ChevronRight size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {userProfile?.role === 'admin' && (
          <>
            <Text style={styles.sectionTitle}>ADMINISTRATION</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.rowCenter} onPress={() => router.push('/admin')}>
                <View style={styles.iconContainer}>
                  <ShieldAlert size={20} color="#8E8E93" />
                </View>
                <View style={styles.rowTextCol}>
                  <Text style={styles.rowTitle}>Admin Panel</Text>
                  <Text style={styles.rowSub}>Manage users, tickets, and reports</Text>
                </View>
                <ChevronRight size={16} color="#C7C7CC" />
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
  content: {
    padding: 12,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeBtn: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  themeBtnActive: {
    backgroundColor: colors.primary,
  },
  themeBtnText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  themeBtnTextActive: {
    color: '#fff',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  rowSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  onBadge: {
    backgroundColor: colors.success + '20', // 20% opacity
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  offBadge: {
    backgroundColor: colors.danger + '20',
  },
  offBadgeText: {
    color: colors.danger,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 52, // Align with text
  },
  soonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
