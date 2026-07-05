import { useRouter } from 'expo-router';
import { AlertTriangle, Check, ChevronLeft, Flag, Image as ImageIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminDisputes, useAdminResolveDispute } from '../../api/queries';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeContext';
import { useCustomAlert } from '../../components/AlertProvider';

export default function AdminDisputes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { showAlert } = useCustomAlert();

  const { data: disputes, isLoading } = useAdminDisputes();
  const { mutate: resolveDispute } = useAdminResolveDispute();

  const [fullImageModalVisible, setFullImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const handleResolve = (proofId: string, action: 'uphold' | 'overturn', testerId: string, developerId: string) => {
    resolveDispute({ proofId, action, testerId, developerId }, {
      onSuccess: () => {
        showAlert('Dispute Resolved', action === 'overturn' ? 'Proof approved. Developer penalized.' : 'Rejection upheld.');
      },
      onError: (err: any) => {
        showAlert('Error', err.message);
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Dispute Resolution</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        {isLoading ? (
          <View style={{ marginTop: 20 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Skeleton width={120} height={16} borderRadius={4} />
                  <Skeleton width={60} height={20} borderRadius={10} />
                </View>
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <Skeleton width={80} height={150} borderRadius={8} />
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width="80%" height={14} borderRadius={4} style={{ marginBottom: 16 }} />
                    <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
                    <Skeleton width="60%" height={14} borderRadius={4} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : disputes && disputes.length > 0 ? (
          disputes.map(dispute => {
            const tester = dispute.contract?.tester;
            const app = dispute.contract?.app;
            const developer = app?.owner;

            return (
              <View key={dispute.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.appName}>{app?.name || 'Unknown App'}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Day {dispute.day_number}</Text>
                  </View>
                </View>

                <View style={styles.usersRow}>
                  <View style={styles.userCol}>
                    <Text style={styles.userLabel}>TESTER</Text>
                    <Text style={styles.userName}>{tester?.name || 'Unknown'}</Text>
                  </View>
                  <View style={styles.userCol}>
                    <Text style={styles.userLabel}>DEVELOPER</Text>
                    <Text style={styles.userName}>{developer?.name || 'Unknown'}</Text>
                  </View>
                </View>

                <View style={styles.reasonBlock}>
                  <Text style={styles.reasonLabel}>REJECTION REASON</Text>
                  <Text style={styles.reasonText}>{dispute.reject_reason || 'No reason provided'}</Text>
                </View>

                <TouchableOpacity
                  style={styles.imagePlaceholder}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (dispute.proof_image_url) {
                      setSelectedImageUrl(dispute.proof_image_url);
                      setFullImageModalVisible(true);
                    }
                  }}
                >
                  {dispute.proof_image_url ? (
                    <Image source={{ uri: dispute.proof_image_url }} style={styles.proofImage} />
                  ) : (
                    <>
                      <ImageIcon size={24} color={colors.textSecondary} />
                      <Text style={styles.placeholderText}>NO IMAGE UPLOADED</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.btnUphold]}
                    onPress={() => handleResolve(dispute.id, 'uphold', tester?.id, developer?.id)}
                  >
                    <X size={20} color={colors.text} />
                    <Text style={styles.btnTextBlack}>UPHOLD REJECTION</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.btnOverturn]}
                    onPress={() => handleResolve(dispute.id, 'overturn', tester?.id, developer?.id)}
                  >
                    <Check size={20} color="#fff" />
                    <Text style={styles.btnTextWhite}>OVERTURN (+1/-5)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <AlertTriangle size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No disputes</Text>
            <Text style={styles.emptySub}>All good here.</Text>
          </View>
        )}
      </ScrollView>

      {/* Full Image Modal */}
      <Modal visible={fullImageModalVisible} transparent animationType="fade">
        <View style={styles.fullImageOverlay}>
          <TouchableOpacity
            style={styles.closeFullImageBtn}
            onPress={() => setFullImageModalVisible(false)}
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>
          {selectedImageUrl && (
            <Image source={{ uri: selectedImageUrl }} style={styles.fullImage} resizeMode="contain" />
          )}
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
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  usersRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userCol: {
    flex: 1,
  },
  userLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  reasonBlock: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reasonLabel: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  reasonText: {
    color: colors.danger,
    fontSize: 14,
  },
  imagePlaceholder: {
    height: 200,
    backgroundColor: colors.background,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  proofImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  btnUphold: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnOverturn: {
    backgroundColor: colors.danger,
  },
  btnTextBlack: {
    color: colors.text,
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
  },
  btnTextWhite: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
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
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
