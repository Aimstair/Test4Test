import { useRouter } from 'expo-router';
import { AlertCircle, Camera, ChevronLeft, Clock, Download, Search, Shield, ShieldCheck, Trophy } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
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

        <View style={styles.stepCard}>
          <View style={styles.stepNumBox}>
            <Text style={styles.stepNum}>01</Text>
          </View>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <Search size={14} color={colors.primary} />
              <Text style={styles.stepTitle}>Discover apps</Text>
            </View>
            <Text style={styles.stepBody}>
              Browse the catalog of developer-submitted apps. Filter by tier, geography, and bounty to find ones that match your device.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumBox}>
            <Text style={styles.stepNum}>02</Text>
          </View>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <ShieldCheck size={14} color={colors.primary} />
              <Text style={styles.stepTitle}>Commit to 14 days</Text>
            </View>
            <Text style={styles.stepBody}>
              Commit to using an app daily for 14 days. Check in each day to earn +1 Karma per app.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumBox}>
            <Text style={styles.stepNum}>03</Text>
          </View>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <Download size={14} color={colors.primary} />
              <Text style={styles.stepTitle}>Install via Play Console</Text>
            </View>
            <Text style={styles.stepBody}>
              Open the internal-test opt-in link and install. Your install registers automatically with the developer console.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumBox}>
            <Text style={styles.stepNum}>04</Text>
          </View>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <Camera size={14} color={colors.primary} />
              <Text style={styles.stepTitle}>Daily proof</Text>
            </View>
            <Text style={styles.stepBody}>
              Each day: launch the app for 60+ seconds, then submit an EXIF-verified screenshot to prove your engagement.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumBox}>
            <Text style={styles.stepNum}>05</Text>
          </View>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <Trophy size={14} color={colors.primary} />
              <Text style={styles.stepTitle}>Claim your reward</Text>
            </View>
            <Text style={styles.stepBody}>
              Complete all 14 days to boost your Karma score, climb the rankings, and prove your reliability as a tester.
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>THE ECOSYSTEM: KARMA & TOKENS</Text>
        
        <View style={styles.stepCard}>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.stepTitle}>What are Tokens?</Text>
            </View>
            <Text style={styles.stepBody}>
              Tokens are the in-app currency of Test4Test. You earn Tokens by completing your onboarding, reviewing apps you've tested (+5 Tokens per review), or purchasing them from the shop. Developers use Tokens to list their apps on the catalog.
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepInfo}>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.stepTitle}>What is Karma?</Text>
            </View>
            <Text style={styles.stepBody}>
              Karma is your reputation score. High Karma gives you better visibility and ranking.
            </Text>
            <Text style={[styles.stepBody, { marginTop: 8 }]}>
              ✅ Testers earn +1 Karma for each daily check-in per app.{"\n"}
              ✅ Developers earn +0.5 Karma when approving tester proofs.{"\n"}
              ❌ Testers lose -2 Karma per app they miss checking in on each day.{"\n"}
              ❌ Developers lose -1 Karma when failing to process same-day proofs.
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>JOIN THE GOOGLE GROUP</Text>

        <View style={styles.stepCard}>
          <View style={styles.stepInfo}>
            <Text style={styles.stepBody}>
              To test apps via the Google Play Internal Testing track, you MUST join the master Google Group:
            </Text>
            
            <TouchableOpacity 
              style={[styles.btn, styles.btnBlack, { marginVertical: 12 }]}
              onPress={() => Linking.openURL('https://groups.google.com/u/2/g/test4test-community')}
            >
              <Text style={styles.btnTextWhite}>OPEN GOOGLE GROUP</Text>
            </TouchableOpacity>

            <Text style={[styles.stepBody, { marginTop: 8 }]}>
              Developers add this single group to their Play Console, keeping your personal address entirely private!
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>INTEGRITY RULES</Text>

        <View style={styles.integrityCard}>
          <View style={styles.integrityRow}>
            <Clock size={16} color={colors.textSecondary} style={styles.integrityIcon} />
            <Text style={styles.integrityText}>Sessions must be 60s minimum, on real hardware.</Text>
          </View>
          <View style={styles.integrityDivider} />
          <View style={styles.integrityRow}>
            <Shield size={16} color={colors.textSecondary} style={styles.integrityIcon} />
            <Text style={styles.integrityText}>Screenshots are validated for EXIF metadata + geometry.</Text>
          </View>
          <View style={styles.integrityDivider} />
          <View style={styles.integrityRow}>
            <AlertCircle size={16} color={colors.textSecondary} style={styles.integrityIcon} />
            <Text style={styles.integrityText}>Missing a day costs -2 Karma per app missed.</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnBlack]}
            onPress={() => router.push('/catalog')}
          >
            <Text style={styles.btnTextWhite}>Browse catalog</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnGrey]}
            onPress={() => router.push('/pricing')}
          >
            <Text style={styles.btnTextBlack}>See pricing</Text>
          </TouchableOpacity>
        </View>

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
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 32,
  },
  heroBody: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 8,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  stepNumBox: {
    backgroundColor: colors.border,
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNum: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 14,
    color: colors.text,
  },
  stepInfo: {
    flex: 1,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  stepBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  integrityCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  integrityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  integrityIcon: {
    marginRight: 12,
  },
  integrityText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  integrityDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnBlack: {
    backgroundColor: colors.primary,
  },
  btnGrey: {
    backgroundColor: colors.border,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnTextBlack: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
