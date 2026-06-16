import { useRouter } from 'expo-router';
import { Bell, Globe, Hexagon, Search, Sparkles, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useCatalog, useUserProfile } from '../../api/queries';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import { useTheme } from '../../theme/ThemeContext';

export default function Catalog() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { data: userProfile, isLoading: loadingProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const { data: catalogData, isLoading: loadingCatalog, refetch: refetchCatalog } = useCatalog();

  const user = userProfile || { tokens: 0, karma: 0 };
  const catalog = (catalogData || []).filter((app: any, index: number, self: any[]) => {
    if (app.active === false) return false;
    if (app.expires_at && new Date(app.expires_at) < new Date()) return false;

    // Check if tester limit is reached
    const activeTesters = new Set(app.contracts?.filter((c: any) => c.status === 'active').map((c: any) => c.tester_id)).size || 0;
    if (activeTesters >= (app.tester_limit || 10)) return false;

    return index === self.findIndex((a) => a.id === app.id);
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.topNav}>
        <View style={styles.topNavRight}>
          <View style={styles.pill}>
            <Hexagon size={14} color={colors.primary} />
            <Text style={styles.pillText}>{user.tokens}</Text>
          </View>
          <View style={styles.pill}>
            <Sparkles size={14} color={colors.primary} />
            <Text style={styles.pillText}>{user.karma.toFixed(1)}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Bell size={20} color={colors.text} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.headerTitle}>Catalog</Text>

      <View style={styles.searchBar}>
        <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps"
          placeholderTextColor={colors.placeholder}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterText}>SORTED BY DEVELOPER KARMA</Text>
        <Text style={styles.filterText}>{catalog.length} APPS</Text>
      </View>

      {catalog.length === 0 && (
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
      )}

      {catalog.map((app) => {
        const avgRating = app.reviews?.length
          ? (app.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / app.reviews.length).toFixed(1)
          : 'New';

        return (
          <TouchableOpacity
            key={app.id}
            style={styles.appCard}
            onPress={() => router.push(`/catalog/${app.id}`)}
          >
            <View style={styles.appIconPlaceholder}>
              <AppIcon url={app.icon_url} size={48} />
            </View>

            <View style={styles.appInfo}>
              <View style={styles.appTitleRow}>
                <Text style={styles.appName}>{app.name}</Text>
                <View style={[
                  styles.tierBadge,
                  app.tier === 'Pro+' && styles.tierBadgeBlack
                ]}>
                  <Text style={[
                    styles.tierText,
                    app.tier === 'Pro+' && { color: isDark ? '#000' : '#fff' }
                  ]}>
                    {app.tier.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.appBlurb} numberOfLines={1}>{app.blurb}</Text>

              <View style={styles.appTags}>
                <View style={styles.tagBlue}>
                  <Text style={styles.tagBlueText}>{app.bounty} tokens</Text>
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
      })}

    </ScrollView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 12,
    paddingTop: 64,
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
