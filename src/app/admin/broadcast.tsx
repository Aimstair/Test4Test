import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Users, User, CheckCircle2, Circle, X, Search } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../api/auth';
import { useAdminUsers } from '../../api/queries';

export default function AdminBroadcast() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { session } = useAuth();
  const { data: adminUsers, isLoading: isLoadingUsers } = useAdminUsers(true);

  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [usersModalVisible, setUsersModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please enter both title and message.');
      return;
    }
    if (targetType === 'specific' && selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user.');
      return;
    }

    setIsSending(true);

    try {
      let targetUsers = adminUsers || [];
      if (targetType === 'specific') {
        targetUsers = targetUsers.filter(u => selectedUsers.includes(u.id));
      }

      if (targetUsers.length === 0) {
        Alert.alert('Info', 'No users found to send to.');
        setIsSending(false);
        return;
      }

      // 1. Bulk insert into notifications table so it appears in their in-app feed
      const notifications = targetUsers.map(u => ({
        user_id: u.id,
        title: title.trim(),
        body: body.trim(),
        type: 'support'
      }));
      
      const chunkSize = 500;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        await supabase.from('notifications').insert(chunk);
      }

      // 2. Send actual push notifications using Expo API directly
      const pushTokens = targetUsers.map(u => u.push_token).filter(token => token && (token.startsWith('ExpoPushToken') || token.startsWith('ExponentPushToken')));
      
      if (pushTokens.length > 0) {
        const pushMessages = pushTokens.map(token => ({
          to: token,
          sound: 'default',
          title: title.trim(),
          body: body.trim(),
          data: { type: 'support' },
          priority: 'high',
          channelId: 'default'
        }));

        const expoChunkSize = 100;
        for (let i = 0; i < pushMessages.length; i += expoChunkSize) {
          const chunk = pushMessages.slice(i, i + expoChunkSize);
          const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunk),
          });
          const expoJson = await expoRes.json().catch(() => null);
          console.log('[BROADCAST EXPO API]', expoJson);
        }
      }

      Alert.alert('Success', `Broadcast successfully sent to ${targetUsers.length} user(s) (${pushTokens.length} push tokens).`);
      
      // Clear inputs
      setTitle('');
      setBody('');
      setSelectedUsers([]);
    } catch (error: any) {
      console.error('Broadcast error:', error);
      Alert.alert('Error', error.message || 'Failed to send broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Push Broadcasts</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TARGET AUDIENCE</Text>
          
          <View style={styles.segmentControl}>
            <TouchableOpacity 
              style={[styles.segmentBtn, targetType === 'all' && styles.segmentActive]}
              onPress={() => setTargetType('all')}
            >
              <Users size={18} color={targetType === 'all' ? colors.background : colors.textSecondary} />
              <Text style={[styles.segmentText, targetType === 'all' && styles.segmentTextActive]}>All Users</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.segmentBtn, targetType === 'specific' && styles.segmentActive]}
              onPress={() => setTargetType('specific')}
            >
              <User size={18} color={targetType === 'specific' ? colors.background : colors.textSecondary} />
              <Text style={[styles.segmentText, targetType === 'specific' && styles.segmentTextActive]}>Specific User</Text>
            </TouchableOpacity>
          </View>

          {targetType === 'specific' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Target Users</Text>
              <TouchableOpacity 
                style={styles.selectUsersBtn}
                onPress={() => setUsersModalVisible(true)}
              >
                <Text style={selectedUsers.length > 0 ? styles.selectUsersBtnText : styles.selectUsersBtnPlaceholder}>
                  {selectedUsers.length > 0 ? `${selectedUsers.length} user(s) selected` : 'Tap to select users...'}
                </Text>
                <ChevronLeft size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notification Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. New Feature Released!"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Message Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Type your message here..."
              placeholderTextColor={colors.placeholder}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity 
            style={[styles.sendBtn, (!title || !body || (targetType === 'specific' && selectedUsers.length === 0) || isSending) && styles.sendBtnDisabled]} 
            onPress={handleSend}
            disabled={!title || !body || (targetType === 'specific' && selectedUsers.length === 0) || isSending}
          >
            {isSending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Send size={18} color={colors.background} />
                <Text style={styles.sendBtnText}>Send Notification</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Users Selection Modal */}
      <Modal visible={usersModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUsersModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setUsersModalVisible(false)} style={styles.modalCloseBtn}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Users</Text>
            <TouchableOpacity onPress={() => setSelectedUsers(adminUsers?.map(u => u.id) || [])}>
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {isLoadingUsers ? (
            <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={adminUsers?.filter(u => 
                u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                u.email?.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isSelected = selectedUsers.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.userRow, isSelected && styles.userRowSelected]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedUsers(prev => prev.filter(id => id !== item.id));
                      } else {
                        setSelectedUsers(prev => [...prev, item.id]);
                      }
                    }}
                  >
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{item.name?.substring(0, 2).toUpperCase() || 'U'}</Text>
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name || 'Unknown User'}</Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                    {isSelected ? (
                      <CheckCircle2 size={24} color="#34C759" />
                    ) : (
                      <Circle size={24} color={colors.border} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
          
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity 
              style={styles.doneBtn}
              onPress={() => setUsersModalVisible(false)}
            >
              <Text style={styles.doneBtnText}>Done ({selectedUsers.length} Selected)</Text>
            </TouchableOpacity>
          </View>
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
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 16,
    letterSpacing: 1,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  segmentActive: {
    backgroundColor: colors.text,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.background,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  sendBtn: {
    backgroundColor: '#AF52DE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  selectUsersBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectUsersBtnText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  selectUsersBtnPlaceholder: {
    fontSize: 16,
    color: colors.placeholder,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  selectAllText: {
    fontSize: 16,
    color: '#AF52DE',
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userRowSelected: {
    backgroundColor: 'rgba(175, 82, 222, 0.05)',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(175, 82, 222, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#AF52DE',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  doneBtn: {
    backgroundColor: '#AF52DE',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
