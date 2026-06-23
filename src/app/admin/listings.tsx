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
          {filteredApps.map((app: any) => (
            <View key={app.id} style={[styles.card, app.banned === true && styles.cardBanned, app.active === false && app.banned !== true && styles.cardInactive]}>
              <View style={styles.appHeader}>
                <AppIcon url={app.icon_url} size={48} />
                <View style={styles.appInfo}>
                  <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                  <Text style={styles.ownerName}>Dev: {app.owner?.name || 'Unknown'} (Karma: {app.owner?.karma || 0})</Text>
                  <Text style={[styles.statusText, app.banned === true ? styles.textBanned : (app.active === false ? styles.textInactive : styles.textActive)]}>
                    {app.banned === true ? 'BANNED' : (app.active === false ? 'INACTIVE' : 'ACTIVE')}
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
          ))}
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
  }
});
