import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Trash2, Ban, CheckCircle, ExternalLink } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAdminApps, useAdminToggleAppStatus, useAdminDeleteApp } from '../../api/queries';
import AppIcon from '../../components/AppIcon';

export default function AdminListings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { data: apps, isLoading } = useAdminApps();
  const { mutate: toggleStatus, isPending: isToggling } = useAdminToggleAppStatus();
  const { mutate: deleteApp, isPending: isDeleting } = useAdminDeleteApp();

  const [searchQuery, setSearchQuery] = useState('');

  const handleToggle = (appId: string, currentBanned: boolean) => {
    Alert.alert(
      currentBanned ? 'Unban App' : 'Ban App',
      `Are you sure you want to ${currentBanned ? 'unban' : 'ban'} this app?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => toggleStatus({ appId, banned: !currentBanned }) }
      ]
    );
  };

  const handleDelete = (appId: string) => {
    Alert.alert(
      'Delete App',
      'This action is irreversible. All contracts and reviews will be cascade deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteApp(appId) }
      ]
    );
  };

  const filteredApps = (apps || []).filter((a: any) => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Listings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by app or developer name..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
          {filteredApps.map((app: any) => {
            const now = new Date();
            const expiresAt = app.expires_at ? new Date(app.expires_at) : null;
            const daysRemaining = expiresAt
              ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            const isExpired = daysRemaining !== null && daysRemaining <= 0;
            const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
            const activeTesterCount = (app.contracts || []).filter((c: any) => c.status === 'active').length;

            const cardBorderColor = app.banned === true ? '#FF3B30' :
              isExpired ? '#FF9500' :
              isExpiringSoon ? '#FFD700' :
              colors.border;

            return (
              <View key={app.id} style={[styles.card, { borderColor: cardBorderColor }]}>
                <View style={styles.appHeader}>
                  <AppIcon url={app.icon_url} size={48} />
                  <View style={styles.appInfo}>
                    <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                    <Text style={styles.ownerName}>Dev: {app.owner?.name || 'Unknown'} (Karma: {app.owner?.karma || 0})</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <View style={[styles.typeBadge, { backgroundColor: app.app_type === 'Production' ? '#34C759' : '#0A84FF' }]}>
                        <Text style={styles.typeBadgeText}>{app.app_type || 'Testing'}</Text>
                      </View>
                      <View style={[styles.typeBadge, { backgroundColor: app.banned === true ? '#FF3B30' : (app.active === false ? '#8E8E93' : '#34C759') }]}>
                        <Text style={styles.typeBadgeText}>{app.banned === true ? 'BANNED' : (app.active === false ? 'INACTIVE' : 'ACTIVE')}</Text>
                      </View>
                    </View>
                    <Text style={[styles.ownerName, { marginTop: 4 }]}>
                      Testers: {activeTesterCount}/{app.tester_limit || '?'}
                      {daysRemaining !== null && (
                        <Text style={{ color: isExpired ? '#FF3B30' : isExpiringSoon ? '#FF9500' : colors.textSecondary }}>
                          {' '}• {isExpired ? 'EXPIRED' : `${daysRemaining}d left`}
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/catalog/${app.id}`)}>
                    <ExternalLink size={18} color={colors.text} />
                    <Text style={styles.actionText}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleToggle(app.id, app.banned === true)}
                    disabled={isToggling}
                  >
                    {app.banned !== true ? (
                      <><Ban size={18} color="#FF9500" /><Text style={[styles.actionText, { color: '#FF9500' }]}>Ban</Text></>
                    ) : (
                      <><CheckCircle size={18} color="#34C759" /><Text style={[styles.actionText, { color: '#34C759' }]}>Unban</Text></>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(app.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 size={18} color="#FF3B30" />
                    <Text style={[styles.actionText, { color: '#FF3B30' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {filteredApps.length === 0 && (
            <Text style={styles.emptyText}>No listings found.</Text>
          )}
        </ScrollView>
      )}
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
  searchContainer: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardBanned: {
    opacity: 0.8,
    borderColor: '#FF3B30',
  },
  cardInactive: {
    opacity: 0.8,
    borderColor: colors.border,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  appInfo: {
    flex: 1,
    marginLeft: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  ownerName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  textActive: {
    color: '#34C759',
  },
  textBanned: {
    color: '#FF3B30',
  },
  textInactive: {
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    justifyContent: 'space-around',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
