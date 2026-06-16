import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases, { PurchasesOffering } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { usePurchaseSubscription, usePurchaseTokens } from '../api/queries';
import { useCustomAlert } from '../components/AlertProvider';
import { useTheme } from '../theme/ThemeContext';

export default function Pricing() {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { mutate: purchaseSubscription, isPending: subPending } = usePurchaseSubscription();
  const { mutate: purchaseTokens, isPending: tokPending } = usePurchaseTokens();
  const isPending = subPending || tokPending;
  const { showAlert } = useCustomAlert();
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [rcInitializing, setRcInitializing] = useState(true);

  useEffect(() => {
    const initRC = async () => {
      try {
        if (!process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) {
          console.warn('RevenueCat API key missing. Payments will not work.');
          setRcInitializing(false);
          return;
        }

        Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY });

        if (session?.user?.id) {
          await Purchases.logIn(session.user.id);
        }

        const offers = await Purchases.getOfferings();
        if (offers.current !== null) {
          setOfferings(offers.current);
        }
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
      //  showAlert('Payment Unavailable', 'Payment gateway is not fully configured yet. Missing API Keys.');
      showAlert('Payment Unavailable', 'Payment gateway will be available in production.');
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Me</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        {rcInitializing && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading prices...</Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>SUBSCRIPTION</Text>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, billing === 'monthly' && styles.toggleBtnActive]}
              onPress={() => setBilling('monthly')}
            >
              <Text style={[styles.toggleText, billing === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, billing === 'yearly' && styles.toggleBtnActive]}
              onPress={() => setBilling('yearly')}
            >
              <Text style={[styles.toggleText, billing === 'yearly' && styles.toggleTextActive]}>Yearly</Text>
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
              {billing === 'monthly' ? '$15' : '$149'}
              <Text style={styles.priceMo}>{billing === 'monthly' ? '/mo' : '/yr'}</Text>
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
              <Text style={styles.featureText}>Up to 25 testers per app</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>Free Pro Listing</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>20 day listing duration</Text>
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
            style={styles.btnBlack}
            onPress={() => handlePurchase('Pro', billing === 'monthly' ? 'test4test_pro_monthly' : 'test4test_pro_yearly')}
            disabled={isPending}
          >
            <Text style={styles.btnTextWhite}>{isPending ? 'Processing...' : 'Upgrade to Pro'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <View>
              <Text style={styles.tierName}>Pro+</Text>
              <Text style={styles.tierSub}>For studios and teams</Text>
            </View>
            <Text style={styles.tierPrice}>
              {billing === 'monthly' ? '$49' : '$349'}
              <Text style={styles.priceMo}>{billing === 'monthly' ? '/mo' : '/yr'}</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Check size={14} color={colors.primary} />
              <Text style={styles.featureText}>List 10 apps</Text>
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
            style={styles.btnBlack}
            onPress={() => handlePurchase('Pro+', billing === 'monthly' ? 'test4test_pro_plus_monthly' : 'test4test_pro_plus_yearly')}
            disabled={isPending}
          >
            <Text style={styles.btnTextWhite}>{isPending ? 'Processing...' : 'Choose Pro+'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>TOKEN PACKS</Text>

        <View style={styles.tokenPacksRow}>
          <TouchableOpacity style={styles.tokenCard} onPress={() => handleBuyTokens(50, 'tokens_50')} disabled={isPending}>
            <Text style={styles.tokenValue}>50</Text>
            <Text style={styles.tokenLabel}>tokens</Text>
            <Text style={styles.tokenPrice}>$1.99</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tokenCard, styles.tokenCardBest]} onPress={() => handleBuyTokens(200, 'tokens_200')} disabled={isPending}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
            <Text style={styles.tokenValue}>200</Text>
            <Text style={styles.tokenLabel}>tokens</Text>
            <Text style={styles.tokenPrice}>$4.99</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tokenCard} onPress={() => handleBuyTokens(500, 'tokens_500')} disabled={isPending}>
            <Text style={styles.tokenValue}>500</Text>
            <Text style={styles.tokenLabel}>tokens</Text>
            <Text style={styles.tokenPrice}>$9.99</Text>
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
    backgroundColor: colors.text,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnTextWhite: {
    color: colors.background,
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
});
