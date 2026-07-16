import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { X, Gift, CheckCircle, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../api/auth';
import { useEventProgress, useUserProfile, useClaimEventReward, useActiveEvent } from '../api/queries';
import { useCustomAlert } from './AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EventModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EventModal({ visible, onClose }: EventModalProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id;

  const { data: activeEvent, isLoading: loadingEvent } = useActiveEvent();
  const eventStartDate = activeEvent?.start_date;
  
  const { data: progressData, isLoading: loadingProgress } = useEventProgress(userId, eventStartDate);
  const { data: userProfile, isLoading: loadingProfile } = useUserProfile(userId);
  const { mutate: claimReward, isPending: claiming } = useClaimEventReward();

  const [slideAnim] = useState(new Animated.Value(Dimensions.get('window').height));
  const currentCount = progressData?.count || 0;
  
  const claimedList = Array.isArray(userProfile?.claimed_event_milestones) ? userProfile.claimed_event_milestones : [];

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  if (!activeEvent || !activeEvent.is_active) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
          <Animated.View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 24), transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.header, { paddingBottom: 40 }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.border, shadowOpacity: 0 }]}>
                <Gift size={32} color={colors.textSecondary} />
              </View>
              <Text style={styles.title}>No Active Events</Text>
              <Text style={styles.description}>Check back later for new giveaways and rewards!</Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  const milestones = Array.isArray(activeEvent.milestones) ? activeEvent.milestones : [];
  const maxTarget = milestones.length > 0 ? Math.max(...milestones.map((m: any) => m.targetCount)) : 0;
  const progressPercent = maxTarget > 0 ? Math.min(100, (currentCount / maxTarget) * 100) : 0;

  const handleClaim = (milestone: any) => {
    if (!userId) return;
    claimReward({
      userId,
      milestoneId: milestone.id,
      rewardType: milestone.rewardType,
      rewardAmount: milestone.rewardAmount,
      rewardTitle: milestone.rewardTitle,
      rewardTier: milestone.rewardTier
    }, {
      onSuccess: () => {
        showAlert('Reward Claimed! 🎉', `You received ${milestone.rewardTitle}!`);
      },
      onError: (err) => {
        showAlert('Error', err.message);
      }
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <Animated.View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 24), transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Gift size={32} color="#FFF" />
            </View>
            <Text style={styles.title}>{activeEvent.title}</Text>
            <Text style={styles.description}>{activeEvent.description}</Text>
          </View>
          
          {(loadingProgress || loadingProfile || loadingEvent) ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              
              <View style={styles.progressSection}>
                <View style={styles.progressTextRow}>
                  <Text style={styles.progressLabel}>Your Progress</Text>
                  <Text style={styles.progressValue}>{currentCount} / {maxTarget} Apps Tested</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>

              <View style={styles.milestonesList}>
                {milestones.map((milestone: any, index: number) => {
                  const isReached = currentCount >= milestone.targetCount;
                  const isClaimed = claimedList.includes(milestone.id);
                  
                  return (
                    <View key={milestone.id} style={[styles.milestoneCard, isClaimed && styles.milestoneClaimed]}>
                      <View style={styles.milestoneLeft}>
                        <View style={[styles.milestoneIndex, isReached && styles.milestoneIndexActive]}>
                          <Text style={[styles.milestoneIndexText, isReached && styles.milestoneIndexTextActive]}>{index + 1}</Text>
                        </View>
                        <View>
                          <Text style={styles.milestoneTarget}>Test {milestone.targetCount} App{milestone.targetCount > 1 ? 's' : ''}</Text>
                          <Text style={styles.milestoneRewardText}>Reward: {milestone.rewardTitle}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.milestoneRight}>
                        {isClaimed ? (
                          <View style={styles.claimedBadge}>
                            <CheckCircle size={16} color="#34C759" />
                            <Text style={styles.claimedText}>Claimed</Text>
                          </View>
                        ) : isReached ? (
                          <TouchableOpacity 
                            style={styles.claimBtn}
                            onPress={() => handleClaim(milestone)}
                            disabled={claiming}
                          >
                            <Text style={styles.claimBtnText}>Claim</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.lockedBadge}>
                            <Text style={styles.lockedText}>Locked</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill as object,
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
    paddingTop: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    padding: 24,
    paddingTop: 8,
  },
  progressSection: {
    marginBottom: 32,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF9500',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF9500',
    borderRadius: 6,
  },
  milestonesList: {
    gap: 16,
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneClaimed: {
    borderColor: '#34C759',
    backgroundColor: isDark ? 'rgba(52, 199, 89, 0.05)' : 'rgba(52, 199, 89, 0.05)',
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  milestoneIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIndexActive: {
    backgroundColor: '#FF9500',
  },
  milestoneIndexText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  milestoneIndexTextActive: {
    color: '#FFF',
  },
  milestoneTarget: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  milestoneRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  milestoneRight: {
    alignItems: 'flex-end',
  },
  claimBtn: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  claimBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  claimedText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedBadge: {
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  lockedText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
