import { useRouter } from 'expo-router';
import { Camera, ChevronLeft, Coins, Download, Flame, Search, ShieldCheck, Trophy, Zap } from 'lucide-react-native';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

export default function HowItWorks() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Me</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        <View style={styles.heroCard}>
          <Text style={styles.brandText}>TEST4TEST</Text>
          <Text style={styles.heroTitle}>Real testers. Real sessions. Real reports.</Text>
          <Text style={styles.heroBody}>
            Test4Test connects Android developers with verified testers who commit to using their app daily for 14 consecutive days — the exact window Google Play requires for production graduation.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>THE 14-DAY FLOW</Text>

        <View style={styles.cardContainer}>
          <View style={styles.stepBox}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Search size={24} color="#3b82f6" />
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>1. Discover apps</Text>
              <Text style={styles.stepDesc}>Browse the catalog of developer-submitted apps. Filter by tier, geography, and bounty to find ones that match your device.</Text>
            </View>
          </View>

          <View style={styles.connector} />

          <View style={styles.stepBox}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <ShieldCheck size={24} color="#22c55e" />
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>2. Commit to 14 days</Text>
              <Text style={styles.stepDesc}>Commit to using an app daily for 14 days. Check in each day to earn +1 Karma per app.</Text>
            </View>
          </View>

          <View style={styles.connector} />

          <View style={styles.stepBox}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
              <Download size={24} color="#f97316" />
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>3. Install via Play Console</Text>
              <Text style={styles.stepDesc}>Open the internal-test opt-in link and install. Your install registers automatically with the developer console.</Text>
            </View>
          </View>

          <View style={styles.connector} />

          <View style={styles.stepBox}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Camera size={24} color="#a855f7" />
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>4. Daily proof</Text>
              <Text style={styles.stepDesc}>Each day: launch the app for 60+ seconds, then submit an EXIF-verified screenshot to prove your engagement.</Text>
            </View>
          </View>

          <View style={styles.connector} />

          <View style={styles.stepBox}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Trophy size={24} color="#ef4444" />
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepTitle}>5. Claim your reward</Text>
              <Text style={styles.stepDesc}>Complete all 14 days to boost your Karma score, climb the rankings, and prove your reliability as a tester.</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>THE ECOSYSTEM: KARMA & TOKENS</Text>

        <View style={styles.cardContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', padding: 8, borderRadius: 12, marginRight: 12 }}>
              <Coins size={20} color="#eab308" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Tokens</Text>
          </View>
          <Text style={[styles.stepDesc, { marginBottom: 24 }]}>
            Tokens are the in-app currency of Test4Test. You earn Tokens by completing your onboarding, reviewing apps you've tested, or purchasing them from the shop. Developers use Tokens to list their apps on the catalog.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: 8, borderRadius: 12, marginRight: 12 }}>
              <Flame size={20} color="#ef4444" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Karma</Text>
          </View>
          <Text style={styles.stepDesc}>
            Karma is your reputation score. High Karma gives you better visibility and ranking. Testers earn +1 Karma for each daily check-in per app. Missing a day costs -2 Karma. Developers earn +0.5 Karma when approving tester proofs.
          </Text>
        </View>

        <View style={[styles.referenceCard, { marginTop: 16 }]}>
          <View style={styles.referenceHeader}>
            <Zap size={20} color="#3b82f6" style={{ marginRight: 8 }} />
            <Text style={styles.referenceTitle}>Quick Reference</Text>
          </View>

          <View style={styles.referenceList}>
            <ReferenceItem label="Review tested app" value="+5" icon="Coins" />
            <ReferenceItem label="Test App (Basic)" value="+5" icon="Coins" />
            <ReferenceItem label="Test App (Pro)" value="+10" icon="Coins" />
            <ReferenceItem label="Test App (Pro+)" value="+20" icon="Coins" />
            <ReferenceItem label="Test App (Boosted)" value="+10" icon="Coins" />
            <ReferenceItem label="Publish App (Basic)" value="-50" icon="Coins" />
            <ReferenceItem label="Publish App (Pro)" value="-150" icon="Coins" />
            <ReferenceItem label="Publish App (Pro+)" value="-300" icon="Coins" />
            <ReferenceItem label="Boost App (1 day)" value="-20" icon="Coins" />

            <View style={styles.referenceDivider} />

            <ReferenceItem label="Daily check-in" value="+1" icon="Flame" />
            <ReferenceItem label="Missed check-in" value="-2" icon="Flame" />
            <ReferenceItem label="Approve proof" value="+0.5" icon="Flame" />
            <ReferenceItem label="Missed review" value="-1" icon="Flame" />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>JOIN THE GOOGLE GROUP</Text>

        <View style={styles.cardContainer}>
          <Text style={styles.stepDesc}>
            To test apps via the Google Play Internal Testing track, you MUST join the master Google Group:
          </Text>

          <TouchableOpacity
            style={[styles.btn, styles.btnBlack, { marginVertical: 16 }]}
            onPress={() => Linking.openURL('https://groups.google.com/g/test4test-community')}
          >
            <Text style={styles.btnTextWhite}>OPEN GOOGLE GROUP</Text>
          </TouchableOpacity>

          <Text style={styles.stepDesc}>
            Developers add this single group to their Play Console, keeping your personal address entirely private!
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const ReferenceItem = ({ label, value, icon }: { label: string, value: string, icon?: 'Coins' | 'Flame' }) => {
  const { colors } = useTheme();
  return (
    <View style={stylesReference.row}>
      <Text style={[stylesReference.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={stylesReference.valueContainer}>
        <Text style={[stylesReference.value, { color: colors.text }]}>{value}</Text>
        {icon === 'Coins' && <Coins size={16} color="#eab308" style={{ marginLeft: 6 }} />}
        {icon === 'Flame' && <Flame size={16} color="#ef4444" style={{ marginLeft: 6 }} />}
      </View>
    </View>
  );
};

const stylesReference = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
  }
});

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
  content: {
    padding: 12,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  brandText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    color: colors.primary,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 28,
  },
  heroBody: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 8,
  },
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  connector: {
    width: 2,
    height: 32,
    backgroundColor: colors.border,
    marginLeft: 23,
    marginVertical: 4,
  },
  referenceCard: {
    backgroundColor: isDark ? '#1C2B36' : '#E5F1FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
  },
  referenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  referenceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  referenceList: {
    flexDirection: 'column',
  },
  referenceDivider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnBlack: {
    backgroundColor: colors.primary,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
