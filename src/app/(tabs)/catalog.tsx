import { useRouter } from 'expo-router';
import { Coins, Flame, Globe, Search, Star } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useCatalog, useNotifications, useUserProfile, useAdminSettings } from '../../api/queries';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import EventModal from '../../components/EventModal';
import EventFloatingIcon from '../../components/EventFloatingIcon';

export default function Catalog() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { data: userProfile, isLoading: loadingProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const user = userProfile || { tokens: 0, karma: 0 };
  const { data: catalogData, isLoading: loadingCatalog, refetch: refetchCatalog } = useCatalog();
  const { data: adminSettings } = useAdminSettings();
  const defaultBounty = adminSettings?.default_bounty ?? 10;
  const boostBonus = adminSettings?.boost_bounty_bonus ?? 5;

  const [filter, setFilter] = useState<'Boosted' | 'All'>('Boosted');
  const [showEventModal, setShowEventModal] = useState(false);

  const { data: notifications } = useNotifications(session?.user?.id);
  const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;

  const catalog = (catalogData || []).filter((app: any, index: number, self: any[]) => {
    if (app.active === false || app.banned === true) return false;
    const isUnlimited = app.app_type !== 'Production' && (app.owner?.subscription_tier === 'Pro' || app.owner?.subscription_tier === 'Pro+');

    let effectiveExpiresAt = app.expires_at ? new Date(app.expires_at) : null;
    if (!effectiveExpiresAt && app.created_at) {
      let days = 14;
      if (app.tier === 'Pro') days = 20;
      if (app.tier === 'Pro+') days = 30;
      effectiveExpiresAt = new Date(app.created_at);
      effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + days);
    }

    if (!isUnlimited && effectiveExpiresAt && effectiveExpiresAt < new Date()) return false;

    if (filter === 'Boosted') {
      if (!app.boost_ends_at || new Date(app.boost_ends_at) <= new Date()) return false;
    }

    // Check if tester limit is reached
    const activeTesters = new Set(app.contracts?.filter((c: any) => c.status === 'active').map((c: any) => c.tester_id)).size || 0;
    if (activeTesters >= (app.tester_limit || 10)) return false;

    return index === self.findIndex((a) => a.id === app.id);
  }).sort((a: any, b: any) => {
    const aBoosted = a.boost_ends_at && new Date(a.boost_ends_at) > new Date();
    const bBoosted = b.boost_ends_at && new Date(b.boost_ends_at) > new Date();

    if (aBoosted && !bBoosted) return -1;
    if (!aBoosted && bBoosted) return 1;

    // Sort by developer karma (descending)
    return (b.owner?.karma || 0) - (a.owner?.karma || 0);
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchCatalog()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (loadingProfile || loadingCatalog) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={{ marginBottom: 24 }}>
            <Skeleton width="100%" height={40} borderRadius={8} />
          </View>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={64} height={64} borderRadius={16} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Skeleton width="60%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="40%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
                  <Skeleton width="80%" height={14} borderRadius={4} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        data={catalog}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <View style={styles.searchBar}>
              <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search apps"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={[styles.segmentBtn, filter === 'Boosted' && styles.segmentBtnActive]}
                onPress={() => setFilter('Boosted')}
              >
                <Text style={[styles.segmentBtnText, filter === 'Boosted' && styles.segmentBtnTextActive]}>Boosted 🔥</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, filter === 'All' && styles.segmentBtnActive]}
                onPress={() => setFilter('All')}
              >
                <Text style={[styles.segmentBtnText, filter === 'All' && styles.segmentBtnTextActive]}>All Apps</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.filterText}>{filter === 'Boosted' ? 'PROMOTED APPS' : 'SORTED BY '}</Text>
                {filter !== 'Boosted' && <Flame size={14} color={colors.textSecondary} style={{ marginLeft: 2, marginBottom: 2 }} />}
              </View>
              <Text style={styles.filterText}>{catalog.length} APPS</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Search size={48} color="#A0A0AB" strokeWidth={1.5} />}
            title="No Apps Available"
            description="There are currently no apps listed for testing. Be the first to publish one!"
            steps={[
              { title: "Build your listing", description: "Go to the Build tab to add your app details" },
              { title: "Publish", description: "Publish your listing to make it available for testers" },
              { title: "Get Tested", description: "Testers will opt-in and test your app for 14 days" }
            ]}
            buttonText="Go to Build"
            onPressButton={() => router.push('/(tabs)/studio')}
          />
        }
        renderItem={({ item: app }) => {
          const isNew = new Date(app.created_at).getTime() > new Date().getTime() - 24 * 60 * 60 * 1000;
          const avgRating = app.reviews?.length
            ? (app.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / app.reviews.length).toFixed(1)
            : isNew ? 'New' : '0';

          return (
            <TouchableOpacity
              style={styles.appCard}
              onPress={() => router.push(`/catalog/${app.id}`)}
            >
              <View style={styles.appIconPlaceholder}>
                <AppIcon url={app.icon_url} size={48} />
              </View>

              <View style={styles.appInfo}>
                <View style={styles.appTitleRow}>
                  <Text style={[styles.appName, { flexShrink: 1, marginRight: 8 }]} numberOfLines={1}>{app.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {app.boost_ends_at && new Date(app.boost_ends_at) > new Date() && (
                      <View style={{ backgroundColor: 'rgba(255, 149, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FF9500' }}>🔥</Text>
                      </View>
                    )}
                    {app.app_type === 'Production' && (
                      <View style={{ backgroundColor: 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#34C759' }}>⭐</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.appBlurb} numberOfLines={1}>{app.blurb}</Text>

                <View style={styles.appTags}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Coins size={16} color="#eab308" />
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                        +{app.boost_ends_at && new Date(app.boost_ends_at) > new Date() ? defaultBounty + boostBonus : defaultBounty}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Flame size={16} color="#ef4444" />
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>+1</Text>
                    </View>
                  </View>
                  <View style={styles.tagOutline}>
                    <Star size={12} color={avgRating === 'New' ? colors.textSecondary : colors.text} fill={avgRating === 'New' ? "transparent" : colors.text} />
                    <Text style={[styles.tagOutlineText, avgRating === 'New' && { color: colors.textSecondary }]}>{avgRating}</Text>
                  </View>
                  <View style={styles.tagTextRow}>
                    {app.geo_targets?.includes('Global') ? (
                      <Globe size={14} color={colors.primary} />
                    ) : (
                      <Text style={styles.tagText}>{(app.geo_targets || []).join(' ')}</Text>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <EventFloatingIcon onPress={() => setShowEventModal(true)} />
      <EventModal visible={showEventModal} onClose={() => setShowEventModal(false)} />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  pillText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  iconBtn: {
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: -1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  appCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 2,
    alignItems: 'center',
  },
  appIconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  appInfo: {
    flex: 1,
  },
  appTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  tierBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierBadgeBlack: {
    backgroundColor: isDark ? '#fff' : '#000',
    borderColor: isDark ? '#fff' : '#000',
  },
  tierText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  appBlurb: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 10,
  },
  appActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: colors.text,
  },
  appTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagBlue: {
    backgroundColor: isDark ? '#1C2B36' : '#E1F0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagBlueText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  tagOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tagOutlineText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  tagTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  tagText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
