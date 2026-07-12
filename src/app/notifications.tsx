import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Check, ChevronLeft, Trash2, UserPlus, Star, Clock, AlertCircle, BarChart2, CreditCard, ShieldCheck, CheckCircle } from 'lucide-react-native';
import { useAuth } from '../api/auth';
import { useNotifications } from '../api/queries';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeContext';
import Skeleton from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Notifications() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: notificationsData, isLoading } = useNotifications(session?.user?.id);
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();

  const notifications = notificationsData || [];
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  // Group notifications by date
  const grouped = notifications.reduce((acc: any, curr: any) => {
    const d = new Date(curr.created_at);
    // Determine if today, yesterday, or other
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let title = d.toLocaleDateString();
    if (title === today.toLocaleDateString()) title = 'Today';
    else if (title === yesterday.toLocaleDateString()) title = 'Yesterday';

    if (!acc[title]) acc[title] = [];
    acc[title].push(curr);
    return acc;
  }, {});

  const sections = Object.keys(grouped).map(key => ({
    title: key,
    data: grouped[key]
  }));

  const handleMarkAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session?.user?.id)
      .eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications', session?.user?.id] });
  };

  const handleClearAll = async () => {
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', session?.user?.id);
    queryClient.invalidateQueries({ queryKey: ['notifications', session?.user?.id] });
  };

  const handleMarkRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['notifications', session?.user?.id] });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['notifications', session?.user?.id] });
    } catch (e) {
      console.error('Failed to delete notification:', e);
      alert('Failed to delete notification.');
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'new_tester': return <UserPlus size={18} color={colors.primary} />;
      case 'new_review': return <Star size={18} color="#FF9500" />;
      case 'app_expiry': return <Clock size={18} color="#FF3B30" />;
      case 'app_full': return <AlertCircle size={18} color="#FF9500" />;
      case 'daily_reports': return <BarChart2 size={18} color="#34C759" />;
      case 'subscription': return <CreditCard size={18} color="#AF52DE" />;
      case 'new_proof': return <ShieldCheck size={18} color={colors.primary} />;
      case 'check_in': return <Bell size={18} color="#FFCC00" />;
      case 'testing_finished': return <CheckCircle size={18} color="#34C759" />;
      default: return <Bell size={18} color={colors.textSecondary} />;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft color={colors.primary} size={24} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 48) }]}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifications</Text>
          </View>
          <View style={{ marginTop: 24 }}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={{ flexDirection: 'row', padding: 16, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 12, marginBottom: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F2F2F7', alignItems: 'center', justifyContent: 'center' }}>
                   <Skeleton width={20} height={20} borderRadius={10} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="90%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
                  <Skeleton width="60%" height={14} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color={colors.primary} size={24} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <SectionList 
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 48) }]}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        ListHeaderComponent={
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleMarkAllRead}>
                <Check size={14} color={colors.textSecondary} />
                <Text style={styles.actionTextGrey}>Mark all read</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleClearAll}>
                <Trash2 size={14} color={colors.danger} />
                <Text style={styles.actionTextRed}>Clear all</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item: n }) => (
          <View style={[styles.card, !n.is_read && styles.cardUnread]}>
            {!n.is_read && <View style={styles.unreadStrip} />}
            <View style={styles.iconWrapper}>
              {getIcon(n.type)}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{n.title}</Text>
              <Text style={styles.cardDesc}>{n.body}</Text>
              <Text style={styles.cardTime}>
                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.cardActions}>
              {!n.is_read ? (
                <TouchableOpacity style={styles.iconAction} onPress={() => handleMarkRead(n.id)}>
                  <Check size={16} color={colors.success} />
                </TouchableOpacity>
              ) : <View style={{ width: 16 }} />}
              <TouchableOpacity style={styles.iconAction} onPress={() => handleDelete(n.id)}>
                <Trash2 size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 8,
    paddingBottom: 4,
    backgroundColor: colors.background,
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  backText: { 
    color: colors.primary, 
    fontSize: 16,
    fontWeight: '600'
  },
  content: { 
    padding: 16, 
    paddingBottom: 48 
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { 
    color: colors.text, 
    fontSize: 24, 
    fontWeight: '800' 
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  actionTextGrey: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionTextRed: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  list: { 
    gap: 12,
  },
  card: { 
    flexDirection: 'row', 
    backgroundColor: colors.card, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden'
  },
  cardUnread: {
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    borderColor: colors.primary + '40',
  },
  unreadStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
  },
  iconWrapper: {
    marginRight: 12,
    marginTop: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { 
    flex: 1, 
    paddingRight: 8 
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardActions: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconAction: {
    padding: 8,
  },
});
