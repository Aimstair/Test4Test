import AppIcon from '../components/AppIcon';
import { useRouter } from 'expo-router';
import { ChevronLeft, Star } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { useContracts } from '../api/queries';
import { useTheme } from '../theme/ThemeContext';
import Skeleton from '../components/Skeleton';

export default function TestHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { data: contractsData, isLoading } = useContracts(session?.user?.id);

  const rawContracts = contractsData || [];

  // All contracts that have all days resolved (done/missed/rejected)
  const isContractCompleted = (c: any) => {
    if (!c.days || c.days.length === 0) return false;
    return c.days.every((d: any) => ['done', 'missed', 'rejected'].includes(d.status));
  };

  const historyContracts = rawContracts
    .filter((c: any) => isContractCompleted(c) || c.status === 'completed' || c.status === 'failed')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getContractStats = (contract: any) => {
    const days = contract.days || [];
    const doneCount = days.filter((d: any) => d.status === 'done').length;
    const missedCount = days.filter((d: any) => d.status === 'missed').length;
    const totalDays = days.length;
    const completionRate = totalDays > 0 ? Math.round((doneCount / totalDays) * 100) : 0;
    return { doneCount, missedCount, totalDays, completionRate };
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 48) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Test History</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={48} height={48} borderRadius={10} />
                <View style={[styles.cardInfo, { marginLeft: 16 }]}>
                  <Skeleton width={150} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <Skeleton width={100} height={14} borderRadius={4} />
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width={80} height={14} borderRadius={4} />
                <Skeleton width={120} height={14} borderRadius={4} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : historyContracts.length === 0 ? (
        <View style={styles.center}>
          <Star size={48} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptyDesc}>Apps you finish testing will appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
          <Text style={styles.subtitle}>{historyContracts.length} app{historyContracts.length !== 1 ? 's' : ''} tested</Text>

          {historyContracts.map((contract: any) => {
            const app = contract.app;
            if (!app) return null;
            const { doneCount, missedCount, totalDays, completionRate } = getContractStats(contract);
            const numDays = app.app_type === 'Production' ? 7 : 14;
            const isSuccess = completionRate >= 70;

            return (
              <TouchableOpacity
                key={contract.id}
                style={styles.card}
                onPress={() => router.push(`/catalog/${app.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <AppIcon url={app.icon_url} size={48} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                    <Text style={styles.appType}>{app.app_type || 'Testing'} • {numDays}-DAY CONTRACT</Text>
                    <Text style={styles.completedDate}>
                      Joined {new Date(contract.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: isSuccess ? colors.success : colors.danger }]}>
                    <Text style={styles.badgeText}>{completionRate}%</Text>
                  </View>
                </View>

                {/* Heatmap */}
                <View style={styles.heatmapRow}>
                  {(contract.days || [])
                    .sort((a: any, b: any) => a.day_number - b.day_number)
                    .map((d: any, i: number) => (
                      <View
                        key={i}
                        style={[
                          styles.heatCell,
                          d.status === 'done' ? styles.cellDone :
                          d.status === 'missed' ? styles.cellMissed :
                          d.status === 'rejected' ? styles.cellRejected :
                          styles.cellFuture,
                        ]}
                      />
                    ))}
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: colors.success }]}>{doneCount}</Text>
                    <Text style={styles.statLabel}>DONE</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: colors.danger }]}>{missedCount}</Text>
                    <Text style={styles.statLabel}>MISSED</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{totalDays}</Text>
                    <Text style={styles.statLabel}>TOTAL</Text>
                  </View>
                  {contract.feedback?.rating && (
                    <View style={styles.statItem}>
                      <Text style={[styles.statVal, { color: '#FFD700' }]}>★ {contract.feedback.rating}</Text>
                      <Text style={styles.statLabel}>RATING</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
    paddingHorizontal: 16,
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    padding: 16,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  appType: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  completedDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 12,
  },
  heatCell: {
    flex: 1,
    height: 20,
    borderRadius: 3,
  },
  cellDone: {
    backgroundColor: colors.success,
  },
  cellMissed: {
    backgroundColor: colors.danger,
  },
  cellRejected: {
    backgroundColor: '#FF9500',
  },
  cellFuture: {
    backgroundColor: isDark ? '#1C2B36' : '#E1F0FF',
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
