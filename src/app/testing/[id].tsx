import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import Heatmap from '../../components/Heatmap';
import AppIcon from '../../components/AppIcon';
import Skeleton from '../../components/Skeleton';
import { useAuth } from '../../api/auth';
import { useContracts, useUploadProof, useForfeitContract } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import { useTheme } from '../../theme/ThemeContext';

export default function TestingRun() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  
  const { data: contractsData, isLoading, refetch: refetchContracts } = useContracts(session?.user?.id);
  const { mutate: uploadProof, isPending: isUploading } = useUploadProof();
  const { mutate: forfeitContract, isPending: isForfeiting } = useForfeitContract();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const contract = contractsData?.find((c: any) => c.app_id === id);
  const app = contract?.app;

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchContracts();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft color={colors.primary} size={24} />
            <Text style={styles.backText}>DASHBOARD</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroCard}>
            <Skeleton width={48} height={48} borderRadius={12} style={{ marginBottom: 16 }} />
            <Skeleton width={150} height={24} borderRadius={4} />
          </View>
          <View style={styles.heatmapCard}>
            <Skeleton width={120} height={12} borderRadius={4} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={160} borderRadius={8} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!contract || !app) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>CONTRACT NOT FOUND</Text>
      </View>
    );
  }

  const handleForfeit = () => {
    showAlert('Forfeit Contract', 'You will lose karma for breaking this contract.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forfeit', style: 'destructive', onPress: () => {
        forfeitContract(contract.id, {
          onSuccess: () => router.push('/(tabs)/dashboard'),
          onError: (err: any) => showAlert('Error', err.message)
        });
      }}
    ]);
  };

  const handleUploadProof = () => {
    // Find the first day that is 'partial', 'rejected' or 'future'
    const nextDay = contract.days?.find((d: any) => d.status === 'partial' || d.status === 'rejected' || d.status === 'future');
    if (!nextDay) {
      showAlert('All Done', 'All days completed!');
      return;
    }

    uploadProof({
      contractId: contract.id,
      dayNumber: nextDay.day_number,
      proofUrl: 'https://example.com/mock-proof.jpg'
    }, {
      onSuccess: () => showAlert('Success', 'Proof uploaded! Pending dev review.'),
      onError: (err: any) => showAlert('Error', err.message)
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color={colors.primary} size={24} />
          <Text style={styles.backText}>DASHBOARD</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.heroCard}>
          <AppIcon url={app.icon_url} size={48} style={styles.heroIconPlaceholder} />
          <Text style={styles.heroInfo}>{app.name}</Text>
        </View>

        <View style={styles.heatmapCard}>
          <Text style={styles.cardTitle}>14-DAY PROGRESS</Text>
          <Heatmap days={contract.days} />
        </View>

        {(() => {
          const nextDay = contract.days?.find((d: any) => d.status === 'partial' || d.status === 'rejected' || d.status === 'future');
          const isRejected = nextDay?.status === 'rejected';

          return (
            <TouchableOpacity 
              style={[styles.actionBtn, isRejected && { backgroundColor: colors.warning }]} 
              onPress={handleUploadProof} 
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={isDark ? '#000' : '#fff'} />
              ) : (
                <Text style={[styles.actionText, isRejected && { color: '#000' }]}>
                  {isRejected ? 'RE-UPLOAD PROOF' : 'UPLOAD PROOF'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })()}

        <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleForfeit} disabled={isForfeiting}>
          {isForfeiting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={[styles.actionText, styles.dangerText]}>FORFEIT CONTRACT</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  errorText: { color: colors.danger, fontFamily: 'monospace', textAlign: 'center', marginTop: 64 },
  header: {
    paddingTop: 48,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: isDark ? 'rgba(28, 43, 54, 0.8)' : 'rgba(243, 244, 246, 0.8)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: colors.primary, fontFamily: 'monospace', fontSize: 14 },
  content: { padding: 12, paddingBottom: 48 },
  heroCard: { alignItems: 'center', marginBottom: 12 },
  heroIconPlaceholder: {
    marginRight: 0,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  heroInfo: { color: colors.text, fontSize: 18, fontWeight: '700' },
  heatmapCard: { backgroundColor: colors.card, padding: 12, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 12, marginBottom: 12, letterSpacing: 1 },
  actionBtn: { backgroundColor: colors.success, padding: 12, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  actionText: { color: isDark ? '#000' : '#fff', fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  dangerBtn: { backgroundColor: isDark ? 'rgba(229, 57, 53, 0.1)' : 'rgba(255, 59, 48, 0.1)' },
  dangerText: { color: colors.danger },
});
