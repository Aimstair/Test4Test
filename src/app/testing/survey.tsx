import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronLeft, Image as ImageIcon, Send, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubmitFinalSurvey } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';

export default function FinalSurvey() {
  const router = useRouter();
  const { contractId, dayId } = useLocalSearchParams<{ contractId: string, dayId: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { showAlert } = useCustomAlert();

  const { mutate: submitSurvey, isPending } = useSubmitFinalSurvey();

  const [rating, setRating] = useState(0);
  const [bugs, setBugs] = useState('');
  const [general, setGeneral] = useState('');
  
  const [proofImage, setProofImage] = useState<{ uri: string, base64: string, ext: string } | null>(null);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
      exif: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const exif = result.assets[0].exif as any;
      if (exif && (exif.DateTimeOriginal || exif.DateTime)) {
         const dateStr = exif.DateTimeOriginal || exif.DateTime;
         const imgDate = dateStr.substring(0, 10).replace(/:/g, '-');
         const todayDate = new Date().toISOString().substring(0, 10);
         
         if (dateStr.includes(':') && imgDate !== todayDate) {
            showAlert('Invalid Proof', 'This screenshot was not taken today. Please take a fresh screenshot.');
            return;
         }
      }
      
      const ext = result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpeg';
      setProofImage({ uri: result.assets[0].uri, base64: result.assets[0].base64, ext });
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showAlert('Rating Required', 'Please provide a star rating for the app.');
      return;
    }
    if (!proofImage) {
      showAlert('Proof Required', 'Please upload your Day 14 screenshot proof.');
      return;
    }

    try {
      const filename = `day14_${contractId}_${Date.now()}.${proofImage.ext}`;
      const filePath = `proofs/${filename}`;

      const { error } = await supabase.storage
        .from('public-assets')
        .upload(filePath, decode(proofImage.base64), {
          contentType: `image/${proofImage.ext === 'png' ? 'png' : 'jpeg'}`,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      submitSurvey({
        contractId,
        dayId,
        proofUrl: publicUrl,
        feedback: { rating, bugs, general }
      }, {
        onSuccess: () => {
          showAlert('Contract Completed!', 'You finished the 14-day test! +1 Karma earned.');
          router.back();
        },
        onError: (err: any) => showAlert('Error', err.message)
      });
    } catch (err: any) {
      showAlert('Upload Failed', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>Day 14 Final Survey</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>Congratulations! 🎉</Text>
          <Text style={styles.heroSub}>You've reached Day 14. Before you claim your final Karma, please leave feedback for the developer.</Text>
        </View>

        <Text style={styles.sectionTitle}>1. OVERALL RATING</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Star size={40} color={star <= rating ? colors.primary : colors.border} fill={star <= rating ? colors.primary : "transparent"} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>2. BUGS FOUND (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          placeholder="Did you encounter any crashes or bugs during the 14 days?"
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          value={bugs}
          onChangeText={setBugs}
        />

        <Text style={styles.sectionTitle}>3. GENERAL FEEDBACK (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, { height: 100 }]}
          placeholder="What did you like? What could be improved?"
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          value={general}
          onChangeText={setGeneral}
        />

        <Text style={styles.sectionTitle}>4. DAY 14 SCREENSHOT PROOF</Text>
        <TouchableOpacity style={styles.imagePlaceholder} onPress={handlePickImage}>
          {proofImage ? (
            <Image source={{ uri: proofImage.uri }} style={styles.proofImage} />
          ) : (
            <>
              <Camera size={32} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>UPLOAD SCREENSHOT</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.submitBtn, (!proofImage || rating === 0) && styles.submitBtnDisabled]} 
          onPress={handleSubmit}
          disabled={isPending || !proofImage || rating === 0}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={20} color="#fff" />
              <Text style={styles.submitBtnText}>SUBMIT AND COMPLETE CONTRACT</Text>
            </>
          )}
        </TouchableOpacity>
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
  },
  heroBlock: {
    backgroundColor: isDark ? 'rgba(10, 132, 255, 0.1)' : '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 14,
    height: 80,
    marginBottom: 24,
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
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
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
  },
});
