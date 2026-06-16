import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Users, MessageSquare, AlertTriangle, Activity } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Admin Panel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        
        <View style={styles.heroCard}>
          <Activity size={32} color={colors.primary} style={{ marginBottom: 12 }} />
          <Text style={styles.heroTitle}>Overview</Text>
          <Text style={styles.heroSub}>Manage the Test4Test platform</Text>
        </View>

        <Text style={styles.sectionTitle}>MANAGEMENT</Text>

        <View style={styles.card}>
          <TouchableOpacity style={styles.rowCenter} onPress={() => router.push('/admin/tickets')}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(10, 132, 255, 0.1)' }]}>
              <MessageSquare size={20} color="#0A84FF" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Support Tickets</Text>
              <Text style={styles.rowSub}>Review and reply to user inquiries</Text>
            </View>
            <ChevronRight size={16} color="#C7C7CC" />
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.rowCenter} onPress={() => router.push('/admin/users')}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
              <Users size={20} color="#34C759" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>User Directory</Text>
              <Text style={styles.rowSub}>Manage karma, tokens, tiers, and bans</Text>
            </View>
            <ChevronRight size={16} color="#C7C7CC" />
          </TouchableOpacity>
          
          <View style={styles.divider} />

          <TouchableOpacity style={styles.rowCenter} onPress={() => router.push('/admin/reports')}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
              <AlertTriangle size={20} color="#FF3B30" />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>App Moderation</Text>
              <Text style={styles.rowSub}>Review flagged apps and disputes</Text>
            </View>
            <ChevronRight size={16} color="#C7C7CC" />
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
  content: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },
});
