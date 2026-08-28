import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Clock, Coins, Diamond, Flame, Infinity as InfinityIcon, PackageCheck, Smartphone, Star, Users, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { usePurchaseSubscription, usePurchaseTokens, useUserProfile } from '../api/queries';
import { useCustomAlert } from '../components/AlertProvider';
import { useTheme } from '../theme/ThemeContext';

export default function Pricing() {
  const router = useRouter();
  const [billing, setBilling] = useState<'weekly' | 'monthly'>('weekly');
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { mutate: purchaseSubscription, isPending: subPending } = usePurchaseSubscription();
  const { mutate: purchaseTokens, isPending: tokPending } = usePurchaseTokens();
  const isPending = subPending || tokPending;
  const { showAlert } = useCustomAlert();
  const { data: userProfile } = useUserProfile(session?.user?.id);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [rcInitializing, setRcInitializing] = useState(true);

  useEffect(() => {
    const initRC = async () => {
      try {
        if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) {
          console.warn('RevenueCat API key missing. Payments will not work.');
          setRcInitializing(false);
          return;
        }

        Purchases.setLogLevel(Purchases.LOG_LEVEL.ERROR);
        Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY });

        if (session?.user?.id) {
          await Purchases.logIn(session.user.id);
        }

        const offers = await Purchases.getOfferings();
        if (offers.current !== null) {
          setOfferings(offers.current);
        }

        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
      } catch (e: any) {
        console.warn('RevenueCat config error:', e);
      } finally {
        setRcInitializing(false);
      }
    };

    initRC();
  }, [session?.user?.id]);

  const handlePurchase = async (tier: 'Pro' | 'Pro+', rcPackageId?: string) => {
    if (!session?.user?.id) return;

    // Fallback if RC not configured
    if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || !rcPackageId) {
      showAlert('Payment Unavailable', 'Payment gateway is not fully configured yet. Missing API Keys.');
      return;
    }

    try {
      const pkg = offerings?.availablePackages.find(p => p.identifier === rcPackageId);
      if (!pkg) throw new Error('Product not found in RevenueCat dashboard.');

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Verification passed
      purchaseSubscription({ userId: session.user.id, tier }, {
        onSuccess: () => {
          showAlert('Success', `Successfully upgraded to ${tier}. You earned ${tier === 'Pro' ? 100 : 200} Karma!`);
        },
        onError: (err: any) => {
          showAlert('Database Error', 'Payment succeeded but failed to update profile. Contact support.');
        }
      });
    } catch (e: any) {
      if (!e.userCancelled) {
        showAlert('Payment Error', e.message);
      }
    }
  };

  const handleBuyTokens = async (amount: number, rcPackageId: string) => {
    if (!session?.user?.id) return;

    if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) {
      showAlert('Payment Unavailable', 'Payment gateway is not fully configured yet.');
      return;
    }

    try {
      const pkg = offerings?.availablePackages.find(p => p.identifier === rcPackageId);
      if (!pkg) throw new Error('Product not found in RevenueCat dashboard.');

      await Purchases.purchasePackage(pkg);

      purchaseTokens({ userId: session.user.id, amount }, {
        onSuccess: () => {
          showAlert('Success', `Successfully purchased ${amount} tokens!`);
        },
        onError: (err: any) => {
          showAlert('Database Error', 'Payment succeeded but failed to update profile. Contact support.');
        }
      });
    } catch (e: any) {
      if (!e.userCancelled) {
        showAlert('Payment Error', e.message);
      }
    }
  };

  const getActiveSubscriptionStatus = (tier: 'Pro' | 'Pro+') => {
    const currentTier = userProfile?.subscription_tier;
    if (currentTier === tier) {
      let expDateObj: Date | null = null;

      if (customerInfo) {
        const activeEnts = Object.values(customerInfo.entitlements.active);
        if (activeEnts.length > 0 && activeEnts[0].expirationDate) {
          expDateObj = new Date(activeEnts[0].expirationDate);
        }
      } else if (userProfile?.subscription_expires_at) {
        expDateObj = new Date(userProfile.subscription_expires_at);
      }

      if (expDateObj) {
        const diffMs = expDateObj.getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          return `Active Subscription (${diffDays} days)`;
        }
      }
      return 'Active Subscription';
    }
    if (currentTier === 'Pro+' && tier === 'Pro') {
      return 'Included in Pro+';
    }
    return null;
  };

  const isTierDisabled = (tier: 'Pro' | 'Pro+') => {
    const currentTier = userProfile?.subscription_tier;
    if (currentTier === 'Pro+' && tier === 'Pro') return true;
    return rcInitializing || isPending || currentTier === tier;
  };

  const getDynamicPrice = (tier: 'Pro' | 'Pro+') => {
    const isProPlus = tier === 'Pro+';
    const rcPackageId = isProPlus
      ? (billing === 'monthly' ? 'test4test_pro_plus_monthly' : 'test4test_pro_plus_weekly')
      : (billing === 'monthly' ? 'test4test_pro_monthly' : 'test4test_pro_weekly');

    const fallback = isProPlus
      ? (billing === 'monthly' ? '$10' : '$5')
      : (billing === 'monthly' ? '$3.99' : '$2.49');

    if (!offerings) return fallback;
    const pkg = offerings.availablePackages.find(p => p.identifier === rcPackageId);
    return pkg ? pkg.product.priceString : fallback;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Me</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>

        {/* Token Education Banner */}
        <TouchableOpacity
          style={styles.earnTokensBanner}
          onPress={() => router.push('/(tabs)/catalog')}
        >
          <View style={styles.bannerIconContainer}>
            <Text style={{ fontSize: 24 }}>💡</Text>
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Want to publish for FREE?</Text>
            <Text style={styles.bannerSub}>Earn Tokens by testing other apps instead of buying them. Tap here to view the Catalog!</Text>
          </View>
          <ChevronLeft size={20} color={colors.primary} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>SUBSCRIPTION</Text>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, billing === 'weekly' && styles.toggleBtnActive]}
              onPress={() => setBilling('weekly')}
            >
              <Text style={[styles.toggleText, billing === 'weekly' && styles.toggleTextActive]}>Weekly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, billing === 'monthly' && styles.toggleBtnActive]}
              onPress={() => setBilling('monthly')}
            >
              <Text style={[styles.toggleText, billing === 'monthly' && styles.toggleTextActive]}>
                Monthly <Text style={{ color: '#34C759', fontSize: 10, fontWeight: '800' }}>-50%</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <View>
              <Text style={styles.tierName}>Basic</Text>
              <Text style={styles.tierSub}>For solo testers getting started</Text>
            </View>
            <Text style={styles.tierPrice}>Free</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>List 1 app</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Up to 12 testers</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>12 day listing duration</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Standard reports</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Community support</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btnGrey}>
            <Text style={styles.btnTextBlack}>Choose Basic</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <View>
              <Text style={styles.tierName}>Pro</Text>
              <Text style={styles.tierSub}>For active developers</Text>
            </View>
            <Text style={styles.tierPrice}>
              {getDynamicPrice('Pro')}
              <Text style={styles.priceMo}>{billing === 'monthly' ? '/mo' : '/wk'}</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>List 3 apps</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Up to 25 testers per app</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>50% Off Listing Price</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Unlimited listing duration</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>+100 Karma Points</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Email support</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btnBlack, isTierDisabled('Pro') && { opacity: 0.6 }]}
            onPress={() => handlePurchase('Pro', billing === 'monthly' ? 'test4test_pro_monthly' : 'test4test_pro_weekly')}
            disabled={isTierDisabled('Pro')}
          >
            <Text style={styles.btnTextWhite}>
              {getActiveSubscriptionStatus('Pro') || (rcInitializing ? 'Connecting...' : isPending ? 'Processing...' : 'Upgrade to Pro')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <View>
              <Text style={styles.tierName}>Pro+</Text>
              <Text style={styles.tierSub}>For studios and teams</Text>
            </View>
            <Text style={styles.tierPrice}>
              {getDynamicPrice('Pro+')}
              <Text style={styles.priceMo}>{billing === 'monthly' ? '/mo' : '/wk'}</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>List 5 apps</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Up to 50 testers per app</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Unlock Pro+ Listing</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Unlimited listing duration</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>+200 Karma Points</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Dedicated support channel</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btnBlack, isTierDisabled('Pro+') && { opacity: 0.6 }]}
            onPress={() => handlePurchase('Pro+', billing === 'monthly' ? 'test4test_pro_plus_monthly' : 'test4test_pro_plus_weekly')}
            disabled={isTierDisabled('Pro+')}
          >
            <Text style={styles.btnTextWhite}>
              {getActiveSubscriptionStatus('Pro+') || (rcInitializing ? 'Connecting...' : isPending ? 'Processing...' : 'Choose Pro+')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableContainer}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>COMPARE PLANS</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.tableCellHeader, { flex: 1.5 }]}></Text>
              <View style={[styles.tableCell, { alignItems: 'center' }]}>
                <Star size={16} color={colors.textSecondary} style={{ marginBottom: 4 }} />
                <Text style={styles.tableCellHeader}>Basic</Text>
              </View>
              <View style={[styles.tableCell, { alignItems: 'center' }]}>
                <Zap size={16} color="#FF9500" style={{ marginBottom: 4 }} />
                <Text style={[styles.tableCellHeader, { color: '#FF9500' }]}>Pro</Text>
              </View>
              <View style={[styles.tableCell, { alignItems: 'center' }]}>
                <Diamond size={16} color="#A855F7" style={{ marginBottom: 4 }} />
                <Text style={[styles.tableCellHeader, { color: '#A855F7' }]}>Pro+</Text>
              </View>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCellLabelContainer}>
                <Smartphone size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Active Listings</Text>
              </View>
              <Text style={styles.tableCell}>1</Text>
              <Text style={styles.tableCell}>3</Text>
              <Text style={styles.tableCell}>5</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCellLabelContainer}>
                <Users size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Testers</Text>
              </View>
              <Text style={styles.tableCell}>12</Text>
              <Text style={styles.tableCell}>25</Text>
              <Text style={styles.tableCell}>50</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCellLabelContainer}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Listing Duration</Text>
              </View>
              <Text style={styles.tableCell}>12d</Text>
              <Text style={styles.tableCell}>
                <InfinityIcon size={14} color={colors.text} />
              </Text>
              <Text style={styles.tableCell}>
                <InfinityIcon size={14} color={colors.text} />
              </Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCellLabelContainer}>
                <PackageCheck size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Basic Listing</Text>
              </View>
              <Text style={styles.tableCell}>
                <Coins size={10} color="#eab308" /> 80
              </Text>
              <Text style={styles.tableCell}>
                <Coins size={10} color="#eab308" /> 40
              </Text>
              <Text style={styles.tableCell}>Free</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCellLabelContainer}>
                <PackageCheck size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Pro Listing</Text>
              </View>
              <Text style={styles.tableCell}>
                <Coins size={10} color="#eab308" /> 150
              </Text>
              <Text style={styles.tableCell}>
                <Coins size={10} color="#eab308" /> 75
              </Text>
              <Text style={styles.tableCell}>Free</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={styles.tableCellLabelContainer}>
                <PackageCheck size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Pro+ Listing</Text>
              </View>
              <Text style={styles.tableCell}>
                <Coins size={10} color="#eab308" /> 300
              </Text>
              <Text style={styles.tableCell}>
                <Coins size={10} color="#eab308" /> 300
              </Text>
              <Text style={styles.tableCell}>Free</Text>
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <View style={styles.tableCellLabelContainer}>
                <Flame size={14} color={colors.textSecondary} />
                <Text style={styles.tableCellLabel}>Karma Bonus</Text>
              </View>
              <Text style={styles.tableCell}>-</Text>
              <Text style={styles.tableCell}>
                <Flame size={12} color="#ef4444" /> +100
              </Text>
              <Text style={styles.tableCell}>
                <Flame size={12} color="#ef4444" /> +200
              </Text>
            </View>
          </View>
        </View>

        {(userProfile?.subscription_tier === 'Pro' || userProfile?.subscription_tier === 'Pro+') && (
          <TouchableOpacity
            style={{ marginTop: 0, alignItems: 'center' }}
            onPress={() => Linking.openURL('https://play.google.com/store/account/subscriptions')}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 14, textDecorationLine: 'underline', fontWeight: '500' }}>
              Manage Google Play Subscription
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>TOKEN PACKS</Text>

        <View style={styles.tokenPacksRow}>
          <TouchableOpacity
            style={[styles.tokenCard, (isPending || rcInitializing) && { opacity: 0.6 }]}
            onPress={() => handleBuyTokens(50, 'tokens_50')}
            disabled={isPending || rcInitializing}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Coins size={18} color="#eab308" />
              <Text style={styles.tokenValue}>50</Text>
            </View>
            <Text style={styles.tokenLabel}>tokens</Text>
            <Text style={styles.tokenPrice}>{rcInitializing ? '...' : '$1.99'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tokenCard, styles.tokenCardBest, (isPending || rcInitializing) && { opacity: 0.6 }]}
            onPress={() => handleBuyTokens(200, 'tokens_200')}
            disabled={isPending || rcInitializing}
          >
            <Text style={styles.bestValueText}>BEST VALUE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Coins size={18} color="#eab308" />
              <Text style={styles.tokenValue}>200</Text>
            </View>
            <Text style={styles.tokenLabel}>tokens</Text>
            <Text style={styles.tokenPrice}>{rcInitializing ? '...' : '$4.99'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tokenCard, (isPending || rcInitializing) && { opacity: 0.6 }]}
            onPress={() => handleBuyTokens(500, 'tokens_500')}
            disabled={isPending || rcInitializing}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Coins size={18} color="#eab308" />
              <Text style={styles.tokenValue}>500</Text>
            </View>
            <Text style={styles.tokenLabel}>tokens</Text>
            <Text style={styles.tokenPrice}>{rcInitializing ? '...' : '$9.99'}</Text>
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
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: colors.card,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: isDark ? 0 : 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.text,
  },
  earnTokensBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EBF5FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
    marginBottom: 24,
  },
  bannerIconContainer: {
    marginRight: 16,
  },
  bannerTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  pricingCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  tierSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tierPrice: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: colors.text,
  },
  priceMo: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  featuresList: {
    gap: 8,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
  },
  btnGrey: {
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnTextBlack: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  btnBlack: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  tokenPacksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenCardBest: {
    borderColor: colors.border, // Or keep same, but has extra text
    paddingVertical: 12, // adjust for top text
  },
  bestValueText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tokenValue: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  tokenLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  tokenPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  tableContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  table: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeader: {
    backgroundColor: colors.background,
  },
  tableCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    justifyContent: 'center',
  },
  tableCellHeader: {
    fontWeight: '800',
    color: colors.textSecondary,
    fontSize: 12,
  },
  tableCellCentered: {
    flex: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tableCellLabelContainer: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    gap: 6,
    justifyContent: 'flex-start',
  },
  tableCellLabel: {
    textAlign: 'left',
    fontWeight: '600',
    color: colors.textSecondary,
    fontSize: 11,
  },
});
