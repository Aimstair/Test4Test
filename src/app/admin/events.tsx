import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Save, Gift, CheckCircle, Clock, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useActiveEvent, useUpdateActiveEvent, useEventClaims } from '../../api/queries';

export default function AdminEvents() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { data: activeEvent, isLoading: loadingEvent } = useActiveEvent();
  const { data: claims, isLoading: loadingClaims } = useEventClaims();
  const { mutate: updateEvent, isPending: isUpdating } = useUpdateActiveEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [milestones, setMilestones] = useState<any[]>([]);

  // Initialize state once data loads
  React.useEffect(() => {
    if (activeEvent) {
      setTitle(activeEvent.title || '');
      setDescription(activeEvent.description || '');
      setIsActive(activeEvent.is_active ?? true);
      setStartDate(activeEvent.start_date || '');
      setEndDate(activeEvent.end_date || '');
      let parsed = activeEvent.milestones;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch(e) { parsed = []; }
      }
      setMilestones(Array.isArray(parsed) ? parsed : []);
    }
  }, [activeEvent]);

  const addMilestone = () => {
    setMilestones([...milestones, { 
      id: Date.now().toString(), 
      targetCount: 1, 
      rewardType: 'Tokens', 
      rewardAmount: 10,
      rewardTitle: '10 Tokens'
    }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: string, value: any) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    setMilestones(newMilestones);
  };

  const handleSave = () => {
    for (let m of milestones) {
      if (!m.targetCount || !m.rewardTitle || !m.rewardAmount) {
        Alert.alert("Invalid Milestone", "Please fill in all milestone fields.");
        return;
      }
    }

    updateEvent({ 
      title, 
      description, 
      is_active: isActive,
      start_date: startDate || null,
      end_date: endDate || null,
      milestones: milestones
    }, {
      onSuccess: () => {
        Alert.alert("Success", "Event settings updated successfully!");
      },
      onError: (err) => {
        Alert.alert("Error", err.message);
      }
    });
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Admin Panel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.saveBtn, isUpdating && { opacity: 0.5 }]} 
          onPress={handleSave}
          disabled={isUpdating}
        >
          {isUpdating ? <ActivityIndicator size="small" color="#FFF" /> : <Save size={20} color="#FFF" />}
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        
        {loadingEvent ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Gift size={24} color="#FF2D55" />
              <Text style={styles.cardTitle}>Global Event Configuration</Text>
            </View>
            
            <Text style={styles.label}>Event Status</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity 
                style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
                onPress={() => setIsActive(true)}
              >
                <Text style={[styles.toggleText, isActive && styles.toggleTextActive]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleBtn, !isActive && styles.toggleBtnInactive]}
                onPress={() => setIsActive(false)}
              >
                <Text style={[styles.toggleText, !isActive && styles.toggleTextActive]}>Inactive</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Event Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Summer Tester Marathon"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Test apps and earn massive rewards!"
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
            
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD HH:MM:SS"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD HH:MM:SS"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.milestonesHeaderRow}>
              <Text style={styles.label}>Milestones</Text>
              <TouchableOpacity onPress={addMilestone}>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {(Array.isArray(milestones) ? milestones : []).map((milestone, index) => (
              <View key={milestone.id} style={styles.milestoneConfigCard}>
                <View style={styles.milestoneConfigHeader}>
                  <Text style={styles.milestoneConfigTitle}>Milestone {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeMilestone(index)}>
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.milestoneRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.subLabel}>Target Apps</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={milestone.targetCount?.toString() || ''}
                      onChangeText={(val) => updateMilestone(index, 'targetCount', parseInt(val) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>{milestone.rewardType === 'membership' ? 'Days Amount' : 'Reward Amount'}</Text>
                    <TextInput
                      style={styles.inputSmall}
                      value={milestone.rewardAmount?.toString() || ''}
                      onChangeText={(val) => updateMilestone(index, 'rewardAmount', parseInt(val) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.subLabel}>Reward Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: milestone.rewardType === 'membership' ? 8 : 12 }}>
                  <TouchableOpacity 
                    style={[styles.typePill, (!milestone.rewardType || milestone.rewardType === 'tokens') && styles.typePillActive]}
                    onPress={() => updateMilestone(index, 'rewardType', 'tokens')}
                  >
                    <Text style={[styles.typePillText, (!milestone.rewardType || milestone.rewardType === 'tokens') && styles.typePillTextActive]}>Tokens</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typePill, milestone.rewardType === 'membership' && styles.typePillActive]}
                    onPress={() => updateMilestone(index, 'rewardType', 'membership')}
                  >
                    <Text style={[styles.typePillText, milestone.rewardType === 'membership' && styles.typePillTextActive]}>Membership</Text>
                  </TouchableOpacity>
                </View>

                {milestone.rewardType === 'membership' && (
                  <>
                    <Text style={styles.subLabel}>Membership Tier</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <TouchableOpacity 
                        style={[styles.typePill, (!milestone.rewardTier || milestone.rewardTier === 'Pro') && styles.typePillActive]}
                        onPress={() => updateMilestone(index, 'rewardTier', 'Pro')}
                      >
                        <Text style={[styles.typePillText, (!milestone.rewardTier || milestone.rewardTier === 'Pro') && styles.typePillTextActive]}>Pro</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.typePill, milestone.rewardTier === 'Pro+' && styles.typePillActive]}
                        onPress={() => updateMilestone(index, 'rewardTier', 'Pro+')}
                      >
                        <Text style={[styles.typePillText, milestone.rewardTier === 'Pro+' && styles.typePillTextActive]}>Pro+</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <Text style={styles.subLabel}>Reward Title</Text>
                <TextInput
                  style={styles.inputSmall}
                  value={milestone.rewardTitle}
                  onChangeText={(val) => updateMilestone(index, 'rewardTitle', val)}
                  placeholder="e.g. 50 Tokens & 10 Karma"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>CLAIM LOGS</Text>
        
        {loadingClaims ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : claims && claims.length > 0 ? (
          <View style={styles.logsContainer}>
            {claims.map((claim: any) => (
              <View key={claim.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logUser}>{claim.users?.name || 'Unknown User'}</Text>
                  <Text style={styles.logTime}>{formatDate(claim.created_at)}</Text>
                </View>
                <View style={styles.logBody}>
                  <View style={styles.badgeSuccess}>
                    <CheckCircle size={14} color="#34C759" />
                    <Text style={styles.badgeSuccessText}>{claim.reward_title}</Text>
                  </View>
                  <Text style={styles.logMilestoneId}>ID: {claim.milestone_id}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Clock size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No claims have been recorded yet.</Text>
          </View>
        )}
        
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
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
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  saveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  inputMultiline: {
    height: 100,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: '#34C759',
  },
  toggleBtnInactive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: '#FF3B30',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.text,
  },
  infoBox: {
    backgroundColor: isDark ? '#1C2B36' : '#E1F0FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 8,
  },
  logsContainer: {
    gap: 12,
  },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logUser: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  logTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  logBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccessText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '700',
  },
  logMilestoneId: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  milestonesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  addText: {
    color: colors.primary,
    fontWeight: '800',
  },
  milestoneConfigCard: {
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  milestoneConfigTitle: {
    fontWeight: '800',
    color: colors.text,
  },
  milestoneRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputSmall: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  typePillActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: '#34C759',
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  typePillTextActive: {
    color: '#34C759',
  },
});
