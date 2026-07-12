import { useRouter } from 'expo-router';
import { Crown, ShieldAlert, Star, X, Zap } from 'lucide-react-native';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

interface MembershipGuideModalProps {
  visible: boolean;
  onClose: () => void;
  userTier?: string;
}

export default function MembershipGuideModal({ visible, onClose, userTier = 'Basic' }: MembershipGuideModalProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleUpgradeClick = () => {
    onClose();
    router.push('/pricing');
  };

  const isBasic = userTier.toLowerCase() === 'basic' || !userTier;
  const isPro = userTier.toLowerCase() === 'pro';
  const isProPlus = userTier.toLowerCase() === 'pro+';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <Crown size={28} color="#eab308" />
            <Text style={styles.title}>Your Membership</Text>
          </View>

          <View style={styles.currentTierBox}>
            <Text style={styles.currentTierLabel}>Current Tier:</Text>
            <Text style={[styles.currentTierValue, isProPlus && { color: '#eab308' }]}>
              {userTier.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.subtitle}>
            {isBasic
              ? "You are currently on the Basic tier. Upgrade to unlock powerful benefits, increase your limits, and get more testers faster."
              : "Thank you for being a premium member! Here are your active benefits:"}
          </Text>

          <ScrollView style={styles.stepsContainer}>

            <View style={styles.stepBox}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                <Zap size={24} color="#eab308" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>Testing Limits</Text>
                <Text style={styles.stepDesc}>
                  {isProPlus ? "Unlimited active app testing slots." : isPro ? "Up to 5 active app testing slots at a time." : "Standard 1 active app testing slot at a time."}
                </Text>
              </View>
            </View>

            <View style={styles.connector} />

            <View style={styles.stepBox}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Star size={24} color="#3b82f6" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>Publishing Limits</Text>
                <Text style={styles.stepDesc}>
                  {isProPlus ? "Publish up to 5 apps to the catalog simultaneously." : isPro ? "Publish up to 3 apps to the catalog." : "Publish 1 app to the catalog at a time."}
                </Text>
              </View>
            </View>

            <View style={styles.connector} />

            <View style={styles.stepBox}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                <ShieldAlert size={24} color="#22c55e" />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>Karma Boost</Text>
                <Text style={styles.stepDesc}>
                  {isProPlus ? "+200 Karma bonus to rank your apps at the very top." : isPro ? "+100 Karma bonus to rank your apps higher." : "Earn Karma by being a good tester to rank your apps higher."}
                </Text>
              </View>
            </View>

          </ScrollView>

          {!isProPlus ? (
            <TouchableOpacity style={styles.actionBtn} onPress={handleUpgradeClick}>
              <Text style={styles.actionBtnText}>Upgrade Membership</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 32,
    maxHeight: '90%',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 12,
  },
  currentTierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentTierLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 8,
  },
  currentTierValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  stepsContainer: {
    marginBottom: 24,
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
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  connector: {
    width: 2,
    height: 32,
    backgroundColor: colors.border,
    marginLeft: 23,
    marginVertical: 4,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
