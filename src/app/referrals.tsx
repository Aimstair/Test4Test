import { useRouter } from 'expo-router';
import { ChevronLeft, UserPlus, Gift, CheckCircle } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { useUserProfile, useReferrals } from '../api/queries';
import { useTheme } from '../theme/ThemeContext';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import * as Clipboard from 'expo-clipboard';
import { useCustomAlert } from '../components/AlertProvider';

export default function Referrals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: userProfile, isLoading: loadingProfile } = useUserProfile(session?.user?.id);
  const referralCode = userProfile?.referral_code || '';
  
  const { data: referralsData, isLoading: loadingReferrals } = useReferrals(referralCode);
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { showAlert } = useCustomAlert();

  const referrals = referralsData || [];
  const isLoading = loadingProfile || loadingReferrals;

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    showAlert('Copied!', 'Your referral code has been copied to your clipboard.');
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Me</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Referrals</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Referral Code Display */}
        <View style={styles.codeCard}>
          <Gift size={24} color={colors.primary} style={{ marginBottom: 12 }} />
          <Text style={styles.codeTitle}>Your Invite Code</Text>
          <Text style={styles.codeSubtitle}>Share this code with friends. You both get 50 tokens when they complete their first test.</Text>
          
          <TouchableOpacity style={styles.codeBox} onPress={handleCopyReferral}>
            <Text style={styles.codeText}>{referralCode || '...'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>PEOPLE YOU REFERRED ({referrals.length})</Text>

        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.referralCard}>
                <View style={styles.refLeft}>
                  <Skeleton width={40} height={40} borderRadius={20} />
                  <View style={{ marginLeft: 12 }}>
                    <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width={80} height={12} borderRadius={4} />
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : referrals.length === 0 ? (
          <EmptyState 
            icon={<UserPlus size={48} color={colors.placeholder} />}
            title="No referrals yet"
            description="Share your code to start earning tokens!"
            steps={[]}
          />
        ) : (
          referrals.map((ref: any) => (
            <View key={ref.id} style={styles.referralCard}>
              <View style={styles.refLeft}>
                {ref.avatar_url ? (
                  <Image source={{ uri: ref.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{ref.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                )}
                <View style={styles.refInfo}>
                  <Text style={styles.refName}>{ref.name || 'Anonymous User'}</Text>
                  <Text style={styles.refDate}>Joined {new Date(ref.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <View style={styles.refRight}>
                {ref.referral_rewarded ? (
                  <View style={styles.badgeSuccess}>
                    <CheckCircle size={12} color="#34C759" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeSuccessText}>Earned 50 T</Text>
                  </View>
                ) : (
                  <View style={styles.badgePending}>
                    <Text style={styles.badgePendingText}>Pending</Text>
                  </View>
                )}
              </View>
            </View>
          ))
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    padding: 16,
  },
  codeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  codeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  refInfo: {
    marginLeft: 12,
  },
  refName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  refDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  refRight: {
    alignItems: 'flex-end',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34C759',
  },
  badgePending: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
