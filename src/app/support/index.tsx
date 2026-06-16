import { useRouter } from 'expo-router';
import { AlertCircle, CheckCircle2, ChevronLeft, MessageSquare, Plus } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useSupportTickets } from '../../api/queries';
import { useTheme } from '../../theme/ThemeContext';

export default function SupportDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { data: tickets, isLoading } = useSupportTickets(session?.user?.id);
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <View style={[styles.badge, styles.badgeOpen]}><Text style={styles.badgeTextOpen}>OPEN</Text></View>;
      case 'in_progress':
        return <View style={[styles.badge, styles.badgeProgress]}><Text style={styles.badgeTextProgress}>IN PROGRESS</Text></View>;
      case 'resolved':
      case 'closed':
        return <View style={[styles.badge, styles.badgeClosed]}><Text style={styles.badgeTextClosed}>RESOLVED</Text></View>;
      default:
        return <View style={[styles.badge, styles.badgeOpen]}><Text style={styles.badgeTextOpen}>{status.toUpperCase()}</Text></View>;
    }
  };

  const renderIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'bug': return <AlertCircle size={20} color={colors.danger} />;
      case 'feedback': return <MessageSquare size={20} color={colors.primary} />;
      default: return <CheckCircle2 size={20} color={colors.textSecondary} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/support/new')}>
          <Plus size={20} color={colors.primary} />
          <Text style={styles.newBtnText}>New Ticket</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : tickets && tickets.length > 0 ? (
          tickets.map(ticket => (
            <TouchableOpacity
              key={ticket.id}
              style={styles.ticketCard}
              onPress={() => router.push(`/support/${ticket.id}`)}
            >
              <View style={styles.ticketHeader}>
                <View style={styles.ticketTypeRow}>
                  {renderIcon(ticket.category)}
                  <Text style={styles.ticketCategory}>{ticket.category.toUpperCase()}</Text>
                </View>
                {renderStatusBadge(ticket.status)}
              </View>
              <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
              <Text style={styles.ticketDate}>
                {new Date(ticket.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptySub}>Need help? Create a new support ticket.</Text>
            <TouchableOpacity style={styles.createFirstBtn} onPress={() => router.push('/support/new')}>
              <Text style={styles.createFirstBtnText}>CREATE TICKET</Text>
            </TouchableOpacity>
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
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  ticketCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  ticketDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeOpen: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  badgeTextOpen: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '800',
  },
  badgeProgress: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  badgeTextProgress: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
  },
  badgeClosed: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  badgeTextClosed: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createFirstBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
