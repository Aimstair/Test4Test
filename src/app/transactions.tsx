import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { useTransactions } from '../api/queries';
import { useTheme } from '../theme/ThemeContext';
import Skeleton from '../components/Skeleton';

export default function Transactions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: transactionsData, isLoading } = useTransactions(session?.user?.id);
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const transactions = transactionsData || [];

  const groupedTransactions: Record<string, any[]> = {};
  transactions.forEach((tx: any) => {
    const date = new Date(tx.created_at).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groupedTransactions[date]) {
      groupedTransactions[date] = [];
    }
    groupedTransactions[date].push(tx);
  });
  const sortedDates = Object.keys(groupedTransactions);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
            <Text style={styles.backText}>Me</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.txCard}>
              <View style={styles.txLeft}>
                <Skeleton width={150} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                <Skeleton width={80} height={12} borderRadius={4} />
              </View>
              <Skeleton width={50} height={20} borderRadius={4} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Me</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        {sortedDates.map((date) => (
          <View key={date} style={styles.section}>
            <Text style={styles.dateHeader}>{date}</Text>
            {groupedTransactions[date].map((tx: any) => (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txLeft}>
                  <Text style={styles.txTitle}>{tx.description}</Text>
                  <Text style={styles.txTime}>
                    {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.txRight}>
                  <Text
                    style={[
                      styles.txAmount,
                      tx.type === 'token_gain' || tx.type === 'karma_gain'
                        ? styles.amountPositive
                        : styles.amountNegative
                    ]}
                  >
                    {(tx.type === 'token_gain' || tx.type === 'karma_gain') ? '+' : ''}
                    {tx.amount} {tx.currency === 'karma' ? 'Karma' : 'Tokens'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {transactions.length === 0 && (
          <Text style={styles.emptyText}>No transactions yet.</Text>
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
    paddingTop: 48,
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
  content: {
    padding: 12,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  txLeft: {
    flex: 1,
    paddingRight: 16,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  txTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  amountPositive: {
    color: colors.success, // Green
  },
  amountNegative: {
    color: colors.danger, // Red
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 14,
  },
});
