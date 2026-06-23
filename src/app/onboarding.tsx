import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { decode } from 'base64-arraybuffer';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import * as Localization from 'expo-localization';
import { useRouter } from 'expo-router';
import { Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Image as RNImage, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../api/auth';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeContext';

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID',
});

export default function Onboarding() {
  const router = useRouter();
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [joinedGroup, setJoinedGroup] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editAvatarBase64, setEditAvatarBase64] = useState('');
  const [deviceInfo, setDeviceInfo] = useState({ os: '', device: '', country: '' });
  const [isUploading, setIsUploading] = useState(false);
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const insets = useSafeAreaInsets();

  const handleNext = async () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      if (isUploading) return;
      setIsUploading(true);

      // Mark user as onboarded in DB
      const userId = session?.user?.id || authUser?.id;
      if (userId) {
        let finalAvatarUrl = editAvatar;

        if (editAvatarBase64) {
          try {
            const ext = editAvatar.split('.').pop()?.toLowerCase() || 'jpeg';
            const filename = `${userId}_avatar_${Date.now()}.${ext}`;
            const filePath = `avatars/${filename}`;

            const { error } = await supabase.storage
              .from('public-assets')
              .upload(filePath, decode(editAvatarBase64), {
                contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
              });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
              .from('public-assets')
              .getPublicUrl(filePath);

            finalAvatarUrl = publicUrl;
          } catch (err: any) {
            console.error('Avatar upload failed:', err.message);
          }
        }

        await supabase.from('users').update({
          onboarded: true,
          name: editName,
          device: deviceInfo.device,
          os: deviceInfo.os,
          country: deviceInfo.country,
          ...(finalAvatarUrl ? { avatar_url: finalAvatarUrl } : {})
        }).eq('id', userId);
      }
      setIsUploading(false);
      router.replace('/(tabs)/dashboard');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setEditAvatar(result.assets[0].uri);
      setEditAvatarBase64(result.assets[0].base64);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoadingAuth(true);
    console.log('Using Web Client ID:', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo: any = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken || userInfo?.idToken;

      if (!idToken) {
        throw new Error('No ID token present!');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (sessionError) throw sessionError;

      if (sessionData.user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('onboarded')
          .eq('id', sessionData.user.id)
          .single();

        if (existingUser?.onboarded) {
          router.replace('/(tabs)/dashboard');
          return;
        }

        const initialName = sessionData.user.user_metadata?.full_name || 'Tester';

        // Get Device Info
        const os = Device.osName ? `${Device.osName} ${Device.osVersion}` : 'Unknown OS';
        const deviceName = Device.modelName || 'Unknown Device';
        const country = Localization.getLocales()[0]?.regionCode || 'Unknown Country';

        setDeviceInfo({ os, device: deviceName, country });

        await supabase.from('users').upsert({
          id: sessionData.user.id,
          name: initialName,
          device: deviceName,
          os: os,
          country: country
        });

        setAuthUser(sessionData.user);
        setEditName(initialName);
        setStep(2);
      }
    } catch (error: any) {
      if (error.code === 'SIGN_IN_CANCELLED') {
        // user cancelled the login flow
      } else if (error.code === 'IN_PROGRESS') {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        alert('Play services are not available or outdated.');
      } else {
        alert('Auth Error: ' + error.message);
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  const renderProgressBar = () => {
    return (
      <View style={styles.progressRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <View
            key={s}
            style={[styles.progressSegment, step >= s && styles.progressSegmentActive]}
          />
        ))}
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.heroImageContainer}>
        <RNImage
          source={require('../../assets/images/onboarding_1.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>
      {/* <View style={styles.card}>
        <Text style={styles.brandText}>TEST4TEST</Text>
        <Text style={styles.heroTitle}>Real testers. Real sessions. Real rewards.</Text>
      </View> */}

      <View style={styles.checklist}>
        <View style={styles.checkItem}>
          <View style={styles.checkIconBox}>
            <Check size={16} color={colors.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkTitle}>Earn Tokens</Text>
            <Text style={styles.checkTextSmall}>Get paid for testing apps. Spend tokens to list your own apps.</Text>
          </View>
        </View>

        <View style={styles.checkItem}>
          <View style={styles.checkIconBox}>
            <Check size={16} color={colors.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkTitle}>Build Karma</Text>
            <Text style={styles.checkTextSmall}>Karma is your reputation. Check in daily for +1, miss a day and lose -2.</Text>
          </View>
        </View>

        <View style={styles.checkItem}>
          <View style={styles.checkIconBox}>
            <Check size={16} color={colors.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkTitle}>14-Day Commitment</Text>
            <Text style={styles.checkTextSmall}>Real testers, real sessions. Upload a daily screenshot as proof.</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleGoogleSignIn} disabled={loadingAuth}>
          <Text style={styles.btnTextWhite}>{loadingAuth ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Confirm your profile</Text>
        <Text style={styles.subtitle}>Auto-detected from your Google account.</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <TouchableOpacity style={styles.avatarBox} onPress={pickImage}>
            {editAvatar ? (
              <RNImage source={{ uri: editAvatar }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <Text style={styles.avatarInitials}>
                {(editName || 'T')[0].toUpperCase()}
              </Text>
            )}
            <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: colors.primary, borderRadius: 10, padding: 2 }}>
              <Camera size={10} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <TextInput
              style={[styles.profileName, { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 0 }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your Name"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.profileLoc}>
              {authUser?.email || session?.user?.email || ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Terms & Finish Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Info Captured</Text>
        <Text style={styles.cardDesc}>
          We detect your device data to better match you with relevant app tests.
        </Text>

        <View style={styles.deviceInfoBox}>
          <Text style={styles.deviceInfoText}>Device: {deviceInfo.device}</Text>
          <Text style={styles.deviceInfoText}>OS: {deviceInfo.os}</Text>
          <Text style={styles.deviceInfoText}>Country: {deviceInfo.country}</Text>
        </View>

        <Text style={[styles.cardDesc, { marginTop: 16, fontSize: 13 }]}>
          By tapping "Complete Profile", you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleNext}>
          <Text style={styles.btnTextWhite}>CONFIRM PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Join the Master Group</Text>
        <Text style={styles.subtitle}>One Google Group covers every test. Devs add a single email to Play Console — your address stays private.</Text>
      </View>

      <View style={styles.emailCard}>
        <Text style={styles.statLabel}>GROUP EMAIL</Text>
        <Text style={styles.emailText}>test4test-community@googlegroups.com</Text>
      </View>

      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => Linking.openURL('https://groups.google.com/u/2/g/test4test-community')}
      >
        <Text style={styles.btnTextWhite}>OPEN GOOGLE GROUP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setJoinedGroup(!joinedGroup)}
      >
        <View style={styles.checkbox}>
          {joinedGroup && <Check size={14} color={colors.text} />}
        </View>
        <Text style={styles.checkboxText}>I confirm I have joined the Master Google Group.</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnPrimary, !joinedGroup && styles.btnDisabled]}
          disabled={!joinedGroup}
          onPress={handleNext}
        >
          <Text style={[styles.btnTextWhite, !joinedGroup && styles.btnTextDisabled]}>CONTINUE {'>'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleIntentSelection = async (intent: 'tester' | 'developer') => {
    await AsyncStorage.setItem('user_primary_intent', intent);
    setStep(5);
  };

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>What's your primary goal?</Text>
        <Text style={styles.subtitle}>
          This helps us customize your first experience. You can always do both!
        </Text>
      </View>

      <TouchableOpacity
        style={styles.intentCard}
        onPress={() => handleIntentSelection('tester')}
        activeOpacity={0.8}
      >
        <Text style={styles.intentEmoji}>🧪</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.intentTitle}>I want to test apps</Text>
          <Text style={styles.intentDesc}>Test apps daily, earn Tokens, and build your Karma.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.intentCard}
        onPress={() => handleIntentSelection('developer')}
        activeOpacity={0.8}
      >
        <Text style={styles.intentEmoji}>🚀</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.intentTitle}>I need testers</Text>
          <Text style={styles.intentDesc}>List your app, reach 20 testers, and graduate to production.</Text>
        </View>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>The Daily Proof</Text>
        <Text style={styles.subtitle}>
          To verify you actually tested an app, you must upload a daily screenshot.
        </Text>
      </View>

      <View style={styles.proofExampleCard}>
        <View style={styles.proofImgPlaceholder}>
          <Text style={styles.proofImgText}>📱 Mock Screenshot</Text>
        </View>
        <View style={styles.proofRules}>
          <Text style={styles.proofRuleValid}>✅ App must be visibly open</Text>
          <Text style={styles.proofRuleValid}>✅ Status bar must show today's time/date</Text>
          <Text style={styles.proofRuleInvalid}>❌ No home screen screenshots</Text>
          <Text style={styles.proofRuleInvalid}>❌ No duplicate screenshots</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why it matters</Text>
        <Text style={styles.cardDesc}>
          Developers review your proofs. Valid proofs earn you Tokens. Invalid proofs are rejected, which hurts your Karma.
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleNext}>
          <Text style={styles.btnTextWhite}>START EXPLORING</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {renderProgressBar()}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerArea: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  heroImageContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageContainerAlt: {
    width: '100%',
    height: 180,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },

  // Step 1 Specific
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  brandText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 12,
    color: colors.primary,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 40,
  },
  checklist: {
    gap: 12,
    marginBottom: 32,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkIconBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderRadius: 4,
  },
  checkText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  checkTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  checkTextSmall: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Step 2 Specific
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: isDark ? '#1C3322' : '#E5F1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: isDark ? '#22C55E' : '#000',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  profileLoc: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  profileDivider: {
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  profileBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileStat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  avatarPlaceholderText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceInfoBox: {
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  deviceInfoText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'monospace',
    marginBottom: 4,
  },

  // Step 3 Specific
  emailCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  btnYellow: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primary,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnTextBlack: {
    color: isDark ? '#000' : '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  btnDisabled: {
    backgroundColor: colors.border,
  },
  btnTextDisabled: {
    color: colors.placeholder,
  },

  // Step 4 Specific
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  karmaCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: isDark ? '#1C3322' : '#E1F0FF',
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  karmaPlus: {
    position: 'absolute',
    left: 30,
    top: 70,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  karmaNumber: {
    fontSize: 80,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -2,
    marginTop: -20,
  },
  karmaLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginTop: 10,
  },
  titleCenter: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: -1,
  },
  subtitleCenter: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Common UI
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  btnBlack: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stubText: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1,
    fontWeight: '600',
  },

  // New Step 4 Specific
  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: isDark ? 'rgba(10, 132, 255, 0.3)' : '#C7E0FF',
    marginBottom: 16,
  },
  intentEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  intentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  intentDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // New Step 5 Specific
  proofExampleCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  proofImgPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  proofImgText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  proofRules: {
    gap: 8,
  },
  proofRuleValid: {
    fontSize: 14,
    color: isDark ? '#32D74B' : '#34C759',
    fontWeight: '600',
  },
  proofRuleInvalid: {
    fontSize: 14,
    color: isDark ? '#FF453A' : '#FF3B30',
    fontWeight: '600',
  },
});
