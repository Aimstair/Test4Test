import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, AlertTriangle, ChevronLeft, MessageSquare, Power, PowerOff, Star, TrendingUp, Users, X } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useAppMetrics, useBoostApp, useCatalog, useReviews, useToggleAppStatus, useUserProfile } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import AppIcon from '../../components/AppIcon';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';

export default function StudioDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [selectedDay, setSelectedDay] = React.useState<{ date: string, installs: number, checkins: number } | null>(null);
  const [boostModalVisible, setBoostModalVisible] = React.useState(false);
  const [reviewsModalVisible, setReviewsModalVisible] = React.useState(false);
  const [slideAnim] = React.useState(new Animated.Value(Dimensions.get('window').height));

  React.useEffect(() => {
    if (reviewsModalVisible) {
      slideAnim.setValue(Dimensions.get('window').height);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();
    }
  }, [reviewsModalVisible]);

  const [testingToggle, setTestingToggle] = React.useState<'active' | 'done'>('active');
  const [productionToggle, setProductionToggle] = React.useState<'active' | 'done'>('active');
  const [boostDays, setBoostDays] = React.useState(3);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { data: userProfile, refetch: refetchProfile, isLoading: isLoadingProfile } = useUserProfile(session?.user?.id);
  const { data: catalog, isLoading: isLoadingCatalog, refetch: refetchCatalog } = useCatalog();
  const { mutate: toggleStatus, isPending: isToggling } = useToggleAppStatus();
  const { mutate: boostApp, isPending: isBoosting } = useBoostApp();

  const app = catalog?.find((a: any) => a.id === id);

  const { data: metrics, refetch: refetchMetrics, isLoading: isLoadingMetrics } = useAppMetrics(id as string);
  const { data: reviews, refetch: refetchReviews, isLoading: isLoadingReviews } = useReviews(id as string);

  const isScreenLoading = isLoadingCatalog || isLoadingMetrics || isLoadingReviews || isLoadingProfile;

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchCatalog(), refetchMetrics(), refetchReviews()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (isScreenLoading) {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: Math.max(insets.top + 12, 48), paddingHorizontal: 16, marginBottom: 20 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
            <Text style={styles.backText}>Build</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.appHeaderCard}>
            <Skeleton width={64} height={64} borderRadius={16} />
            <View style={[styles.appHeaderInfo, { marginLeft: 16 }]}>
              <Skeleton width={120} height={20} borderRadius={4} style={{ marginBottom: 6 }} />
              <Skeleton width={100} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
              <Skeleton width={80} height={14} borderRadius={4} />
            </View>
          </View>

          <Skeleton width={100} height={14} borderRadius={4} style={{ marginTop: 24, marginBottom: 8, marginLeft: 16 }} />
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}><Skeleton width="100%" height={60} borderRadius={8} /></View>
            <View style={styles.metricCard}><Skeleton width="100%" height={60} borderRadius={8} /></View>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}><Skeleton width="100%" height={60} borderRadius={8} /></View>
            <View style={styles.metricCard}><Skeleton width="100%" height={60} borderRadius={8} /></View>
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

  let activeAppLimit = 1;
  if (userProfile?.subscription_tier === 'Pro') activeAppLimit = 3;
  if (userProfile?.subscription_tier === 'Pro+') activeAppLimit = 5;

  const myApps = catalog?.filter((a: any) => a.owner_id === session?.user?.id) || [];
  const activeAppsCount = myApps.filter((a: any) => a.active !== false).length;

  const isUnlimited = app.app_type !== 'Production' && (userProfile?.subscription_tier === 'Pro' || userProfile?.subscription_tier === 'Pro+');

  let effectiveExpiresAt = app.expires_at ? new Date(app.expires_at) : null;
  if (!effectiveExpiresAt && app.created_at) {
    let days = 14;
    if (app.tier === 'Pro') days = 20;
    if (app.tier === 'Pro+') days = 30;
    effectiveExpiresAt = new Date(app.created_at);
    effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + days);
  }

  const isExpired = !isUnlimited && effectiveExpiresAt ? effectiveExpiresAt < new Date() : false;
  const daysRemaining = effectiveExpiresAt ? Math.max(0, Math.ceil((effectiveExpiresAt.getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : 0;
  const isBoosted = app.boost_ends_at && new Date(app.boost_ends_at) > new Date();

  const handleBoost = () => {
    if (app.active === false) {
      showAlert('App Offline', 'You cannot boost an app that is offline. Please activate it first.');
      return;
    }
    boostApp({ appId: app.id, ownerId: session?.user?.id as string, days: boostDays }, {
      onSuccess: () => {
        showAlert('App Boosted! 🔥', `Your app is now promoted in the catalog.`);
        setBoostModalVisible(false);
      },
      onError: (err: any) => showAlert('Error', err.message)
    });
  };

  const handleToggleActive = () => {
    if (app.active === false && app.banned === true) {
      showAlert('App Banned', 'This app has been banned for violating our terms of service and cannot be activated.');
      return;
    }

    if (app.active === false && activeAppsCount >= activeAppLimit) {
      if (userProfile?.subscription_tier === 'Pro+') {
        showAlert('Limit Reached', `Your Pro+ tier allows a maximum of ${activeAppLimit} active apps.`);
      } else {
        setShowUpgradeModal(true);
      }
      return;
    }

    toggleStatus({ appId: app.id, active: app.active === false ? true : false }, {
      onError: (err: any) => showAlert('Error', err.message)
    });
  };

  const getContractVirtualStatus = (contract: any) => {
    if (contract.status === 'done') return 'done';
    if (contract.status === 'active') {
      const futureCount = contract.contract_days?.filter((d: any) => d.status === 'future').length;
      if (futureCount === 0 && contract.contract_days?.length > 0) return 'done';
      return 'active';
    }
    return contract.status;
  };

  const activeTesters = new Set(metrics?.filter((c: any) => getContractVirtualStatus(c) === 'active').map((c: any) => c.tester_id)).size || 0;
  const testingContracts = metrics?.filter((c: any) => (c.contract_days?.length || 0) > 7) || [];
  const productionContracts = metrics?.filter((c: any) => (c.contract_days?.length || 0) <= 7 && (c.contract_days?.length || 0) > 0) || [];
  const failedTesters = metrics?.filter((c: any) => c.status === 'failed').length || 0;
  const churnRate = (metrics?.length || 0) > 0 ? Math.round((failedTesters / metrics!.length) * 100) : 0;
  const testerLimit = app.tester_limit || 10;
  const capacityPercent = Math.min(100, Math.round((activeTesters / testerLimit) * 100));

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const active24H = metrics?.reduce((acc, c: any) => {
    const verifiedRecent = c.contract_days?.some((d: any) =>
      d.status === 'verified' && (d.date === todayStr || d.date === yesterdayStr)
    );
    return acc + (verifiedRecent ? 1 : 0);
  }, 0) || 0;

  const avgRating = reviews?.length
    ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  // Chart Data Preparation
  const datesSet = new Set<string>();
  metrics?.forEach((c: any) => c.contract_days?.forEach((d: any) => {
    if (d.date) datesSet.add(d.date);
  }));

  // Create a continuous 14-day window ending today
  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split('T')[0];
  });

  // Merge actual data dates with the 14-day window
  last14Days.forEach(d => datesSet.add(d));
  const sortedDates = Array.from(datesSet).sort().slice(-14);

  const chartData = sortedDates.map(dateStr => {
    let checkins = 0;
    let installs = 0;

    // Future dates should have empty bars
    if (dateStr <= todayStr) {
      metrics?.forEach((c: any) => {
        const day = c.contract_days?.find((d: any) => d.date === dateStr);
        if (day && (day.status === 'verified' || day.status === 'done' || day.status === 'pending')) {
          checkins++;
        }

        // Rolling active installs: Was the contract alive and valid on this day?
        const startD = new Date(c.start_date || c.created_at).toISOString().split('T')[0];
        const endD = new Date(c.start_date || c.created_at);
        endD.setDate(endD.getDate() + 14);
        const endStr = endD.toISOString().split('T')[0];

        if (dateStr >= startD && dateStr < endStr) {
          if (c.status === 'active' || c.status === 'done') {
            installs++;
          } else if (c.status === 'failed') {
            if (day && day.status !== 'missed' && day.status !== 'future') {
              installs++;
            }
          }
        }
      });
    }
    return { date: dateStr, installs, checkins };
  });

  const maxDataVal = Math.max(testerLimit, ...chartData.map(c => Math.max(c.installs, c.checkins)));
  const chartMax = Math.max(5, Math.ceil(maxDataVal / 5) * 5);
  const step = chartMax / 5;
  const yAxisLabels = [];
  for (let i = chartMax; i >= 0; i -= step) {
    yAxisLabels.push(i);
  }

  const renderTesterCard = (contract: any) => {
    const progressDays = contract.contract_days?.filter((d: any) => d.status !== 'future').length || 0;
    return (
      <View key={contract.id} style={styles.testerCard}>
        {contract.tester?.avatar_url ? (
          <Image source={{ uri: contract.tester.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>
              {contract.tester?.name?.substring(0, 2).toUpperCase() || 'TE'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.reviewName}>{contract.tester?.name || 'Tester'}</Text>
          <Text style={styles.reviewDate}>Day {progressDays} of {contract.contract_days?.length || 14} completed</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 4, marginTop: 8 }}>
            {[...(contract.contract_days || [])].sort((a: any, b: any) => a.day_number - b.day_number).map((d: any, idx: number) => {
              let bgColor = colors.card;
              if (d.status === 'done' || d.status === 'verified') bgColor = colors.success;
              else if (d.status === 'missed' || d.status === 'rejected') bgColor = colors.danger;
              else if (d.status === 'pending') bgColor = colors.warning;

              return (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: bgColor,
                    borderWidth: 1, borderColor: colors.border
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Navigation */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color={colors.text} size={24} />
          <Text style={styles.backText}>Build</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom > 0 ? insets.bottom + 120 : 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* App Header Card */}
        <View style={styles.appHeaderCard}>
          <AppIcon url={app.icon_url} size={64} style={styles.appIconBox} />
          <View style={styles.appHeaderInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.appName}>{app.name}</Text>
              {isExpired ? (
                <View style={{ backgroundColor: 'rgba(255, 59, 48, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.danger }}>EXPIRED</Text>
                </View>
              ) : app.active !== false ? (
                <View style={{ backgroundColor: isDark ? '#1C2B36' : '#E5F1FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary }}>LIVE</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textSecondary }}>OFFLINE</Text>
                </View>
              )}
              {isBoosted && (
                <View style={{ backgroundColor: 'rgba(255, 149, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FF9500' }}>🔥 BOOSTED</Text>
                </View>
              )}
            </View>
            <Text style={styles.appSub}>{app.tier} tier · {app.tester_limit} testers{isExpired ? ' · Expired' : isUnlimited ? ' · Unlimited' : effectiveExpiresAt ? ` · Expires in ${daysRemaining}d` : ' · Unlimited'}</Text>
            <View style={styles.ratingRow}>
              <Star size={14} color={colors.primary} fill={colors.primary} />
              <Text style={styles.ratingText}>{avgRating} · <Text style={styles.ratingSub}>{reviews?.length || 0} reviews</Text></Text>
            </View>
          </View>
        </View>

        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>KEY METRICS</Text>
        <View style={styles.metricsGrid}>
          {/* Card 1 */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardHeader}>
              <Users size={14} color={colors.textSecondary} />
              <Text style={styles.metricCardLabel}>TESTERS LOCKED</Text>
            </View>
            <Text style={styles.metricCardValue}>{activeTesters}<Text style={styles.metricCardTotal}>/{testerLimit}</Text></Text>
            <Text style={styles.metricCardSub}>{capacityPercent}% capacity</Text>
          </View>
          {/* Card 2 */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardHeader}>
              <Activity size={14} color={colors.textSecondary} />
              <Text style={styles.metricCardLabel}>ACTIVE 24H</Text>
            </View>
            <Text style={styles.metricCardValue}>{active24H}</Text>
            <Text style={styles.metricCardSub}>sessions verified</Text>
          </View>
          {/* Card 3 */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardHeader}>
              <AlertTriangle size={14} color={colors.textSecondary} />
              <Text style={styles.metricCardLabel}>CHURN RATE</Text>
            </View>
            <Text style={styles.metricCardValue}>{churnRate}%</Text>
            <Text style={styles.metricCardSub}>{failedTesters} drop-offs</Text>
          </View>
          {/* Card 4 */}
          <View style={styles.metricCard}>
            <View style={styles.metricCardHeader}>
              <TrendingUp size={14} color={colors.textSecondary} />
              <Text style={styles.metricCardLabel}>AVG RATING</Text>
            </View>
            <Text style={styles.metricCardValue}>{avgRating}</Text>
            <Text style={styles.metricCardSub}>{reviews?.length || 0} reviews</Text>
          </View>
        </View>

        {isExpired ? (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={[styles.toggleBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => router.push(`/studio/new?renewAppId=${app.id}`)}
            >
              <Power size={18} color="#000" />
              <Text style={[styles.toggleBtnText, { color: '#000' }]}>
                RENEW LISTING
              </Text>
            </TouchableOpacity>
            {app.app_type !== 'Production' && (
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: '#34C759', borderColor: '#34C759' }]}
                onPress={() => router.push(`/studio/new?renewAppId=${app.id}&presetAppType=Production`)}
              >
                <Star size={18} color="#fff" fill="#fff" />
                <Text style={[styles.toggleBtnText, { color: '#fff' }]}>
                  CONVERT TO PRODUCTION
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: 'column', gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.toggleBtn, app.active !== false ? styles.toggleBtnActive : styles.toggleBtnInactive, { flex: 1 }]}
                onPress={handleToggleActive}
                disabled={isToggling}
              >
                {isToggling ? (
                  <ActivityIndicator size="small" color={app.active !== false ? colors.danger : colors.primary} />
                ) : (
                  <>
                    {app.active !== false ? <PowerOff size={18} color={colors.danger} /> : <Power size={18} color={colors.primary} />}
                    <Text style={[styles.toggleBtnText, app.active !== false ? { color: colors.danger } : { color: colors.primary }]}>
                      {app.active !== false ? 'DELIST APP' : 'ACTIVATE APP'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, { flex: 1, backgroundColor: '#FF9500', borderColor: '#FF9500' }]}
                onPress={() => setBoostModalVisible(true)}
              >
                <Activity size={18} color="#fff" />
                <Text style={[styles.toggleBtnText, { color: '#fff' }]}>
                  BOOST LISTING
                </Text>
              </TouchableOpacity>
            </View>

            {/* Show convert to production for unlimited apps too */}
            {app.app_type !== 'Production' && !app.expires_at && (
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: '#34C759', borderColor: '#34C759' }]}
                onPress={() => router.push(`/studio/new?renewAppId=${app.id}&presetAppType=Production`)}
              >
                <Star size={18} color="#fff" fill="#fff" />
                <Text style={[styles.toggleBtnText, { color: '#fff' }]}>
                  CONVERT TO PRODUCTION
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Daily Metrics Chart */}
        <>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>DAILY METRICS</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Installed</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.success, marginLeft: 8 }]} />
              <Text style={styles.legendText}>Checked In</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row' }}>
            <View style={styles.yAxisContainer}>
              {yAxisLabels.map(label => (
                <Text key={label} style={styles.yAxisLabel}>{label}</Text>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
              <View style={styles.chartContainer}>
                {chartData.map((d, index) => {
                  const installHeight = (d.installs / chartMax) * 100;
                  const checkinHeight = (d.checkins / chartMax) * 100;
                  const isToday = d.date === new Date().toISOString().split('T')[0];

                  return (
                    <TouchableOpacity key={d.date} style={styles.barGroup} onPress={() => setSelectedDay(d)}>
                      <View style={styles.barsContainer}>
                        <View style={[styles.barBg, { height: '100%' }]}>
                          <View style={[styles.barFillBlue, { height: `${installHeight}%` }]} />
                        </View>
                        <View style={[styles.barBg, { height: '100%' }]}>
                          <View style={[styles.barFillGreen, { height: `${checkinHeight}%` }]} />
                        </View>
                      </View>
                      <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>
                        {d.date.substring(5).replace('-', '/')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </>

        {/* App Testers (Testing Phase) */}
        {testingContracts.length > 0 && (
          <View style={{ marginTop: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>APP TESTERS</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segmentBtn, testingToggle === 'active' && styles.segmentBtnActive]}
                  onPress={() => setTestingToggle('active')}
                >
                  <Text style={[styles.segmentText, testingToggle === 'active' && styles.segmentTextActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, testingToggle === 'done' && styles.segmentBtnActive]}
                  onPress={() => setTestingToggle('done')}
                >
                  <Text style={[styles.segmentText, testingToggle === 'done' && styles.segmentTextActive]}>Completed</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.reviewsContainer}>
              {testingContracts.filter((c: any) => getContractVirtualStatus(c) === testingToggle).map((contract: any) => renderTesterCard(contract))}
              {testingContracts.filter((c: any) => getContractVirtualStatus(c) === testingToggle).length === 0 && (
                <Text style={{ color: colors.textSecondary, fontStyle: 'italic', marginLeft: 8 }}>
                  No {testingToggle === 'active' ? 'active testers' : 'completed testers'} currently.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* App Users (Production Phase) */}
        {productionContracts.length > 0 && (
          <View style={{ marginTop: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>APP USERS</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segmentBtn, productionToggle === 'active' && styles.segmentBtnActive]}
                  onPress={() => setProductionToggle('active')}
                >
                  <Text style={[styles.segmentText, productionToggle === 'active' && styles.segmentTextActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, productionToggle === 'done' && styles.segmentBtnActive]}
                  onPress={() => setProductionToggle('done')}
                >
                  <Text style={[styles.segmentText, productionToggle === 'done' && styles.segmentTextActive]}>Completed</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.reviewsContainer}>
              {productionContracts.filter((c: any) => getContractVirtualStatus(c) === productionToggle).map((contract: any) => renderTesterCard(contract))}
              {productionContracts.filter((c: any) => getContractVirtualStatus(c) === productionToggle).length === 0 && (
                <Text style={{ color: colors.textSecondary, fontStyle: 'italic', marginLeft: 8 }}>
                  No {productionToggle === 'active' ? 'active users' : 'completed users'} currently.
                </Text>
              )}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 32 }]}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => setReviewsModalVisible(true)}>
          <MessageSquare size={18} color={colors.background} />
          <Text style={styles.exportBtnText}>View Tester Reviews ({reviews?.length || 0})</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Day Modal */}
      <Modal visible={!!selectedDay} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedDay(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.modalIconCircle, { backgroundColor: colors.background }]}>
              <TrendingUp size={32} color={colors.text} />
            </View>
            <Text style={styles.modalTitle}>Daily Stats</Text>
            <Text style={styles.modalDesc}>
              {selectedDay?.date ? new Date(selectedDay.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : ''}
            </Text>

            <View style={styles.dayStatsContainer}>
              <View style={styles.dayStatItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary, width: 12, height: 12, borderRadius: 6 }]} />
                <Text style={styles.dayStatLabel}>Installed</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.dayStatValue}>{selectedDay?.installs}</Text>
              </View>
              <View style={styles.dayStatItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success, width: 12, height: 12, borderRadius: 6 }]} />
                <Text style={styles.dayStatLabel}>Checked In</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.dayStatValue}>{selectedDay?.checkins}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setSelectedDay(null)}>
              <Text style={styles.modalBtnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Boost Modal */}
      <Modal visible={boostModalVisible} transparent animationType="fade" onRequestClose={() => setBoostModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { alignItems: 'stretch' }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setBoostModalVisible(false)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(255, 149, 0, 0.1)' }]}>
              <Activity size={32} color="#FF9500" />
            </View>

            <Text style={styles.modalTitle}>Boost Listing</Text>
            <Text style={styles.modalDesc}>
              Boosting your app pins it to the top of the Catalog with a Promoted badge, instantly getting you testers.
            </Text>

            <View style={{ width: '100%', backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>DURATION (DAYS)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.card, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: boostDays <= 1 ? 0.5 : 1 }}
                  onPress={() => setBoostDays(Math.max(1, boostDays - 1))}
                  disabled={boostDays <= 1}
                >
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>-</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.text }}>{boostDays}</Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.card, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: boostDays >= (app.expires_at ? Math.max(1, daysRemaining) : 30) ? 0.5 : 1 }}
                  onPress={() => {
                    const maxDays = app.expires_at ? Math.max(1, daysRemaining) : 30;
                    if (boostDays >= maxDays) {
                      showAlert('Limit Reached', `You can only boost for up to ${maxDays} days because your app listing expires soon. Renew it first to boost longer!`);
                      return;
                    }
                    setBoostDays(Math.min(maxDays, boostDays + 1));
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 24 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Cost (20 tokens/day)</Text>
              <Text style={{ color: '#FF9500', fontSize: 18, fontWeight: '900' }}>{boostDays * 20} TOKENS</Text>
            </View>

            <TouchableOpacity
              style={[styles.modalBtnPrimary, { backgroundColor: '#FF9500' }]}
              onPress={handleBoost}
              disabled={isBoosting}
            >
              {isBoosting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>CONFIRM BOOST</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upgrade Modal */}
      <Modal visible={showUpgradeModal} transparent animationType="fade" onRequestClose={() => setShowUpgradeModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowUpgradeModal(false)} />
          <View style={[styles.modalCard, { alignItems: 'stretch' }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowUpgradeModal(false)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.modalIconCircle, { backgroundColor: 'rgba(255, 149, 0, 0.1)', alignSelf: 'center', marginTop: 12 }]}>
              <TrendingUp size={32} color="#FF9500" />
            </View>

            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Upgrade Membership</Text>
            <Text style={[styles.modalDesc, { textAlign: 'center', marginBottom: 32 }]}>
              You've reached the maximum number of active apps allowed on your current tier. Upgrade to Pro or Pro+ to run multiple app tests simultaneously.
            </Text>

            <TouchableOpacity
              style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowUpgradeModal(false);
                router.push('/pricing');
              }}
            >
              <Text style={styles.modalBtnPrimaryText}>VIEW PLANS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reviews Modal */}
      <Modal visible={reviewsModalVisible} transparent animationType="fade" onRequestClose={() => setReviewsModalVisible(false)}>
        <View style={[styles.modalOverlay, { padding: 0, justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setReviewsModalVisible(false)} />
          <Animated.View style={[
            styles.modalCard,
            {
              maxHeight: '90%',
              padding: 0,
              width: '100%',
              maxWidth: '100%',
              alignItems: 'stretch',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              paddingBottom: Math.max(insets.bottom, 24),
              transform: [{ translateY: slideAnim }]
            }
          ]}>
            <View style={{ padding: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.modalTitle}>Tester Reviews</Text>
              <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>

              {/* Rating Summary Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
                <View style={{ alignItems: 'center', marginRight: 24 }}>
                  <Text style={{ fontSize: 48, fontWeight: '900', color: colors.text }}>{avgRating}</Text>
                  <View style={{ flexDirection: 'row', marginVertical: 4 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={14} color={i <= Math.round(parseFloat(avgRating)) ? colors.warning : colors.border} fill={i <= Math.round(parseFloat(avgRating)) ? colors.warning : "transparent"} />
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>{reviews?.length || 0} REVIEWS</Text>
                </View>

                {/* Bars */}
                <View style={{ flex: 1, gap: 6 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews?.filter((r: any) => r.rating === star).length || 0;
                    const percent = reviews?.length ? (count / reviews.length) * 100 : 0;
                    return (
                      <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, width: 10, fontWeight: '600' }}>{star}</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${percent}%`, height: '100%', backgroundColor: colors.text }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {reviews?.map((review: any) => {
                const dateStr = new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return (
                  <View key={review.id} style={[styles.reviewCard, { marginBottom: 16 }]}>
                    <View style={styles.reviewHeader}>
                      {review.reviewer?.avatar_url ? (
                        <Image source={{ uri: review.reviewer.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.reviewAvatar}>
                          <Text style={styles.reviewAvatarText}>
                            {review.reviewer?.name?.substring(0, 2).toUpperCase() || 'TE'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.reviewName}>{review.reviewer?.name || 'Tester'}</Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} size={12} color={i <= review.rating ? colors.warning : colors.border} fill={i <= review.rating ? colors.warning : "transparent"} />
                        ))}
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.reviewDate}>{dateStr}</Text>
                    </View>
                    <Text style={styles.reviewText}>{review.content}</Text>
                  </View>
                );
              })}
              {(!reviews || reviews.length === 0) && (
                <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 60 }}>
                  <MessageSquare size={48} color={colors.border} style={{ marginBottom: 16 }} />
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>No reviews yet</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                    Testers will leave reviews after completing their required testing period.
                  </Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 64,
  },
  navHeader: {
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
    paddingBottom: 100,
  },
  appHeaderCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  appIconBox: {
    marginRight: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appHeaderInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  appSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  ratingSub: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 24,
    gap: 8,
  },
  toggleBtnActive: {
    borderColor: colors.danger,
    backgroundColor: isDark ? '#3C1818' : '#FFEBEE',
  },
  toggleBtnInactive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? '#1C2B36' : '#E5F1FF',
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1C1C1E' : '#E5E5EA',
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.text,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    width: '48%', // Approx half with gap
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  metricCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  metricCardValue: {
    fontSize: 24,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  metricCardTotal: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  metricCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reportsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  reportDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  reportSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  pdfBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  reviewsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  testerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  reviewAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  reviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  },

  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reviewText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exportBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chartScroll: {
    marginBottom: 24,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    height: 180,
    minWidth: '100%',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  barGroup: {
    alignItems: 'center',
    marginRight: 16,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barsContainer: {
    flexDirection: 'row',
    height: 120, // max bar height
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 8,
  },
  barBg: {
    width: 10,
    backgroundColor: colors.background,
    borderRadius: 5,
    justifyContent: 'flex-end',
  },
  barFillBlue: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  barFillGreen: {
    width: '100%',
    backgroundColor: colors.success,
    borderRadius: 5,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  barLabelToday: {
    color: colors.text,
    fontWeight: '800',
  },
  yAxisContainer: {
    justifyContent: 'space-between',
    paddingBottom: 24, // Matches the x-axis label height offset
    paddingTop: 16,
    paddingRight: 8,
    height: 180,
  },
  yAxisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: isDark ? 0 : 10,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dayStatsContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  dayStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayStatLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    marginLeft: 8,
  },
  dayStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  feedbackCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackTesterName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: colors.text,
  },
  feedbackBlock: {
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  feedbackText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  emptyFeedback: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyFeedbackText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
