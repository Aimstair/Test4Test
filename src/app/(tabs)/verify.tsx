import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Check, ChevronLeft, ChevronRight, Flag, Flame, Image as ImageIcon, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Animated, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useApprovedProofsCount, useProofQueue, useReviewProof, useUpdateAutoApprove, useUserProfile } from '../../api/queries';
import AppHeader from '../../components/AppHeader';
import EmptyState from '../../components/EmptyState';
import EventFloatingIcon from '../../components/EventFloatingIcon';
import EventModal from '../../components/EventModal';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';

export default function Verify() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { session } = useAuth();
  const { data: userProfile, refetch: refetchProfile } = useUserProfile(session?.user?.id);
  const { data: proofQueueData, isLoading, refetch: refetchQueue } = useProofQueue(session?.user?.id);
  const { data: approvedCountData, refetch: refetchApproved } = useApprovedProofsCount(session?.user?.id);
  const { mutate: reviewProof } = useReviewProof();
  const { mutate: updateAutoApprove } = useUpdateAutoApprove();

  const proofQueue = proofQueueData || [];

  // Carousel State
  const appsList = Array.from(new Set(proofQueue.map((p: any) => p.contract?.app?.name))).filter(Boolean) as string[];
  const carouselItems = ["All Listings", ...appsList];
  const [currentAppIndex, setCurrentAppIndex] = useState(0);
  const [showEventModal, setShowEventModal] = useState(false);

  const selectedApp = carouselItems[currentAppIndex] || "All Listings";
  const displayedQueue = selectedApp === "All Listings"
    ? proofQueue
    : proofQueue.filter((p: any) => p.contract?.app?.name === selectedApp);

  const handleNextApp = () => setCurrentAppIndex((prev) => (prev + 1) % carouselItems.length);
  const handlePrevApp = () => setCurrentAppIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);

  // Toast State
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
      Animated.delay(2500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setShowToast(false));
  };

  const checkAndPromptReview = async () => {
    try {
      const lastPrompt = await AsyncStorage.getItem('last_review_prompt_date');
      const today = new Date().toDateString();
      console.log('[StoreReview] lastPrompt:', lastPrompt, 'today:', today);
      if (lastPrompt !== today) {
        const canReview = await StoreReview.hasAction();
        console.log('[StoreReview] hasAction:', canReview);
        if (canReview) {
          await StoreReview.requestReview();
          await AsyncStorage.setItem('last_review_prompt_date', today);
          console.log('[StoreReview] requestReview called successfully');
        } else {
          console.log('[StoreReview] hasAction returned false — API not available');
        }
      } else {
        console.log('[StoreReview] Already prompted today, skipping');
      }
    } catch (e) {
      console.log('[StoreReview] error:', e);
    }
  };

  const handleReview = (id: string, status: 'approved' | 'rejected', reason?: string) => {
    reviewProof({ id, status, developerId: session?.user?.id, reason }, {
      onSuccess: () => {
        if (status === 'approved') {
          displayToast('+0.5 Karma earned! ⭐ Proof approved.', 'success');
          checkAndPromptReview();
        } else {
          displayToast(`Proof rejected${reason ? ` (${reason})` : ''}`, 'success');
        }
      },
      onError: (err: any) => {
        displayToast(`Failed to ${status} proof: ${err.message}`, 'error');
      }
    });
  };

  const autoApproveEnabled = userProfile?.auto_approve_enabled || false;
  const isProOrAbove = userProfile?.subscription_tier === 'Pro' || userProfile?.subscription_tier === 'Pro+' || userProfile?.tier === 'pro' || userProfile?.tier === 'pro_plus';

  const toggleAutoApprove = () => {
    if (!isProOrAbove) return;
    const newState = !autoApproveEnabled;
    updateAutoApprove({ userId: session?.user?.id as string, autoApproveEnabled: newState }, {
      onSuccess: () => {
        if (newState) {
          displayToast('Auto-Approve enabled. Proofs will be approved at 23:55 UTC.', 'success');
        } else {
          displayToast('Auto-Approve disabled.', 'success');
        }
      },
      onError: (err: any) => {
        displayToast(`Failed to update setting: ${err.message}`, 'error');
      }
    });
  };

  // Flag Modal State
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);

  // Full Image Modal State
  const [fullImageModalVisible, setFullImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const flagReasons = [
    "Blurry image",
    "Wrong application",
    "Incorrect day progression",
    "Inappropriate content"
  ];

  const handleFlagPress = (id: string) => {
    setSelectedProofId(id);
    setFlagModalVisible(true);
  };

  const handleFlagSubmit = (reason: string) => {
    if (selectedProofId) {
      handleReview(selectedProofId, 'rejected', reason);
      setFlagModalVisible(false);
      setFlagModalVisible(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchQueue(), refetchApproved()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <View style={styles.appSelectorCard}>
            <View style={styles.selectorHeader}>
              <Skeleton width={24} height={24} borderRadius={12} />
              <View style={{ alignItems: 'center' }}>
                <Skeleton width={100} height={16} borderRadius={4} style={{ marginBottom: 4 }} />
                <Skeleton width={60} height={12} borderRadius={4} />
              </View>
              <Skeleton width={24} height={24} borderRadius={12} />
            </View>
            <View style={styles.selectorStats}>
              <Skeleton flex={1} height={40} borderRadius={8} style={{ marginHorizontal: 4 }} />
              <Skeleton flex={1} height={40} borderRadius={8} style={{ marginHorizontal: 4 }} />
            </View>
          </View>
          <View style={{ marginTop: 24 }}>
            {[1, 2].map(i => (
              <View key={i} style={styles.proofCard}>
                <View style={styles.proofHeader}>
                  <Skeleton width={100} height={16} borderRadius={4} />
                  <Skeleton width={80} height={20} borderRadius={10} />
                </View>
                <Skeleton width="100%" height={200} borderRadius={12} style={{ marginTop: 12 }} />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        <View style={styles.appSelectorCard}>
          <View style={styles.selectorHeader}>
            <TouchableOpacity onPress={handlePrevApp} style={styles.carouselBtn}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.selectorApp}>{selectedApp}</Text>
              <Text style={styles.selectorAppSub}>Overview</Text>
            </View>
            <TouchableOpacity onPress={handleNextApp} style={styles.carouselBtn}>
              <ChevronRight size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.selectorStats}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{displayedQueue.length}</Text>
              <Text style={styles.statLabel}>PENDING</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{approvedCountData || 0}</Text>
              <Text style={styles.statLabel}>APPROVED</Text>
            </View>
          </View>

          {isProOrAbove ? (
            <TouchableOpacity
              style={[styles.btnBlack, !autoApproveEnabled && { backgroundColor: colors.border }]}
              onPress={toggleAutoApprove}
              activeOpacity={0.8}
            >
              <Text style={autoApproveEnabled ? styles.btnTextWhite : styles.btnTextDisabled}>
                AUTO-APPROVE BY END OF DAY: {autoApproveEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.btnBlack, styles.btnDisabled]}>
              <Text style={styles.btnTextDisabled}>AUTO-APPROVE (PRO ONLY)</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>PROOF QUEUE</Text>

        {displayedQueue.length === 0 && (
          <EmptyState
            icon={<Check size={48} color="#A0A0AB" strokeWidth={1.5} />}
            title="All Caught Up"
            description="You have no pending proofs to verify right now."
            steps={[
              { title: "Wait for testers", description: "Testers will upload their daily screenshots" },
              { title: "Review daily", description: "Check back here to review uploaded screenshots" },
              { title: "Approve or Reject", description: "Maintain quality by managing your testers' proofs" }
            ]}
          />
        )}

        {displayedQueue.map((proof: any) => (
          <View key={proof.id} style={styles.proofCard}>
            <View style={styles.proofHeader}>
              {proof.contract?.tester?.avatar_url ? (
                <Image source={{ uri: proof.contract?.tester?.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{proof.contract?.tester?.name?.[0] || '?'}</Text>
                </View>
              )}
              <View style={styles.proofHeaderInfo}>
                <Text style={styles.testerName}>{proof.contract?.tester?.name || 'Tester'}</Text>
                <Text style={styles.appName}>{proof.contract?.app?.name || 'App'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.imagePlaceholder}
              activeOpacity={0.8}
              onPress={() => {
                if (proof.proof_image_url) {
                  setSelectedImageUrl(proof.proof_image_url);
                  setFullImageModalVisible(true);
                }
              }}
            >
              {proof.proof_image_url ? (
                <Image source={{ uri: proof.proof_image_url }} style={styles.proofImage} />
              ) : (
                <>
                  <ImageIcon size={24} color={colors.textSecondary} />
                  <Text style={styles.placeholderText}>NO IMAGE</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.exifRow}>
              <View style={styles.exifPill}>
                <Text style={styles.exifLabel}>DAY</Text>
                <Text style={styles.exifValue}>{proof.day_number}/{proof.contract?.contract_days?.length || 14}</Text>
              </View>
              <View style={styles.exifPill}>
                <Text style={styles.exifLabel}>TIME</Text>
                <Text style={styles.exifValue}>{new Date(proof.created_at).toLocaleTimeString()}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnReject]}
                onPress={() => handleReview(proof.id, 'rejected')}
              >
                <X size={20} color={colors.danger} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.btnFlag]}
                onPress={() => handleFlagPress(proof.id)}
              >
                <Flag size={20} color={colors.warning} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.btnApprove]}
                onPress={() => handleReview(proof.id, 'approved')}
              >
                <Check size={20} color={colors.background} />
                <Text style={styles.btnApproveText}>APPROVE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                  <Flame size={18} color="#ef4444" />
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>+0.5</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Modal
          visible={flagModalVisible}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Flag Proof</Text>
              <Text style={styles.modalSub}>Select a reason for rejecting this proof:</Text>
              {flagReasons.map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={styles.flagReasonBtn}
                  onPress={() => handleFlagSubmit(reason)}
                >
                  <Text style={styles.flagReasonText}>{reason}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.cancelFlagBtn}
                onPress={() => setFlagModalVisible(false)}
              >
                <Text style={styles.cancelFlagText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Full Image Modal */}
        <Modal
          visible={fullImageModalVisible}
          transparent
          animationType="fade"
        >
          <View style={styles.fullImageOverlay}>
            <TouchableOpacity
              style={styles.closeFullImageBtn}
              onPress={() => setFullImageModalVisible(false)}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
            {selectedImageUrl && (
              <Image
                source={{ uri: selectedImageUrl }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </ScrollView>

      {/* Toast */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }, toastType === 'error' && styles.toastError]}>
          {toastType === 'success' ? (
            <Check size={16} color="#fff" />
          ) : (
            <X size={16} color="#fff" />
          )}
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

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
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: -1,
  },
  appSelectorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  carouselBtn: {
    padding: 8,
  },
  selectorApp: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  selectorAppSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectorStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  btnBlack: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
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
  proofCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  proofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  flagReasonBtn: {
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  flagReasonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  cancelFlagBtn: {
    marginTop: 16,
    paddingVertical: 12,
  },
  cancelFlagText: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: colors.cardShadow,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 4,
  },
  toastError: {
    backgroundColor: colors.danger,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  proofHeaderInfo: {
    flex: 1,
  },
  testerName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  appName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  imagePlaceholder: {
    height: 200,
    backgroundColor: colors.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  proofImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 8,
    letterSpacing: 1,
  },
  exifRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  exifPill: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  exifLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  exifValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnReject: {
    width: 56,
  },
  btnFlag: {
    width: 56,
  },
  btnApprove: {
    flex: 1,
    backgroundColor: colors.primary,
    borderColor: colors.text,
    flexDirection: 'row',
    gap: 8,
  },
  btnApproveText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    flexDirection: 'row',
    gap: 8,
  },
  btnDisabled: {
    backgroundColor: colors.border,
  },
  btnTextDisabled: {
    color: colors.textSecondary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
