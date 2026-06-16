import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Camera, CheckCircle, ChevronLeft, Clock, ExternalLink, Play, Store, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useCatalog, useCreateReport, useStartContract } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import AppIcon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';

export default function Setup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { data: catalog, isLoading, refetch: refetchCatalog } = useCatalog();
  const { mutate: startContract, isPending } = useStartContract();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [activeStep, setActiveStep] = useState(1);
  const [timer, setTimer] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [proofBase64, setProofBase64] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [modalView, setModalView] = useState<'default' | 'report' | 'success'>('default');
  const modalAnim = useRef(new Animated.Value(0)).current;

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchCatalog();
    } finally {
      setRefreshing(false);
    }
  };

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const displayToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setShowToast(false));
  };

  const { mutate: createReport, isPending: isReporting } = useCreateReport();

  const app = catalog?.find((a: any) => a.id === id);

  let signupBonus = 5;
  if (app?.tier === 'Pro') signupBonus = 10;
  if (app?.tier === 'Pro+') signupBonus = 20;

  const appState = useRef(AppState.currentState);
  const lastBackgroundTimeRef = useRef<number | null>(null);
  const launchCheckTimeoutRef = useRef<any>(null);
  const didLeaveApp = useRef(false);

  // Show/hide modal with animation
  const openFailModal = () => {
    setShowFailModal(true);
    Animated.spring(modalAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 10 }).start();
  };
  const closeFailModal = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowFailModal(false);
      setModalView('default');
    });
  };

  useEffect(() => {
    if (timer <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
      handleStepComplete(3);
    }
  }, [timer, isTimerRunning]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Track if user actually left the app (for launch detection)
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        didLeaveApp.current = true;
        if (isTimerRunning && timer > 0) {
          lastBackgroundTimeRef.current = Date.now();
        }
      } else if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isTimerRunning && timer > 0 && lastBackgroundTimeRef.current) {
          const elapsed = Math.floor((Date.now() - lastBackgroundTimeRef.current) / 1000);
          setTimer(prev => Math.max(0, prev - elapsed));
          lastBackgroundTimeRef.current = null;
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isTimerRunning, timer]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!app) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>APP NOT FOUND</Text>
      </View>
    );
  }

  const handleStepComplete = (step: number) => {
    setActiveStep(step + 1);
  };

  const handleOpenPlayStore = () => {
    if (app.internal_test_url) {
      Linking.openURL(app.internal_test_url).catch(() => showAlert('Error', 'Could not open url'));
    }
    handleStepComplete(1);
  };

  const handleLaunchApp = () => {
    if (!app?.package_name) return;
    const pkg = app.package_name;

    // Reset launch detection
    didLeaveApp.current = false;
    if (launchCheckTimeoutRef.current) clearTimeout(launchCheckTimeoutRef.current);

    try {
      IntentLauncher.openApplication(pkg);
      setIsTimerRunning(true);

      // After 3 seconds, check if the user actually left the app
      launchCheckTimeoutRef.current = setTimeout(() => {
        if (!didLeaveApp.current) {
          // User never left — the app didn't actually launch
          setIsTimerRunning(false);
          setTimer(60);
          openFailModal();
        }
      }, 3000);
    } catch (e) {
      console.log('Launch failed', e);
      // App couldn't be found at all — show fail modal immediately
      openFailModal();
    }
  };

  const handleFailModalJoinGroup = () => {
    closeFailModal();
    Linking.openURL('https://groups.google.com/u/2/g/test4test-community');
    setActiveStep(1);
    setTimer(60);
  };

  const handleReport = (reason: string) => {
    if (!session?.user?.id || !app?.id) return;
    createReport({
      app_id: app.id,
      reporter_id: session.user.id,
      type: 'Launch Issue',
      title: reason,
    }, {
      onSuccess: () => {
        setModalView('success');
      },
      onError: (err: any) => {
        showAlert('Report Failed', err.message);
      }
    });
  };

  const handleCheckIn = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setProofUrl(result.assets[0].uri);
      setProofBase64(result.assets[0].base64);
      handleStepComplete(4);
    }
  };

  const handleClaimReward = async () => {
    if (isPending || isUploading) return;
    if (!proofUrl) {
      showAlert("Missing Proof", "Please upload proof of testing in step 4.");
      return;
    }

    setIsUploading(true);
    let finalProofUrl = proofUrl;

    if (proofBase64) {
      try {
        const ext = proofUrl.split('.').pop()?.toLowerCase() || 'jpeg';
        const filename = `${session?.user?.id}_setup_${Date.now()}.${ext}`;
        const filePath = `proofs/${filename}`;

        const { error } = await supabase.storage
          .from('public-assets')
          .upload(filePath, decode(proofBase64), {
            contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        finalProofUrl = publicUrl;
      } catch (err: any) {
        setIsUploading(false);
        displayToast(err.message || 'Upload Failed', 'error');
        return;
      }
    }

    startContract({ appId: app.id, testerId: session?.user?.id as string, proofUrl: finalProofUrl }, {
      onSuccess: () => {
        setIsUploading(false);
        router.replace('/(tabs)/dashboard');
      },
      onError: (err: any) => {
        setIsUploading(false);
        showAlert('Failed to start test contract', err.message);
      }
    });
  };

  const modalScale = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Header Card */}
        <View style={styles.heroCard}>
          <AppIcon url={app.icon_url} size={48} style={styles.heroIconPlaceholder} />
          <View>
            <Text style={styles.appName}>{app.name}</Text>
            <Text style={styles.appSub}>Day 1 setup · Earn Karma daily</Text>
          </View>
        </View>

        {/* Step 1: Open Play Store */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.iconBox, activeStep === 1 ? styles.iconBoxActive : null]}>
              {activeStep > 1 ? <CheckCircle size={18} color={colors.success} /> : <Store size={18} color={colors.textSecondary} />}
            </View>
            <View style={styles.stepTitleCol}>
              <Text style={styles.stepTitle}>Open Play Store</Text>
              <Text style={styles.stepDesc}>Join the internal test and install the assigned build.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, activeStep === 1 ? styles.btnActive : styles.btnDisabled]}
            disabled={activeStep !== 1}
            onPress={handleOpenPlayStore}
          >
            <Text style={[styles.btnText, activeStep === 1 ? styles.btnTextActive : styles.btnTextDisabled]}>
              {activeStep > 1 ? "Completed" : "Open Play Store"}
            </Text>
            {activeStep === 1 && <ExternalLink size={14} color={colors.background} style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        </View>

        {/* Step 2: Confirm install */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.iconBox, activeStep === 2 ? styles.iconBoxActive : null]}>
              {activeStep > 2 ? <CheckCircle size={18} color={colors.success} /> : <CheckCircle size={18} color={colors.textSecondary} />}
            </View>
            <View style={styles.stepTitleCol}>
              <Text style={styles.stepTitle}>Confirm install</Text>
              <Text style={styles.stepDesc}>Continue after the app has finished downloading on your Android device.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, activeStep === 2 ? styles.btnActive : styles.btnDisabled]}
            disabled={activeStep !== 2}
            onPress={() => handleStepComplete(2)}
          >
            <Text style={[styles.btnText, activeStep === 2 ? styles.btnTextActive : styles.btnTextDisabled]}>
              {activeStep > 2 ? "Completed" : "I installed the app"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Step 3: Launch and use */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.iconBox, activeStep === 3 ? styles.iconBoxActive : null]}>
              {activeStep > 3 ? <CheckCircle size={18} color={colors.success} /> : <Play size={18} color={colors.textSecondary} />}
            </View>
            <View style={styles.stepTitleCol}>
              <Text style={styles.stepTitle}>Launch and use for 1 minute</Text>
              <Text style={styles.stepDesc}>Keep the app in the foreground until the timer completes.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, activeStep === 3 ? styles.btnActive : styles.btnDisabled]}
            disabled={activeStep !== 3 || isTimerRunning}
            onPress={handleLaunchApp}
          >
            {isTimerRunning ? (
              <Text style={[styles.btnText, styles.btnTextActive]}>Using app... {timer}s</Text>
            ) : (
              <Text style={[styles.btnText, activeStep === 3 ? styles.btnTextActive : styles.btnTextDisabled]}>
                {activeStep > 3 ? "Completed" : "Launch app"}
              </Text>
            )}
          </TouchableOpacity>
          {isTimerRunning && (
            <TouchableOpacity onPress={openFailModal} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '600' }}>Didn't launch?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step 4: Check in */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.iconBox, activeStep === 4 ? styles.iconBoxActive : null]}>
              {activeStep > 4 ? <CheckCircle size={18} color={colors.success} /> : <Camera size={18} color={colors.textSecondary} />}
            </View>
            <View style={styles.stepTitleCol}>
              <Text style={styles.stepTitle}>Check in</Text>
              <Text style={styles.stepDesc}>Submit the verified session check-in for today.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, activeStep === 4 ? styles.btnActive : styles.btnDisabled]}
            disabled={activeStep !== 4 || isUploading}
            onPress={handleCheckIn}
          >
            {isUploading ? (
              <ActivityIndicator color={colors.background} />
            ) : proofUrl ? (
              <Text style={[styles.btnText, styles.btnTextActive]}>Proof Uploaded</Text>
            ) : (
              <Text style={[styles.btnText, activeStep === 4 ? styles.btnTextActive : styles.btnTextDisabled]}>
                {activeStep > 4 ? "Completed" : "Check in now"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 5: Claim reward */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={[styles.iconBox, activeStep === 5 ? styles.iconBoxActive : null]}>
              <Clock size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.stepTitleCol}>
              <Text style={styles.stepTitle}>Claim {signupBonus} Tokens</Text>
              <Text style={styles.stepDesc}>Receive your setup reward and start testing.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, activeStep === 5 ? styles.btnActive : styles.btnDisabled]}
            disabled={activeStep < 5 || isPending}
            onPress={handleClaimReward}
          >
            {isPending ? (
              <ActivityIndicator color={activeStep === 5 ? colors.background : colors.text} />
            ) : (
              <Text style={[styles.btnText, activeStep === 5 ? styles.btnTextActive : styles.btnTextDisabled]}>Claim {signupBonus} Tokens</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Custom "Didn't Launch" Modal ── */}
      <Modal visible={showFailModal} transparent animationType="none" onRequestClose={closeFailModal}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { opacity: modalAnim, transform: [{ scale: modalScale }] }]}>
            {/* Close button */}
            <TouchableOpacity style={styles.modalClose} onPress={closeFailModal}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {modalView === 'default' ? (
              <>
                {/* Icon */}
                <View style={[styles.modalIconCircle, { backgroundColor: isDark ? '#3D3100' : '#FFF3E0' }]}>
                  <AlertTriangle size={32} color={colors.warning} />
                </View>

                {/* Title & description */}
                <Text style={styles.modalTitle}>App didn't launch?</Text>
                <Text style={styles.modalDesc}>
                  This can happen if the app isn't installed yet or if you haven't joined the testing group. Try the steps below:
                </Text>

                {/* Checklist */}
                <View style={styles.modalChecklist}>
                  <View style={styles.modalCheckItem}>
                    <View style={styles.modalCheckDot} />
                    <Text style={styles.modalCheckText}>Make sure you've joined the Google Group</Text>
                  </View>
                  <View style={styles.modalCheckItem}>
                    <View style={styles.modalCheckDot} />
                    <Text style={styles.modalCheckText}>Accept the Play Store test invitation</Text>
                  </View>
                  <View style={styles.modalCheckItem}>
                    <View style={styles.modalCheckDot} />
                    <Text style={styles.modalCheckText}>Install and open the app at least once</Text>
                  </View>
                </View>

                {/* Buttons */}
                <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleFailModalJoinGroup}>
                  <ExternalLink size={16} color={colors.background} style={{ marginRight: 8 }} />
                  <Text style={styles.modalBtnPrimaryText}>Join Google Group & Restart</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setModalView('report')}>
                  <Text style={styles.modalBtnSecondaryText}>Report App</Text>
                </TouchableOpacity>
              </>
            ) : modalView === 'report' ? (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: isDark ? '#3C1818' : '#FEE2E2' }]}>
                  <AlertTriangle size={32} color={colors.danger} />
                </View>

                <Text style={styles.modalTitle}>Report App</Text>
                <Text style={styles.modalDesc}>
                  Please select the reason why you are reporting this app. This helps us keep the platform clean.
                </Text>

                <View style={{ width: '100%', marginBottom: 12 }}>
                  {["Broken link", "Can't open", "Isn't available", "Other"].map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reportOptionBtn}
                      disabled={isReporting}
                      onPress={() => handleReport(reason)}
                    >
                      <Text style={styles.reportOptionText}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isReporting && <ActivityIndicator color={colors.text} style={{ marginBottom: 12 }} />}

                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setModalView('default')} disabled={isReporting}>
                  <Text style={styles.modalBtnSecondaryText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.modalIconCircle, { backgroundColor: isDark ? '#1C3322' : '#DCFCE7' }]}>
                  <CheckCircle size={32} color={colors.success} />
                </View>

                <Text style={styles.modalTitle}>Report Submitted</Text>
                <Text style={styles.modalDesc}>
                  Thank you for letting us know. We will review this app to ensure the platform remains clean and fair.
                </Text>

                <TouchableOpacity style={styles.modalBtnPrimary} onPress={closeFailModal}>
                  <Text style={styles.modalBtnPrimaryText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Toast */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }, toastType === 'error' && styles.toastError]}>
          {toastType === 'success' ? (
            <CheckCircle size={16} color={colors.background} />
          ) : (
            <AlertTriangle size={16} color={colors.background} />
          )}
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
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
  errorText: {
    color: colors.danger,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 64,
  },
  content: {
    padding: 12,
    paddingBottom: 20,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  heroIconPlaceholder: {
    marginRight: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  appSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  stepCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBoxActive: {},
  stepTitleCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  btn: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: colors.text,
  },
  btnActiveLight: {
    backgroundColor: colors.textSecondary,
  },
  btnDisabled: {
    backgroundColor: colors.background,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  btnTextActive: {
    color: colors.background,
  },
  btnTextDisabled: {
    color: colors.placeholder,
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: isDark ? 0 : 20,
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: isDark ? '#3D3100' : '#FFF3E0',
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
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalChecklist: {
    alignSelf: 'stretch',
    marginBottom: 24,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
  },
  modalCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalCheckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
    marginRight: 12,
  },
  modalCheckText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  modalBtnPrimary: {
    flexDirection: 'row',
    backgroundColor: colors.text,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  modalBtnPrimaryText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.background,
  },
  modalBtnSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  reportOptionBtn: {
    backgroundColor: colors.background,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    alignItems: 'center',
  },
  reportOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: isDark ? 0 : 10,
    zIndex: 1000,
    gap: 8,
  },
  toastError: {
    backgroundColor: colors.danger,
  },
  toastText: {
    color: isDark ? '#000' : '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
