import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle, ChevronLeft, ShieldOff } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCustomAlert } from '../../components/AlertProvider';
import { supabase } from '../../lib/supabase';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';

// Custom hook to fetch all reports for admins
const useAdminReports = () => {
  return useQuery({
    queryKey: ['admin_reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, reporter:users(name), app:apps(name, owner_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

const useDelistApp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appId, ownerId, appName }: { appId: string, ownerId: string, appName: string }) => {
      const { error: updateError } = await supabase
        .from('apps')
        .update({ active: false })
        .eq('id', appId);
      if (updateError) throw updateError;
      
      if (ownerId) {
        const { error: notifyError } = await supabase.from('notifications').insert([{
          user_id: ownerId,
          title: 'App Delisted ⚠️',
          body: `Your app "${appName}" has been delisted due to reports. Please open a support ticket to resolve this issue.`,
          type: 'system',
        }]);
        if (notifyError) console.error('Failed to notify owner:', notifyError);
      }
      
      return appId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_reports'] });
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
};

const useDeleteReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.from('reports').delete().eq('id', reportId).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Action failed: Missing database permissions to delete reports. Ask admin to run the SQL fix.');
      }
      return reportId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_reports'] });
    },
  });
};

export default function AdminReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { showAlert } = useCustomAlert();

  const { data: reports, isLoading } = useAdminReports();
  const { mutate: delistApp, isPending: isDelistingApp } = useDelistApp();
  const { mutate: deleteReport, isPending: isDeletingReport } = useDeleteReport();

  const handleDelistApp = (appId: string, ownerId: string, appName: string) => {
    showAlert('Delist App', `Are you sure you want to delist the app "${appName}"? This will make it inactive and notify the owner.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delist App', style: 'destructive', onPress: () => {
          delistApp({ appId, ownerId, appName }, {
            onSuccess: () => showAlert('Success', 'App delisted successfully.'),
            onError: (err) => showAlert('Error', err.message)
          });
        }
      }
    ]);
  };

  const handleDismissReport = (reportId: string) => {
    showAlert('Dismiss Report', 'Are you sure you want to dismiss and delete this report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss', onPress: () => {
          deleteReport(reportId, {
            onSuccess: () => showAlert('Success', 'Report dismissed.'),
            onError: (err) => showAlert('Error', err.message)
          });
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>App Moderation</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        {isLoading ? (
          <View style={{ marginTop: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Skeleton width={80} height={16} borderRadius={4} />
                  <Skeleton width={60} height={14} borderRadius={4} style={{ marginLeft: 'auto' }} />
                </View>
                <Skeleton width="100%" height={14} borderRadius={4} style={{ marginTop: 12, marginBottom: 8 }} />
                <Skeleton width="80%" height={14} borderRadius={4} />
                <View style={[styles.metaBox, { marginTop: 16 }]}>
                   <Skeleton width="100%" height={40} borderRadius={8} />
                </View>
              </View>
            ))}
          </View>
        ) : reports && reports.length > 0 ? (
          reports.map(report => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <AlertTriangle size={20} color={colors.danger} />
                <Text style={styles.reportType}>{report.type.toUpperCase()}</Text>
                <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleDateString()}</Text>
              </View>

              <Text style={styles.reportTitle}>{report.title}</Text>
              {report.description && <Text style={styles.reportDesc}>{report.description}</Text>}

              <View style={styles.metaBox}>
                <Text style={styles.metaText}>Target App: {report.app?.name || 'Unknown'}</Text>
                <Text style={styles.metaText}>Reported By: {report.reporter?.name || 'Unknown'}</Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => handleDismissReport(report.id)}
                  disabled={isDeletingReport || isDelistingApp}
                >
                  <CheckCircle size={16} color={colors.textSecondary} />
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Dismiss</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                  onPress={() => handleDelistApp(report.app_id, report.app?.owner_id, report.app?.name || 'Unknown')}
                  disabled={isDeletingReport || isDelistingApp}
                >
                  <ShieldOff size={16} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Delist App</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <AlertTriangle size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No reports</Text>
            <Text style={styles.emptySub}>All apps are currently behaving.</Text>
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
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportType: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: 8,
    flex: 1,
  },
  reportDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  reportDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  metaBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
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
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
