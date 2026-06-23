import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, CreditCard, HelpCircle, LogOut, Settings, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useContracts, useUserProfile, useUserStats } from '../../api/queries';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';

export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: userProfile, isLoading } = useUserProfile(session?.user?.id);
  const { data: contractsData } = useContracts(session?.user?.id);
  const { data: stats } = useUserStats(session?.user?.id, userProfile?.karma);
  const { colors, isDark } = useTheme();

  const styles = getStyles(colors, isDark);

  const user = userProfile || { karma: 0, country: 'US', device: 'Unknown', os: 'Unknown', name: 'User', tokens: 0, avatar_url: null };
  const contracts = contractsData || [];

  // Compute initials from name
  const initials = (user.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  // Compute active streak (count of active contracts)
  const activeContracts = contracts.filter((c: any) => c.status === 'active');
  const streakDays = activeContracts.length > 0 ? activeContracts[0]?.days?.filter((d: any) => d.status === 'done' || d.status === 'verified').length || 0 : 0;

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      console.log('Google signOut error:', e);
    }
    await supabase.auth.signOut();
    router.replace('/onboarding');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Me</Text>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileSub}>{user.country} · {user.device} · {user.os}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statVal}>{stats?.appsCount || 0}</Text>
            <Text style={styles.statLabel}>APPS</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statVal}>{stats?.testedCount || 0}</Text>
            <Text style={styles.statLabel}>TESTED</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statVal}>{streakDays}d</Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
        </View>
      </View>

      <View style={styles.graphCard}>
        <Text style={styles.graphTitle}>KARMA RANKING</Text>
        <Text style={styles.graphVal}>{typeof user.karma === 'number' ? user.karma.toFixed(1) : user.karma}</Text>
        <Text style={styles.graphSub}>TOP {stats?.rankPercentile || 100}% OF TESTERS</Text>

        <View style={styles.graphContainer}>
          <View style={styles.graphTrack}>
            <View style={[styles.graphFill, { width: `${100 - (stats?.rankPercentile || 100) + 1}%` }]} />
          </View>
          <View style={styles.graphLabels}>
            <Text style={styles.graphLabelText}>Bottom</Text>
            <Text style={styles.graphLabelText}>Top 1%</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      
      <View style={[styles.card, { padding: 0 }]}>
        <TouchableOpacity style={styles.listItem} onPress={() => router.push('/pricing')}>
          <View style={styles.iconContainer}>
            <CreditCard size={20} color="#8E8E93" />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={styles.rowTitle}>Subscription & Tokens</Text>
            <Text style={styles.rowSub}>Manage your billing and tokens</Text>
          </View>
          <ChevronRight size={16} color="#C7C7CC" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.listItem} onPress={() => router.push('/how-it-works')}>
          <View style={styles.iconContainer}>
            <HelpCircle size={20} color="#8E8E93" />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={styles.rowTitle}>How it Works</Text>
            <Text style={styles.rowSub}>Learn the 14-day testing flow</Text>
          </View>
          <ChevronRight size={16} color="#C7C7CC" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.listItem} onPress={() => router.push('/transactions')}>
          <View style={styles.iconContainer}>
            <Clock size={20} color="#8E8E93" />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={styles.rowTitle}>Transaction History</Text>
            <Text style={styles.rowSub}>Token and karma logs</Text>
          </View>
          <ChevronRight size={16} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>APP SETTINGS</Text>

      <View style={[styles.card, { padding: 0 }]}>
        <TouchableOpacity style={styles.listItem} onPress={() => router.push('/settings')}>
          <View style={styles.iconContainer}>
            <Settings size={20} color="#8E8E93" />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={styles.rowTitle}>Settings</Text>
            <Text style={styles.rowSub}>Appearance, notifications, and app behavior</Text>
          </View>
          <ChevronRight size={16} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      {user.role === 'admin' && (
        <>
          <Text style={styles.sectionTitle}>ADMINISTRATION</Text>
          <View style={[styles.card, { padding: 0 }]}>
            <TouchableOpacity style={styles.listItem} onPress={() => router.push('/admin')}>
              <View style={styles.iconContainer}>
                <ShieldCheck size={20} color="#FF3B30" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>Admin Panel</Text>
                <Text style={styles.rowSub}>Manage users, tickets, and reports</Text>
              </View>
              <ChevronRight size={16} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>SESSION</Text>

      <View style={[styles.card, { padding: 0, marginBottom: 40 }]}>
        <TouchableOpacity style={styles.listItem} onPress={handleSignOut}>
          <View style={styles.iconContainer}>
            <LogOut size={20} color="#FF3B30" />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: '#FF3B30' }]}>Sign Out</Text>
            <Text style={styles.rowSub}>Log out of your account</Text>
          </View>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 12,
    paddingTop: 48,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(10, 132, 255, 0.15)' : '#E1F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  profileSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  divider: {
    height: 2,
    backgroundColor: colors.text,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    letterSpacing: 1,
  },
  graphCard: {
    backgroundColor: isDark ? 'rgba(10, 132, 255, 0.15)' : '#E1F0FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(10, 132, 255, 0.3)' : '#C7E0FF',
    marginBottom: 12,
    overflow: 'hidden',
  },
  graphTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
    marginBottom: 8,
  },
  graphVal: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -2,
    marginBottom: 4,
    lineHeight: 64,
  },
  graphSub: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  graphPlaceholder: {
    height: 40,
    justifyContent: 'flex-end',
  },
  graphContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  graphTrack: {
    height: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  graphFill: {
    height: '100%',
    backgroundColor: colors.text,
    borderRadius: 4,
  },
  graphLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  graphLabelText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
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
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  rowSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  listDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 52,
  },
});
