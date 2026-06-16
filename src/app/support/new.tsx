import { useRouter } from 'expo-router';
import { AlertCircle, ChevronLeft, HelpCircle, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../api/auth';
import { useCreateTicket } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import { useTheme } from '../../theme/ThemeContext';

const CATEGORIES = [
  { id: 'Bug', label: 'Bug Report', icon: AlertCircle, color: '#FF3B30' },
  { id: 'Feedback', label: 'Feature/Feedback', icon: MessageSquare, color: '#0A84FF' },
  { id: 'General', label: 'General Inquiry', icon: HelpCircle, color: '#34C759' },
  { id: 'Dispute', label: 'Dispute / Billing', icon: AlertCircle, color: '#FF9F0A' },
];

export default function NewSupportTicket() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { mutate: createTicket, isPending } = useCreateTicket();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [category, setCategory] = useState('Bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) {
      showAlert('Missing fields', 'Please enter a title and description.');
      return;
    }

    createTicket({
      user_id: session?.user?.id as string,
      category,
      title: title.trim(),
      description: description.trim()
    }, {
      onSuccess: () => {
        router.back();
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
          <Text style={styles.backText}>New Ticket</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.categoryContainer}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryBtn, isSelected && { borderColor: cat.color, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}
                onPress={() => setCategory(cat.id)}
              >
                <Icon size={20} color={isSelected ? cat.color : colors.textSecondary} />
                <Text style={[styles.categoryText, isSelected && { color: cat.color, fontWeight: '600' }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>TITLE</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of your issue"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        <Text style={styles.label}>DESCRIPTION</Text>
        <View style={[styles.inputContainer, styles.textAreaContainer]}>
          <TextInput
            style={styles.textArea}
            placeholder="Provide as much detail as possible..."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isPending}>
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>SUBMIT TICKET</Text>
          )}
        </TouchableOpacity>
      </View>
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
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 1,
    marginTop: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    width: '48%',
  },
  categoryText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  inputContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    height: 48,
    color: colors.text,
    fontSize: 16,
  },
  textAreaContainer: {
    paddingVertical: 12,
  },
  textArea: {
    height: 150,
    color: colors.text,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
