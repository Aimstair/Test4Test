import { useRouter } from 'expo-router';
import { BookOpen, Hexagon, Info, Sparkles, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useCatalog, useUserProfile } from '../../api/queries';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import { useTheme } from '../../theme/ThemeContext';

export default function Studio() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const [showComingSoon, setShowComingSoon] = React.useState(false);
  const { data: userProfile, isLoading: loadingProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const { data: catalogData, isLoading: loadingCatalog, refetch: refetchCatalog } = useCatalog();

  const user = userProfile || { tokens: 0, karma: 0 };
  const catalog = catalogData || [];

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchCatalog()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Find apps owned by the current user
  const myApps = catalog.filter((app: any) => app.owner_id === session?.user?.id);

  let activeAppLimit = 1;
  if (userProfile?.subscription_tier === 'Pro') activeAppLimit = 5;
  if (userProfile?.subscription_tier === 'Pro+') activeAppLimit = 10;

  const activeAppsCount = myApps.filter((app: any) => app.active !== false).length;

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
        </View>
      </View>

      <Text style={styles.headerTitle}>Build</Text>

      <View style={styles.splitRow}>
        <View style={styles.splitCard}>
          <Text style={styles.splitValue}>{activeAppsCount}{activeAppLimit !== Infinity ? `/${activeAppLimit}` : ''}</Text>
          <Text style={styles.splitLabel}>LIVE APPS</Text>
        </View>
        <TouchableOpacity
          style={[styles.newAppBtn, activeAppsCount >= activeAppLimit && { opacity: 0.5 }]}
          onPress={() => activeAppsCount < activeAppLimit && router.push('/studio/new')}
          activeOpacity={activeAppsCount >= activeAppLimit ? 1 : 0.7}
        >
          <Text style={styles.newAppPlus}>+</Text>
          <Text style={styles.newAppLabel}>NEW APP</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>YOUR APPS</Text>

      {myApps.length === 0 && (
        <EmptyState
          icon={<BookOpen size={48} color="#A0A0AB" strokeWidth={1.5} />}
          title="Save your app here first"
          description="Your App Library stores your app details so you don't have to re-enter them every time you list."
          steps={[
            { title: "Add your app here", description: "Enter your Play Store URL and app details once" },
            { title: "Publish to Catalog", description: "Go to the Build tab and make your app live to get testers" },
            { title: "Review Proofs", description: "Approve daily proofs to maintain your app's quality" }
          ]}
        // buttonText="+ Add your first app"
        // onPressButton={() => router.push('/studio/new')}
        />
      )}

      {myApps.map((app) => {
        const activeTesters = new Set(app.contracts?.filter((c: any) => c.status === 'active').map((c: any) => c.tester_id)).size || 0;
        const failedTesters = app.contracts?.filter((c: any) => c.status === 'failed').length || 0;
        const churnRate = (app.contracts?.length || 0) > 0 ? Math.round((failedTesters / app.contracts.length) * 100) : 0;

        const isExpired = app.expires_at ? new Date(app.expires_at) < new Date() : false;
        const daysRemaining = app.expires_at ? Math.max(0, Math.ceil((new Date(app.expires_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : 0;

        return (
          <TouchableOpacity
            key={app.id}
            style={styles.appCard}
            onPress={() => router.push(`/studio/${app.id}`)}
          >
            <View style={styles.appHeader}>
              <View style={styles.appIconPlaceholder}>
                <AppIcon url={app.icon_url} size={40} />
              </View>
              <View style={styles.appTitleCol}>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={styles.appSub}>{app.tier} • {app.tester_limit} Testers{isExpired ? ' • Expired' : app.expires_at ? ` • Expires in ${daysRemaining}d` : ' • Unlimited'}</Text>
              </View>
              <View style={[
                styles.liveBadge,
                isExpired ? { backgroundColor: 'rgba(255, 59, 48, 0.1)' } :
                app.active === false ? { backgroundColor: colors.border } : {}
              ]}>
                {!isExpired && app.active !== false && <View style={styles.liveDot} />}
                <Text style={[
                  styles.liveText,
                  isExpired ? { color: colors.danger } :
                  app.active === false ? { color: colors.textSecondary } : {}
                ]}>
                  {isExpired ? 'EXPIRED' : app.active !== false ? 'LIVE' : 'OFFLINE'}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{activeTesters}<Text style={styles.statTotal}>/{app.tester_limit || 10}</Text></Text>
                <Text style={styles.statLabel}>LOCKED</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{activeTesters}</Text>
                <Text style={styles.statLabel}>ACTIVE TODAY</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{churnRate}%</Text>
                <Text style={styles.statLabel}>CHURN</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.exportBtn} onPress={() => setShowComingSoon(true)}>
              <Text style={styles.exportBtnText}>EXPORT 14-DAY REPORT</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )
      })}

      {/* Coming Soon Modal */}
      <Modal visible={showComingSoon} transparent animationType="fade" onRequestClose={() => setShowComingSoon(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowComingSoon(false)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.modalIconCircle, { backgroundColor: isDark ? '#1C2B36' : '#E1F0FF' }]}>
              <Info size={32} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Coming Soon</Text>
            <Text style={styles.modalDesc}>This feature is currently under development and will be available in a future update.</Text>
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setShowComingSoon(false)}>
              <Text style={styles.modalBtnPrimaryText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: -1,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  splitCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 2,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    minHeight: 100,
  },
  splitValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  splitLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  newAppBtn: {
    flex: 1,
    backgroundColor: colors.text,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    minHeight: 100,
  },
  newAppPlus: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.background,
    marginBottom: 4,
    marginTop: -8,
  },
  newAppLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.background,
    letterSpacing: 1,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 8,
  },
  appCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 2,
    marginBottom: 12,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appTitleCol: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  appSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCol: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  statTotal: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  exportBtn: {
    backgroundColor: colors.warning,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportBtnText: {
    color: isDark ? '#000' : '#000',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: isDark ? 0 : 10,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalBtnPrimary: {
    backgroundColor: colors.text,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
