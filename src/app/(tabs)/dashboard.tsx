import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter } from 'expo-router';
import { Bell, Camera, Hexagon, Rocket, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useContracts, useUploadProof, useUserProfile, useForfeitContract } from '../../api/queries';
import { setupDailyReminders } from '../../utils/notifications';
import { useCustomAlert } from '../../components/AlertProvider';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import UtcCountdown from '../../components/UtcCountdown';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';

export default function Dashboard() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { data: userProfile, isLoading: loadingProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const { data: contractsData, isLoading: loadingContracts, refetch: refetchContracts } = useContracts(session?.user?.id);

  const rawContracts = contractsData || [];
  // Only show active contracts, deduplicated by app (keep latest)
  const contracts = rawContracts
    .filter((c: any) => c.status === 'active')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.app_id === c.app_id) === i);
  const user = userProfile || { tokens: 0, karma: 0 };
  const { mutate: uploadProof, isPending: isUploading } = useUploadProof();

  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const appState = useRef(AppState.currentState);
  const lastBackgroundTimeRef = useRef<number | null>(null);
  const launchCheckTimeoutRef = useRef<any>(null);
  const didLeaveApp = useRef(false);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchContracts()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      setupDailyReminders(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (timer <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
  }, [timer, isTimerRunning]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        didLeaveApp.current = true;
        if (isTimerRunning && timer > 0) {
          lastBackgroundTimeRef.current = Date.now();
        }
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isTimerRunning && timer > 0 && lastBackgroundTimeRef.current) {
          const elapsed = Math.floor((Date.now() - lastBackgroundTimeRef.current) / 1000);
          setTimer(prev => Math.max(0, prev - elapsed));
          lastBackgroundTimeRef.current = null;
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isTimerRunning, timer]);

  const launchApp = (contract: any) => {
    if (!contract.app?.package_name) {
      showAlert('No Package', 'No test package set for this app.');
      return;
    }
    const pkg = contract.app.package_name;
    didLeaveApp.current = false;
    if (launchCheckTimeoutRef.current) clearTimeout(launchCheckTimeoutRef.current);

    try {
      IntentLauncher.openApplication(pkg);
      setActiveAppId(contract.id);
      setIsTimerRunning(true);
      setTimer(60);

      launchCheckTimeoutRef.current = setTimeout(() => {
        if (!didLeaveApp.current) {
          setIsTimerRunning(false);
          setActiveAppId(null);
          setTimer(60);
          showAlert('App not launched', 'Make sure the app is installed.');
        }
      }, 3000);
    } catch (e) {
      console.log('Launch failed', e);
      showAlert('Launch failed', 'Make sure the app is installed.');
    }
  };

  const handleUploadProof = async (contractId: string, dayNumber: number) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const ext = result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpeg';
      const filename = `${session?.user?.id}_proof_${Date.now()}.${ext}`;
      const filePath = `proofs/${filename}`;

      try {
        const { error } = await supabase.storage
          .from('public-assets')
          .upload(filePath, decode(result.assets[0].base64), {
            contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        uploadProof({ contractId, dayNumber, proofUrl: publicUrl, testerId: session?.user?.id }, {
          onSuccess: () => {
            showAlert('+1 Karma Earned! ⭐', 'Proof uploaded for review. You earned +1 Karma for checking in today!');
            setActiveAppId(null);
            setTimer(60);
          },
          onError: (err: any) => showAlert('Error', err.message)
        });
      } catch (err: any) {
        showAlert('Upload Failed', err.message);
      }
    }
  };

  // Active contracts metrics
  const activeCount = contracts.filter((c: any) => c.status === 'active').length;
  // This is a naive calculation for prototype
  const doneTodayCount = contracts.filter((c: any) =>
    c.days.some((d: any) => d.status === 'done' && d.day_number === 1) // Using day_number from DB
  ).length;
  const atRiskCount = contracts.filter((c: any) =>
    c.days.some((d: any) => d.status === 'missed')
  ).length;

  if (loadingProfile || loadingContracts) {
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
            <Text style={styles.pillText}>{typeof user.karma === 'number' ? user.karma.toFixed(1) : user.karma}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Bell size={20} color={colors.text} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.headerTitle}>Today</Text>

      <View style={styles.utcCard}>
        <View style={styles.utcHeaderRow}>
          <Text style={styles.utcHeader}>UTC RESET</Text>
          <View style={styles.blueDot} />
        </View>
        <UtcCountdown />
        <Text style={styles.utcSub}>Miss the window → -1 karma. No exceptions.</Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ACTIVE</Text>
          <Text style={styles.metricValue}>{activeCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>DONE TODAY</Text>
          <Text style={styles.metricValue}>{doneTodayCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>PENDING</Text>
          <Text style={styles.metricValue}>{atRiskCount}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>YOUR 14-DAY CONTRACTS</Text>

      {contracts.length === 0 && (
        <EmptyState
          icon={<Rocket size={48} color="#A0A0AB" strokeWidth={1.5} />}
          title="Start Testing Apps"
          description="Earn tokens by testing other developers' apps daily."
          steps={[
            { title: "Browse the Catalog", description: "Find an app that needs testing in the Catalog tab" },
            { title: "Opt-in & Install", description: "Follow the Play Store link to opt-in and install the app" },
            { title: "Upload Proof", description: "Launch the app from here and upload your screenshot proof daily" }
          ]}
          buttonText="Browse Catalog"
          onPressButton={() => router.push('/(tabs)/catalog')}
        />
      )}

      {contracts.map((contract: any) => {
        // App is joined in query
        const app = contract.app;
        if (!app) return null;

        const todayStr = new Date().toISOString().split('T')[0];

        // Find today's specific contract day
        const currentDay = contract.days.find((d: any) => d.date === todayStr) || contract.days.find((d: any) => d.status === 'future') || contract.days[0];

        const getCellStatus = (d: any) => {
          if (d.status === 'done') return 'done';
          if (d.status === 'verified') return 'pending';
          if (d.date < todayStr && d.status !== 'done' && d.status !== 'verified') return 'missed';
          return 'future';
        };

        return (
          <View key={contract.id} style={styles.contractCard}>
            <View style={styles.contractHeader}>
              <View style={styles.appIconPlaceholder}>
                <AppIcon url={app.icon_url} size={40} />
              </View>
              <View>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={styles.appSub}>DAY {currentDay?.day_number || 1}/14 • +1 KARMA PER CHECK-IN</Text>
              </View>
            </View>

            <View style={styles.heatmapRow}>
              {contract.days.sort((a: any, b: any) => a.day_number - b.day_number).map((d: any, i: number) => {
                const cellStatus = getCellStatus(d);
                return (
                  <View
                    key={d.day_number || i}
                    style={[
                      styles.heatmapCell,
                      cellStatus === 'done' ? styles.cellDone :
                        cellStatus === 'pending' ? styles.cellPending :
                          cellStatus === 'missed' ? styles.cellMissed :
                            styles.cellFuture
                    ]}
                  />
                );
              })}
            </View>

            {currentDay?.date === todayStr && (currentDay.status === 'verified' || currentDay.status === 'done') ? (
              <View style={styles.statusMessageRow}>
                <Text style={styles.statusMessageText}>
                  {currentDay.status === 'verified'
                    ? 'WAITING FOR DEVELOPER CONFIRMATION'
                    : 'DONE FOR TODAY'}
                </Text>
              </View>
            ) : currentDay?.date !== todayStr ? (
              <View style={styles.statusMessageRow}>
                <Text style={styles.statusMessageText}>
                  NO TASKS FOR TODAY
                </Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnYellow]}
                  disabled={activeAppId === contract.id && isTimerRunning}
                  onPress={() => launchApp(contract)}
                >
                  <Rocket size={16} color="#000" />
                  <Text style={styles.btnTextBlack}>
                    {activeAppId === contract.id && isTimerRunning ? `APP OPEN... ${timer}s` : 'LAUNCH'}
                  </Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.btn, activeAppId === contract.id && timer <= 0 ? styles.btnBlue : styles.btnDisabled]}
                    disabled={isUploading || activeAppId !== contract.id || timer > 0}
                    onPress={() => handleUploadProof(contract.id, currentDay?.day_number || 1)}
                  >
                    <Camera size={16} color={activeAppId === contract.id && timer <= 0 ? "#fff" : "#8E8E93"} />
                    <Text style={activeAppId === contract.id && timer <= 0 ? styles.btnTextWhite : styles.btnTextDisabled}>
                      {isUploading ? '...' : 'PROOF'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '700', marginTop: 4 }}>+1 Karma ⭐</Text>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {contracts.length > 0 && (
        <TouchableOpacity
          style={styles.findBtn}
          onPress={() => router.push('/catalog')}
        >
          <Text style={styles.findBtnText}>FIND ANOTHER APP TO TEST</Text>
        </TouchableOpacity>
      )}
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
  utcCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  utcHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  utcHeader: {
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  utcSub: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
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
  },
  metricLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  contractCard: {
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
  },
  contractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  appSub: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  heatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  heatmapCell: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 2,
    borderRadius: 4,
  },
  cellDone: {
    backgroundColor: colors.primary,
  },
  cellPending: {
    backgroundColor: colors.warning,
  },
  cellFuture: {
    backgroundColor: isDark ? '#1C2B36' : '#E1F0FF',
    borderWidth: 1,
    borderColor: isDark ? '#2D4559' : '#C7E0FF',
  },
  cellMissed: {
    backgroundColor: colors.danger,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.text,
    gap: 8,
  },
  btnYellow: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  btnBlue: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnDisabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  btnTextBlack: {
    color: isDark ? '#000' : '#000',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
  },
  btnTextWhite: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
  },
  btnTextDisabled: {
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
  },
  findBtn: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  findBtnText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  statusMessageRow: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusMessageText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
