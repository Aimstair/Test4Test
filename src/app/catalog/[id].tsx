import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ChevronLeft, Clock, Coins, Flame, Globe, Send, Smartphone, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useCatalog, useContracts, useCreateReview, useReports, useReviews, useUserProfile } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import AppIcon from '../../components/AppIcon';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

export default function AppDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { data: catalog, isLoading, refetch: refetchCatalog } = useCatalog();
  const { data: reviews, refetch: refetchReviews } = useReviews(id as string);
  const { data: reports, refetch: refetchReports } = useReports(id as string);
  const { mutate: createReview, isPending: submittingReview } = useCreateReview();
  const { data: userContracts } = useContracts(session?.user?.id);
  const { data: userProfile } = useUserProfile(session?.user?.id);
  const { showAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchCatalog(), refetchReviews(), refetchReports()]);
    } finally {
      setRefreshing(false);
    }
  };

  const app = catalog?.find((a: any) => a.id === id);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
            <Text style={styles.backText}>Catalog</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.appCard}>
            <View style={styles.appHeaderRow}>
              <View style={styles.appIconPlaceholder}>
                <Skeleton width={64} height={64} borderRadius={16} />
              </View>
              <View style={styles.appTitleCol}>
                <Skeleton width={150} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
                <Skeleton width={100} height={14} borderRadius={4} style={{ marginBottom: 12 }} />
                <Skeleton width={200} height={20} borderRadius={4} />
              </View>
            </View>
          </View>
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Skeleton width="100%" height={120} borderRadius={12} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={80} borderRadius={12} />
          </View>
        </ScrollView>
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

  const activeTesters = new Set(app.contracts?.filter((c: any) => c.status === 'active').map((c: any) => c.tester_id)).size || 0;
  const capacityPercent = Math.min(100, Math.round((activeTesters / (app.tester_limit || 10)) * 100));

  const reportCounts = reports?.reduce((acc: Record<string, number>, curr: any) => {
    acc[curr.title] = (acc[curr.title] || 0) + 1;
    return acc;
  }, {});

  const handleStartContract = () => {
    router.push(`/setup/${app.id}` as any);
  };

  // Check if user is a tester of this app
  const isTester = userContracts?.some((c: any) => c.app_id === id) || false;
  const hasReviewed = reviews?.some((r: any) => r.reviewer_id === session?.user?.id) || false;

  const isOwner = app.owner_id === session?.user?.id;
  // Scope to current listing_id so testers can re-join a re-listed app
  const existingContract = userContracts?.find(
    (c: any) => c.listing_id === app.listing_id && c.status !== 'rejected' && c.status !== 'failed'
  );

  const handlePostReview = () => {
    if (!content.trim()) return;
    createReview({
      app_id: id as string,
      reviewer_id: session?.user?.id as string,
      rating,
      content: content.trim(),
    }, {
      onSuccess: () => {
        setContent('');
        setRating(5);
        showAlert('+5 Tokens Earned! 🪙', 'Thank you for your review! You earned +5 Tokens.');
      },
      onError: (err: any) => {
        showAlert('Review Error', err.message);
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Catalog</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.appCard}>
          <View style={styles.appHeaderRow}>
            <View style={styles.appIconPlaceholder}>
              <AppIcon url={app.icon_url} size={64} />
            </View>
            <View style={styles.appTitleCol}>
              <Text style={styles.appName} numberOfLines={2} ellipsizeMode="tail">{app.name}</Text>
              <Text style={styles.appOwner} numberOfLines={1} ellipsizeMode="tail">by {app.owner?.name || 'Developer'}</Text>
              <View style={styles.tagsRow}>
                {/* <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Coins size={16} color="#eab308" />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                      +{app.boost_ends_at && new Date(app.boost_ends_at) > new Date() ? app.bounty + 10 : app.bounty}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Flame size={16} color="#ef4444" />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>+1</Text>
                  </View>
                </View> */}
                {app.boost_ends_at && new Date(app.boost_ends_at) > new Date() && (
                  <View style={{ backgroundColor: 'rgba(255, 149, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 0 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#FF9500' }}>🔥 PROMOTED</Text>
                  </View>
                )}
                {app.app_type === 'Production' && (
                  <View style={{ backgroundColor: 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 0 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34C759' }}>⭐ PRODUCTION</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.blurbText}>
            {app.blurb && app.blurb.length > 50 ? app.blurb.substring(0, 50) + '...' : app.blurb}
          </Text>
        </View>

        {reports && reports.length > 0 && (
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={16} color={colors.danger} />
              <Text style={styles.warningTitle}>SAFETY WARNING</Text>
            </View>
            <Text style={styles.warningDesc}>This app has received {reports.length} report{reports.length > 1 ? 's' : ''} from testers.</Text>
            {Object.entries(reportCounts || {}).map(([title, count]) => (
              <View key={title} style={styles.warningItem}>
                <View style={styles.warningDot} />
                <Text style={styles.warningItemText}>
                  {title} <Text style={{ fontWeight: '800' }}>({String(count)})</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>CAPACITY</Text>
        <View style={styles.card}>
          <View style={styles.capacityHeader}>
            <Text style={styles.capacityValue}>{activeTesters}<Text style={styles.capacityTotal}>/{app.tester_limit || 10}</Text></Text>
            <Text style={styles.capacityLabel}>TESTERS LOCKED</Text>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${capacityPercent}%` }]} />
          </View>

          <View style={styles.capacityFooter}>
            <Text style={styles.capacitySubText}>{activeTesters} active right now</Text>
            <Text style={styles.capacitySubText}>{capacityPercent}% full</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>REQUIREMENTS</Text>
        <View style={[styles.card, { padding: 0 }]}>
          <View style={styles.reqItem}>
            <Globe size={20} color={colors.textSecondary} />
            <Text style={styles.reqLabel}>Regions</Text>
            <Text style={styles.reqValue}>{(app.geo_targets || []).join(', ') || 'Global'}</Text>
          </View>
          <View style={styles.dividerFull} />
          <View style={styles.reqItem}>
            <Clock size={20} color={colors.textSecondary} />
            <Text style={styles.reqLabel}>Duration</Text>
            <Text style={styles.reqValue}>14 Days</Text>
          </View>
          <View style={styles.dividerFull} />
          <View style={styles.reqItem}>
            <Smartphone size={20} color={colors.textSecondary} />
            <Text style={styles.reqLabel}>Platform</Text>
            <Text style={styles.reqValue}>Android</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>TESTER FEEDBACK ({reviews?.length || 0})</Text>

        {isTester && !hasReviewed ? (
          <View style={styles.card}>
            <View style={styles.feedbackHeaderRow}>
              {userProfile?.avatar_url ? (
                <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{session?.user?.email?.[0]?.toUpperCase() || 'Y'}</Text>
                </View>
              )}
              <Text style={styles.reqValue}>You</Text>
            </View>

            <View style={[styles.starsRow, { marginBottom: 12 }]}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Star
                    size={24}
                    color={star <= rating ? colors.warning : colors.border}
                    fill={star <= rating ? colors.warning : "transparent"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Leave a review..."
                placeholderTextColor={colors.placeholder}
                multiline
                value={content}
                onChangeText={setContent}
                maxLength={280}
              />
            </View>

            <View style={styles.feedbackFooter}>
              <Text style={styles.charCount}>{content.length}/280</Text>
              <TouchableOpacity
                style={[
                  styles.postBtn,
                  { backgroundColor: content.trim() ? colors.primary : colors.border }
                ]}
                onPress={handlePostReview}
                disabled={!content.trim() || submittingReview}
              >
                <Send size={16} color={content.trim() ? "#fff" : colors.textSecondary} />
                <Text style={[
                  styles.postBtnText,
                  { color: content.trim() ? "#fff" : colors.textSecondary }
                ]}>
                  {submittingReview ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700', marginTop: 8 }}>Posting a review earns +5 Tokens 🪙</Text>
          </View>
        ) : !isTester ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 20 }]}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>Only testers of this app can leave reviews.</Text>
          </View>
        ) : (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 20 }]}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>You have already reviewed this app. Thank you!</Text>
          </View>
        )}

        {reviews?.map((review: any) => (
          <View key={review.id} style={[styles.card, { marginTop: 12 }]}>
            <View style={[styles.feedbackHeaderRow, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={styles.feedbackHeaderRow}>
                {review.reviewer?.avatar_url ? (
                  <Image source={{ uri: review.reviewer.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{review.reviewer?.email?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.reqValue}>{review.reviewer?.email?.split('@')[0] || 'User'}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{new Date(review.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={12}
                    color={star <= review.rating ? colors.warning : colors.border}
                    fill={star <= review.rating ? colors.warning : "transparent"}
                  />
                ))}
              </View>
            </View>
            <Text style={{ fontSize: 15, color: colors.text, lineHeight: 22 }}>{review.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 24 }]}>
        {isOwner ? (
          <View style={[styles.commitBtn, { backgroundColor: colors.border }]}>
            <Text style={[styles.commitBtnTextLeft, { color: colors.textSecondary }]}>Your App</Text>
            <Text style={[styles.commitBtnTextRight, { color: colors.textSecondary }]}>Cannot test your own app</Text>
          </View>
        ) : existingContract ? (
          <View style={[styles.commitBtn, { backgroundColor: colors.border }]}>
            <Text style={[styles.commitBtnTextLeft, { color: colors.textSecondary }]}>Testing</Text>
            <Text style={[styles.commitBtnTextRight, { color: colors.textSecondary }]}>You are already testing this app</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.commitBtn} onPress={handleStartContract}>
            <Text style={styles.commitBtnTextLeft}>Test this app</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Coins size={16} color="#eab308" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>
                  +{app.boost_ends_at && new Date(app.boost_ends_at) > new Date() ? app.bounty + 10 : app.bounty}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Flame size={16} color="#ef4444" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>+1</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
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
    paddingHorizontal: 12,
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
  errorText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 100,
  },
  content: {
    padding: 12,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appIconPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  appTitleCol: {
    flex: 1,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  appOwner: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
  },
  tagBlue: {
    backgroundColor: isDark ? '#1C2B36' : '#E1F0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? '#2D4559' : '#C7E0FF',
  },
  tagBlueText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tagOutlineText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  dividerFull: {
    height: 1,
    backgroundColor: colors.border,
  },
  blurbText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  capacityValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  capacityTotal: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  capacityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 12,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  capacityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  capacitySubText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  reqLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  reqValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#1C3322' : '#E5F1FF',
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  inputBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    height: 100,
    marginBottom: 12,
  },
  input: {
    fontSize: 16,
    color: colors.text,
  },
  feedbackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  postBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  commitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commitBtnTextLeft: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  commitBtnRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commitBtnTokens: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '800',
  },
  commitBtnTextRight: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 14,
    fontWeight: '700',
  },
  stickyFooter: {
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stickySubText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
  },
  warningCard: {
    backgroundColor: isDark ? '#3C1818' : '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? '#7F1D1D' : '#FECACA',
    marginTop: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 6,
  },
  warningDesc: {
    fontSize: 14,
    color: isDark ? '#FECACA' : '#991B1B',
    marginBottom: 8,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warningDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.danger,
    marginRight: 8,
    marginLeft: 4,
  },
  warningItemText: {
    fontSize: 14,
    color: isDark ? '#FCA5A5' : '#7F1D1D',
    fontWeight: '500',
  },
});
