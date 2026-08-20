import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Rocket } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useContracts, useDisputeProof, useNotifications, useUploadProof, useUserProfile } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import EmptyState from '../../components/EmptyState';
import EventFloatingIcon from '../../components/EventFloatingIcon';
import EventModal from '../../components/EventModal';
import OnboardingTooltip, { LayoutRect } from '../../components/OnboardingTooltip';
import Skeleton from '../../components/Skeleton';
import UtcCountdown from '../../components/UtcCountdown';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';
import { setupDailyReminders } from '../../utils/notifications';

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [isFocused, setIsFocused] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    const checkEventModal = async () => {
      try {
        const lastSeenStr = await AsyncStorage.getItem('@last_seen_event_modal');
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        if (lastSeenStr !== todayStr) {
          setShowEventModal(true);
          await AsyncStorage.setItem('@last_seen_event_modal', todayStr);
        }
      } catch (err) {
        // fail silently
      }
    };
    checkEventModal();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { data: userProfile, isLoading: loadingProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const { data: contractsData, isLoading: loadingContracts, refetch: refetchContracts } = useContracts(session?.user?.id);

  const rawContracts = contractsData || [];
  // Split into active and completed (all days resolved)
  const isContractCompleted = (c: any) => {
    if (!c.days || c.days.length === 0) return false;
    if (c.days.some((d: any) => d.status === 'rejected')) return false;
    
    const todayStr = new Date().toISOString().split('T')[0];
    return c.days.every((d: any) => 
      ['done', 'verified', 'missed'].includes(d.status) || d.date < todayStr
    );
  };

  const contracts = rawContracts
    .filter((c: any) => c.status === 'active' && !isContractCompleted(c))
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.app_id === c.app_id) === i);

  const user = userProfile || { tokens: 0, karma: 0 };
  const { data: notifications } = useNotifications(session?.user?.id);
  const unreadCount = (notifications || []).filter((n: any) => !n.is_read).length;
  const { mutate: uploadProof, isPending: isUploading } = useUploadProof();
  const { mutate: disputeProof } = useDisputeProof();

  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const appState = useRef(AppState.currentState);
  const lastBackgroundTimeRef = useRef<number | null>(null);
  const launchCheckTimeoutRef = useRef<any>(null);
  const didLeaveApp = useRef(false);

  const [refreshing, setRefreshing] = useState(false);

  // Tooltip Tour State
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(1);
  const [pillsLayout, setPillsLayout] = useState<LayoutRect | null>(null);
  const [utcLayout, setUtcLayout] = useState<LayoutRect | null>(null);
  const [ctaLayout, setCtaLayout] = useState<LayoutRect | null>(null);
  const [userIntent, setUserIntent] = useState<'tester' | 'developer'>('tester');

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

      // Check if we need to show the onboarding tour
      AsyncStorage.getItem('onboarding_tooltips_completed').then(completed => {
        if (!completed) {
          AsyncStorage.getItem('user_primary_intent').then(intent => {
            if (intent === 'developer' || intent === 'tester') {
              setUserIntent(intent);
            }
            setShowTour(true);
          });
        }
      });
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

  const handleUploadProof = async (contractId: string, dayNumber: number, dayId: string, totalDays: number) => {
    if (dayNumber === totalDays) {
      router.push(`/testing/survey?contractId=${contractId}&dayId=${dayId}`);
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
      exif: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const exif = result.assets[0].exif as any;
      if (exif && (exif.DateTimeOriginal || exif.DateTime)) {
        const dateStr = exif.DateTimeOriginal || exif.DateTime;
        const imgDate = dateStr.substring(0, 10).replace(/:/g, '-');

        // Use LOCAL date (not UTC) so users in non-UTC timezones (e.g. Manila UTC+8)
        // aren't incorrectly rejected when submitting after local midnight but before UTC midnight.
        const now = new Date();
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Only enforce date validation if the string format looks correct (YYYY:MM:DD)
        if (dateStr.includes(':') && imgDate !== todayDate) {
          showAlert('Invalid Proof', 'This screenshot was not taken today. Please take a fresh screenshot.');
          return;
        }
      }

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
            showAlert('Proof Uploaded! 🚀', 'Your proof has been submitted and is pending review by the developer. Karma will be added once approved.');
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

  const handleDispute = (proofId: string) => {
    disputeProof(proofId, {
      onSuccess: () => {
        showAlert('Dispute Submitted', 'Your proof has been sent to an Admin for review. If upheld, you will receive your Karma.');
      },
      onError: (err: any) => showAlert('Error', err.message)
    });
  };

  // Active contracts metrics
  const activeCount = contracts.filter((c: any) => c.status === 'active').length;
  const todayStr2 = new Date().toISOString().split('T')[0];
  const doneTodayCount = contracts.filter((c: any) =>
    c.days.some((d: any) => d.date === todayStr2 && (d.status === 'done' || d.status === 'verified'))
  ).length;
  const atRiskCount = contracts.filter((c: any) =>
    c.days.some((d: any) => d.status === 'rejected')
  ).length;

  if (loadingProfile || loadingContracts) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <Skeleton flex={1} height={80} borderRadius={12} />
            <Skeleton flex={1} height={80} borderRadius={12} />
          </View>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={64} height={64} borderRadius={16} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Skeleton width="60%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width="40%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
                  <Skeleton width="100%" height={8} borderRadius={4} />
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
      <AppHeader onLayoutPills={(e) => setPillsLayout(e.nativeEvent.layout)} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* <Text style={styles.headerTitle}>Today</Text> */}

        <View
          style={styles.utcCard}
          onLayout={(e) => {
            // Adjust for absolute position relative to ScrollView if needed, 
            // but local coordinates might be fine if Modal is positioned relatively 
            // or we can use measureInWindow. For simplicity we use onLayout y.
            setUtcLayout(e.nativeEvent.layout);
          }}
        >
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
          <View onLayout={(e) => setCtaLayout(e.nativeEvent.layout)}>
            <EmptyState
              icon={<Rocket size={48} color="#A0A0AB" strokeWidth={1.5} />}
              title="Start Testing Apps"
              description="Earn tokens by testing other developers' apps daily."
              steps={[
                { title: "Browse the Catalog", description: "Find an app that needs testing in the Catalog tab" },
                { title: "Opt-in & Install", description: "Follow the Play Store link to opt-in and install the app" },
                { title: "Upload Proof", description: "Launch the app from here and upload your screenshot proof daily" }
              ]}
              buttonText={userIntent === 'developer' ? "Head to Studio" : "Browse Catalog"}
              onPressButton={() => {
                if (userIntent === 'developer') {
                  router.push('/(tabs)/studio');
                } else {
                  router.push('/(tabs)/catalog');
                }
              }}
            />
          </View>
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

          const numDays = contract.days.length;

          return (
            <View key={contract.id} style={styles.contractCard}>
              <TouchableOpacity style={styles.contractHeader} onPress={() => router.push(`/catalog/${app.id}`)}>
                <View style={styles.appIconPlaceholder}>
                  <AppIcon url={app.icon_url} size={40} />
                </View>
                <View>
                  <Text style={styles.appName}>{app.name}</Text>
                  <Text style={styles.appSub}>DAY {currentDay?.day_number || 1}/{numDays}</Text>
                </View>
              </TouchableOpacity>

              {contract.days.filter((d: any) => d.status === 'rejected' && !d.disputed).map((rejectedDay: any) => (
                <View key={`reject-${rejectedDay.id}`} style={styles.rejectedBlock}>
                  <Text style={styles.rejectedTitle}>🛑 Proof Rejected (Day {rejectedDay.day_number})</Text>
                  {rejectedDay.reject_reason && <Text style={styles.rejectReason}>Reason: {rejectedDay.reject_reason}</Text>}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.btnDispute, { flex: 1, backgroundColor: colors.primary }]}
                      onPress={() => handleUploadProof(contract.id, rejectedDay.day_number, rejectedDay.id, contract.apps?.app_type === 'Production' ? 7 : 14)}
                      disabled={isUploading}
                    >
                      <Text style={styles.btnTextWhite}>{isUploading ? 'UPLOADING...' : 'RE-UPLOAD'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnDispute, { flex: 1 }]}
                      onPress={() => handleDispute(rejectedDay.id)}
                    >
                      <Text style={styles.btnTextWhite}>DISPUTE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

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
                      onPress={() => handleUploadProof(contract.id, currentDay?.day_number || 1, currentDay?.id, contract.apps?.app_type === 'Production' ? 7 : 14)}
                    >
                      <Camera size={16} color={activeAppId === contract.id && timer <= 0 ? "#fff" : "#8E8E93"} />
                      <Text style={activeAppId === contract.id && timer <= 0 ? styles.btnTextWhite : styles.btnTextDisabled}>
                        {isUploading ? '...' : (currentDay?.day_number === numDays ? 'SURVEY' : 'PROOF')}
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



        {isFocused && (
          <>
            <OnboardingTooltip
              visible={showTour && tourStep === 1}
              targetLayout={pillsLayout}
              title="Your Balances"
              description="Tokens are currency to list apps. Karma is your reputation score."
              stepIndex={1}
              totalSteps={3}
              onNext={() => setTourStep(2)}
              onDismiss={() => {
                setShowTour(false);
                AsyncStorage.setItem('onboarding_tooltips_completed', 'true');
              }}
            />
            <OnboardingTooltip
              visible={showTour && tourStep === 2}
              targetLayout={utcLayout}
              title="Midnight UTC Reset"
              description="All daily tasks reset at midnight UTC. Missing a day costs you Karma!"
              stepIndex={2}
              totalSteps={3}
              onNext={() => setTourStep(3)}
              onDismiss={() => {
                setShowTour(false);
                AsyncStorage.setItem('onboarding_tooltips_completed', 'true');
              }}
            />
            <OnboardingTooltip
              visible={showTour && tourStep === 3}
              targetLayout={ctaLayout}
              title={userIntent === 'developer' ? "List your first app" : "Find your first app"}
              description={userIntent === 'developer' ? "Head to the Studio tab to submit your app for testing." : "Head to the Catalog tab to find an app to test and earn tokens."}
              stepIndex={3}
              totalSteps={3}
              onNext={() => {
                setShowTour(false);
                AsyncStorage.setItem('onboarding_tooltips_completed', 'true');
              }}
              onDismiss={() => {
                setShowTour(false);
                AsyncStorage.setItem('onboarding_tooltips_completed', 'true');
              }}
            />
          </>
        )}
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
    height: 24,
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
    color: '#000',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  btnTextDisabled: {
    color: colors.textSecondary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  rejectedBlock: {
    backgroundColor: isDark ? 'rgba(229, 57, 53, 0.1)' : '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.3)',
  },
  rejectedTitle: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  rejectReason: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 8,
  },
  btnDispute: {
    backgroundColor: colors.danger,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  findBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  findBtnText: {
    color: '#FFFFFF',
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
  completedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
