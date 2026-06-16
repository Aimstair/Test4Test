import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useAuth } from '../api/auth';
import { useUserProfile, useNotifications } from '../api/queries';

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const { data: userProfile } = useUserProfile(session?.user?.id);
  const { data: notifications } = useNotifications(session?.user?.id);

  const tokens = userProfile?.tokens ?? 0;
  const karma = userProfile?.karma ?? 0;
  const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;

  // Derive title from pathname
  let title = 'TODAY';
  if (pathname.includes('/catalog')) title = 'CATALOG';
  if (pathname.includes('/studio')) title = 'BUILD';
  if (pathname.includes('/wallet')) title = 'VERIFY';
  if (pathname.includes('/profile')) title = 'ME';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.left}>
          <View style={styles.statusDot} />
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.right}>
          <View style={styles.pill}>
            <Text style={styles.pillIcon}>🪙</Text>
            <Text style={styles.pillText}>{tokens}</Text>
          </View>
          <View style={[styles.pill, { marginLeft: 8 }]}>
            <Text style={styles.pillIcon}>✨</Text>
            <Text style={styles.pillText}>{typeof karma === 'number' ? karma.toFixed(1) : karma}</Text>
          </View>
          <TouchableOpacity style={styles.bellContainer} onPress={() => router.push('/notifications')}>
            <Bell color="#fff" size={20} />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759', // Green good state
    marginRight: 8,
  },
  title: {
    fontFamily: 'monospace',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E', // Grouped background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  pillText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  bellContainer: {
    marginLeft: 16,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30', // Red bad/unread state
  },
});
