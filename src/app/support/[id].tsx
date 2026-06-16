import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, ShieldCheck, User } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useReplyToTicket, useSupportTickets, useTicketReplies } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import { useTheme } from '../../theme/ThemeContext';

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const scrollViewRef = useRef<ScrollView>(null);

  const { data: tickets, isLoading: isLoadingTicket } = useSupportTickets(session?.user?.id);
  const ticket = tickets?.find(t => t.id === id);

  const { data: replies, isLoading: isLoadingReplies } = useTicketReplies(id);
  const { mutate: sendReply, isPending: isSending } = useReplyToTicket();

  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim() || !session?.user?.id) return;

    sendReply({
      ticket_id: id as string,
      sender_id: session.user.id,
      message: message.trim()
    }, {
      onSuccess: () => {
        setMessage('');
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      },
      onError: (err: any) => {
        showAlert('Error', err.message);
      }
    });
  };

  if (isLoadingTicket || isLoadingReplies) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Ticket not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Ticket #{ticket.id.slice(0, 6).toUpperCase()}</Text>
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{ticket.status.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.ticketCard}>
          <Text style={styles.ticketTitle}>{ticket.title}</Text>
          <Text style={styles.ticketCategory}>{ticket.category.toUpperCase()} • {new Date(ticket.created_at).toLocaleString()}</Text>
          <Text style={styles.ticketDesc}>{ticket.description}</Text>
        </View>

        <View style={styles.divider} />

        {replies?.map((reply) => {
          const isMe = reply.sender_id === session?.user?.id;
          const isAdmin = reply.sender?.role === 'admin';
          return (
            <View key={reply.id} style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
              {!isMe && (
                reply.sender?.avatar_url ? (
                  <Image source={{ uri: reply.sender.avatar_url }} style={[styles.avatarImage, isAdmin && styles.avatarAdmin]} />
                ) : (
                  <View style={[styles.avatar, isAdmin && styles.avatarAdmin]}>
                    {isAdmin ? <ShieldCheck size={16} color="#fff" /> : <User size={16} color="#fff" />}
                  </View>
                )
              )}
              <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
                <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                  {reply.message}
                </Text>
                <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeOther]}>
                  {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {ticket.status !== 'closed' && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !message.trim() && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={!message.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
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
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  ticketCard: {
    marginBottom: 20,
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  ticketCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  ticketDesc: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  avatarAdmin: {
    backgroundColor: colors.primary,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#fff',
  },
  messageTextOther: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageTimeOther: {
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
