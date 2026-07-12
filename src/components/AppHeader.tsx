import { usePathname, useRouter } from 'expo-router';
import { BadgeCheck, Bell, Coins, Flame, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { LayoutChangeEvent, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../api/auth';
import { useNotifications, useUserProfile } from '../api/queries';
import TokenGuideModal from './TokenGuideModal';
import KarmaGuideModal from './KarmaGuideModal';
import MembershipGuideModal from './MembershipGuideModal';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AppHeaderProps {
  onLayoutPills?: (e: LayoutChangeEvent) => void;
}

export default function AppHeader({ onLayoutPills }: AppHeaderProps = {}) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const { data: userProfile } = useUserProfile(session?.user?.id);
  const { data: notifications } = useNotifications(session?.user?.id);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [showKarmaGuide, setShowKarmaGuide] = useState(false);
  const [showMembershipGuide, setShowMembershipGuide] = useState(false);
  const insets = useSafeAreaInsets();

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
    <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) }]}>
      <View style={styles.container}>
        <View style={styles.left} onLayout={onLayoutPills}>
          <TouchableOpacity
            style={[styles.pill, { minWidth: 'auto', paddingRight: 10, marginRight: 8, justifyContent: 'center' }]}
            onPress={() => setShowMembershipGuide(true)}
          >
            <BadgeCheck size={22} color={isDark ? "#000" : "#FFF"} fill="#eab308" />
            <Text style={[styles.pillText, { marginLeft: 6, color: '#ef4444' }]}>
              {userProfile?.subscription_tier === 'Pro+' ? 'PRO+' : userProfile?.subscription_tier === 'Pro' ? 'PRO' : 'FREE'}
            </Text>
          </TouchableOpacity>

          <View style={styles.pill}>
            <TouchableOpacity style={styles.pillContent} onPress={() => setShowKarmaGuide(true)}>
              <Flame size={16} color="#ef4444" />
              <Text style={styles.pillText}>{typeof karma === 'number' ? karma.toFixed(1) : karma}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.plusBtn} onPress={() => router.push('/pricing')}>
              <Plus size={14} color={isDark ? "#000" : "#FFF"} strokeWidth={3} />
            </TouchableOpacity>
          </View>

          <View style={[styles.pill, { marginLeft: 8 }]}>
            <TouchableOpacity style={styles.pillContent} onPress={() => setShowTokenGuide(true)}>
              <Coins size={16} color="#eab308" />
              <Text style={styles.pillText}>{tokens}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.plusBtn} onPress={() => router.push('/pricing')}>
              <Plus size={14} color={isDark ? "#000" : "#FFF"} strokeWidth={3} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.right}>
          <TouchableOpacity style={styles.bellContainer} onPress={() => router.push('/notifications')}>
            <Bell color="#8A92A6" size={24} />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <TokenGuideModal
        visible={showTokenGuide}
        onClose={() => setShowTokenGuide(false)}
      />
      <KarmaGuideModal
        visible={showKarmaGuide}
        onClose={() => setShowKarmaGuide(false)}
      />
      <MembershipGuideModal
        visible={showMembershipGuide}
        onClose={() => setShowMembershipGuide(false)}
        userTier={userProfile?.subscription_tier}
      />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: {
    backgroundColor: isDark ? 'rgba(10, 10, 10, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
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
    justifyContent: 'space-between',
    minWidth: 100, // Fixed long width
    backgroundColor: isDark ? '#333333' : '#F2F2F7',
    borderRadius: 20, // More rounded like the image
    padding: 2,
    paddingLeft: 10,
  },
  plusBtn: {
    backgroundColor: isDark ? '#FFFFFF' : '#000000',
    width: 24,
    height: 24,
    borderRadius: 8, // Square with rounded corners
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '800',
  },
  bellContainer: {
    marginLeft: 12,
    position: 'relative',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30', // Red bad/unread state
  },
});
