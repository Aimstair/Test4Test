import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BookOpen, Rocket, Sparkles, X, Coins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useCatalog, useUserProfile } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import EventFloatingIcon from '../../components/EventFloatingIcon';
import EventModal from '../../components/EventModal';

export default function Studio() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { data: userProfile, isLoading: loadingProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const { data: catalogData, isLoading: loadingCatalog, refetch: refetchCatalog } = useCatalog();

  const user = userProfile || { tokens: 0, karma: 0 };
  const catalog = catalogData || [];

  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('studio_first_visit').then(visited => {
      if (!visited) {
        setShowWelcome(true);
      }
    });
  }, []);

  const dismissWelcome = () => {
    setShowWelcome(false);
    AsyncStorage.setItem('studio_first_visit', 'true');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchCatalog()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Helper to determine if an app is expired
  const checkIsExpired = (app: any) => {
    const isUnlimited = app.app_type !== 'Production' && (userProfile?.subscription_tier === 'Pro' || userProfile?.subscription_tier === 'Pro+');
    let effectiveExpiresAt = app.expires_at ? new Date(app.expires_at) : null;
    if (!effectiveExpiresAt && app.created_at) {
      let days = 14;
      if (app.tier === 'Pro') days = 20;
      if (app.tier === 'Pro+') days = 30;
      effectiveExpiresAt = new Date(app.created_at);
      effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + days);
    }
    return !isUnlimited && effectiveExpiresAt ? effectiveExpiresAt < new Date() : false;
  };

  // Find apps owned by the current user
  const myApps = catalog
    .filter((app: any) => app.owner_id === session?.user?.id)
    .sort((a: any, b: any) => {
      const aLive = a.active !== false && !checkIsExpired(a);
      const bLive = b.active !== false && !checkIsExpired(b);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  let activeAppLimit = 1;
  if (userProfile?.subscription_tier === 'Pro') activeAppLimit = 3;
  if (userProfile?.subscription_tier === 'Pro+') activeAppLimit = 5;

  const activeAppsCount = myApps.filter((app: any) => app.active !== false && !checkIsExpired(app)).length;

  if (loadingProfile || loadingCatalog) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Skeleton width={120} height={32} borderRadius={4} style={{ marginBottom: 24 }} />
          <View style={{ marginBottom: 24 }}>
            <Skeleton width="100%" height={120} borderRadius={12} />
          </View>
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.appCard}>
              <View style={styles.appHeader}>
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* <Text style={styles.headerTitle}>Build</Text> */}

        <View style={styles.splitRow}>
          <View style={styles.splitCard}>
            <Text style={styles.splitValue}>{activeAppsCount}{activeAppLimit !== Infinity ? `/${activeAppLimit}` : ''}</Text>
            <Text style={styles.splitLabel}>LIVE APPS</Text>
          </View>
          {activeAppsCount >= activeAppLimit ? (
            <TouchableOpacity
              style={[styles.newAppBtn, { backgroundColor: '#AF52DE' }]}
              onPress={() => {
                if (userProfile?.subscription_tier === 'Pro+') {
                  showAlert('Limit Reached', 'You have reached the maximum active apps limit.');
                } else {
                  router.push('/pricing');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.newAppPlus}>↑</Text>
              <Text style={styles.newAppLabel}>
                {userProfile?.subscription_tier === 'Pro+' 
                  ? 'LIMIT REACHED' 
                  : userProfile?.subscription_tier === 'Pro' 
                    ? 'UPGRADE PRO+' 
                    : 'UPGRADE PRO'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.newAppBtn}
              onPress={() => {
                if (userProfile?.subscription_tier === 'Basic' && (userProfile?.tokens || 0) < 50) {
                  setShowTokenModal(true);
                } else {
                  router.push('/studio/new');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.newAppPlus}>+</Text>
              <Text style={styles.newAppLabel}>NEW APP</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>YOUR APPS</Text>

        {myApps.length === 0 && (
          <EmptyState
            icon={<BookOpen size={48} color="#A0A0AB" strokeWidth={1.5} />}
            title="Ready to launch?"
            description="You need 100 Tokens to get 20 guaranteed testers. Test apps to earn Tokens for FREE, or upgrade to Pro."
            steps={[
              { title: "1. Earn Tokens for Free", description: "Go to the Catalog and test 3 apps to earn enough Tokens." },
              { title: "2. Add your app", description: "Enter your Play Store URL and app details." },
              { title: "3. Publish to Catalog", description: "Make your app live and get your testers." }
            ]}
            buttonText="Earn Tokens Now"
            onPressButton={() => router.push('/(tabs)/catalog')}
          />
        )}

        {myApps.map((app) => {
          const activeTesters = new Set(app.contracts?.filter((c: any) => c.status === 'active').map((c: any) => c.tester_id)).size || 0;
          const failedTesters = app.contracts?.filter((c: any) => c.status === 'failed').length || 0;
          const churnRate = (app.contracts?.length || 0) > 0 ? Math.round((failedTesters / app.contracts.length) * 100) : 0;

          const isUnlimited = app.app_type !== 'Production' && (userProfile?.subscription_tier === 'Pro' || userProfile?.subscription_tier === 'Pro+');

          const isExpired = checkIsExpired(app);
          let effectiveExpiresAt = app.expires_at ? new Date(app.expires_at) : null;
          if (!effectiveExpiresAt && app.created_at) {
            let days = 14;
            if (app.tier === 'Pro') days = 20;
            if (app.tier === 'Pro+') days = 30;
            effectiveExpiresAt = new Date(app.created_at);
            effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + days);
          }
          const daysRemaining = effectiveExpiresAt ? Math.max(0, Math.ceil((effectiveExpiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : 0;

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
                  <Text style={styles.appSub}>{app.tier} • {app.tester_limit} Testers{isExpired ? ' • Expired' : isUnlimited ? ' • Unlimited' : ` • Expires in ${daysRemaining}d`}</Text>
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

              <TouchableOpacity style={styles.exportBtn} onPress={() => showAlert('Coming Soon', 'This feature is currently under development and will be available in a future update.')}>
                <Text style={styles.exportBtnText}>EXPORT 14-DAY REPORT</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )
        })}

        {/* First-time Studio Welcome Modal */}
        <Modal visible={showWelcome} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { alignItems: 'stretch' }]}>
              <TouchableOpacity style={styles.modalClose} onPress={dismissWelcome}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={[styles.modalIconCircle, { backgroundColor: isDark ? '#1C2B36' : '#E1F0FF' }]}>
                  <Rocket size={32} color={colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Welcome to Studio</Text>
              </View>

              <Text style={styles.modalBody}>
                This is your developer dashboard. Here you can list your apps, track testers, review daily proofs, and manage settings.
              </Text>

              <View style={styles.proTipCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Sparkles size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.proTipTitle}>Pro Tip: Auto-Approve</Text>
                </View>
                <Text style={styles.proTipBody}>
                  Manually reviewing 20 testers every day can be tedious. Pro+ members can enable Auto-Approve to handle it automatically!
                </Text>
              </View>

              <TouchableOpacity style={styles.modalBtnPrimary} onPress={dismissWelcome}>
                <Text style={styles.modalBtnPrimaryText}>Let's Build</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Insufficient Tokens Modal */}
        <Modal visible={showTokenModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { width: '90%', maxWidth: 400, padding: 24, alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', padding: 12, borderRadius: 24, marginRight: 12 }}>
                  <Coins size={28} color="#eab308" />
                </View>
                <Text style={[styles.modalTitle, { marginBottom: 0, fontSize: 22 }]}>Insufficient Tokens</Text>
              </View>
              
              <Text style={[styles.modalBody, { fontSize: 16, textAlign: 'center', marginBottom: 8 }]}>
                You need <Text style={{fontWeight: '800', color: colors.text}}>50 Tokens</Text> to publish this app. You currently have <Text style={{fontWeight: '800', color: colors.text}}>{userProfile?.tokens || 0}</Text>.
              </Text>
              <Text style={[styles.modalBody, { fontSize: 16, textAlign: 'center', marginBottom: 24 }]}>
                Test apps in the Catalog to earn Tokens for FREE, or buy them from the store.
              </Text>
              
              <View style={{ flexDirection: 'column', gap: 12, marginTop: 8, width: '100%' }}>
                <TouchableOpacity 
                  style={[styles.modalBtnPrimary, { paddingVertical: 16, borderRadius: 12 }]} 
                  onPress={() => { setShowTokenModal(false); router.push('/catalog'); }}
                >
                  <Text style={[styles.modalBtnPrimaryText, { fontSize: 16 }]}>Test Apps (Earn Free Tokens)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalBtnPrimary, { paddingVertical: 16, borderRadius: 12, backgroundColor: isDark ? '#333' : '#E5E5EA' }]} 
                  onPress={() => { setShowTokenModal(false); router.push('/pricing'); }}
                >
                  <Text style={[styles.modalBtnPrimaryText, { color: colors.text, fontSize: 16 }]}>Buy Tokens from Store</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ paddingVertical: 16, borderRadius: 12, backgroundColor: 'transparent', alignItems: 'center' }} 
                  onPress={() => setShowTokenModal(false)}
                >
                  <Text style={{ fontWeight: '700', fontSize: 16, color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>

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
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    minHeight: 100,
  },
  newAppPlus: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    marginTop: -8,
  },
  newAppLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  proTipCard: {
    backgroundColor: isDark ? '#1C3322' : '#E5F1FF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(52, 199, 89, 0.3)' : 'rgba(10, 132, 255, 0.3)',
    marginBottom: 24,
  },
  proTipTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  proTipBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
