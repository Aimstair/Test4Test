import { decode } from 'base64-arraybuffer';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, Image as ImageIcon, Coins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Image as RNImage, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../api/auth';
import { useCatalog, useCreateApp, useRenewApp, useUserProfile } from '../../api/queries';
import { useCustomAlert } from '../../components/AlertProvider';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeContext';

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

export default function NewApp() {
  const router = useRouter();
  const { renewAppId, presetAppType } = useLocalSearchParams();
  const { session } = useAuth();
  const { showAlert } = useCustomAlert();
  const { data: userProfile } = useUserProfile(session?.user?.id);
  const { data: catalogData } = useCatalog();
  const { mutate: createApp, isPending: isCreating } = useCreateApp();
  const { mutate: renewApp, isPending: isRenewing } = useRenewApp();
  const isPending = isCreating || isRenewing;
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const subscriptionTier = userProfile?.subscription_tier || 'Basic';

  const [name, setName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [url, setUrl] = useState('');
  const [tier, setTier] = useState<'Basic' | 'Pro' | 'Pro+'>('Basic');
  const [bounty, setBounty] = useState(5);
  const [geo, setGeo] = useState('Global');
  const [geoSpecific, setGeoSpecific] = useState('US');
  const [addedEmail, setAddedEmail] = useState(false);
  const [appType, setAppType] = useState<'Testing' | 'Production'>('Testing');
  const [iconUrl, setIconUrl] = useState('');
  const [iconBase64, setIconBase64] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Dynamic cost calculation
  let displayTesterLimit = appType === 'Production' ? 24 : 12;
  let displayAppBounty = 5;
  let tokenCost = 80;
  if (tier === 'Pro') { displayTesterLimit = appType === 'Production' ? 50 : 25; tokenCost = 150; displayAppBounty = 10; }
  if (tier === 'Pro+') { displayTesterLimit = appType === 'Production' ? 100 : 50; tokenCost = 300; displayAppBounty = 20; }
  if (subscriptionTier === 'Pro+' || (subscriptionTier === 'Pro' && (tier === 'Basic' || tier === 'Pro'))) {
    tokenCost = 0;
  }

  // Active apps limits
  let activeAppLimit = 1;
  if (subscriptionTier === 'Pro') activeAppLimit = 3;
  if (subscriptionTier === 'Pro+') activeAppLimit = 5;

  const activeAppsCount = catalogData?.filter((app: any) => app.owner_id === session?.user?.id && app.active !== false).length || 0;

  // Automatically extract package name from URL if possible
  useEffect(() => {
    if (url && !renewAppId) {
      const match = url.match(/(?:id=|testing\/)([a-zA-Z0-9_.]+)/);
      if (match && match[1]) {
        setPackageName(match[1]);
      }
    }
  }, [url, renewAppId]);

  // Pre-fill form if renewing
  useEffect(() => {
    if (presetAppType && (presetAppType === 'Testing' || presetAppType === 'Production')) {
      setAppType(presetAppType as any);
    }
    if (renewAppId && catalogData) {
      const existingApp = catalogData.find((a: any) => a.id === renewAppId);
      if (existingApp) {
        setName(existingApp.name);
        setPackageName(existingApp.package_name);
        setBlurb(existingApp.blurb || '');
        setUrl(existingApp.internal_test_url || '');
        setIconUrl(existingApp.icon_url || '');
        setAddedEmail(true);
      }
    }
  }, [renewAppId, presetAppType, catalogData]);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastOpacity] = useState(new Animated.Value(0));

  const handleCopyEmail = async () => {
    await Clipboard.setStringAsync('test4test-community@googlegroups.com');
    setShowToast(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setShowToast(false));
  };

  const handlePickIcon = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setIconUrl(result.assets[0].uri);
      setIconBase64(result.assets[0].base64);
    }
  };

  const handlePublish = async () => {
    if (isPending || isUploading) return;

    if (!iconUrl) {
      showAlert('Missing Info', 'Please upload an app icon.');
      return;
    }
    if (!name.trim()) {
      showAlert('Missing Info', 'Please enter an app name.');
      return;
    }
    if (!packageName.trim()) {
      showAlert('Missing Info', 'Please enter the Android Package Name.');
      return;
    }

    if (!renewAppId) {
      const packageExists = catalogData?.some(
        (app: any) => app.package_name?.trim().toLowerCase() === packageName.trim().toLowerCase()
      );
      if (packageExists) {
        showAlert('Package Name Taken', 'This package name is already taken by another user. Google Play requires unique package names.');
        return;
      }
    }
    if (!blurb.trim()) {
      showAlert('Missing Info', 'Please enter a description.');
      return;
    }
    if (!url.trim().startsWith('http')) {
      showAlert('Missing Info', 'Please enter a valid Play Console Opt-in URL starting with http.');
      return;
    }
    if (!addedEmail) {
      showAlert('Action Required', 'You must confirm that you have added the group email to your testers list.');
      return;
    }

    let isCurrentAppActive = false;
    if (renewAppId && catalogData) {
      const existingApp = catalogData.find((a: any) => a.id === renewAppId);
      if (existingApp?.active !== false) {
        isCurrentAppActive = true;
      }
    }

    if (!isCurrentAppActive && activeAppsCount >= activeAppLimit) {
      showAlert('Limit Reached', `Your ${subscriptionTier} tier only allows ${activeAppLimit} active app${activeAppLimit === 1 ? '' : 's'}. Please upgrade your subscription or delist an existing app.`);
      return;
    }

    if ((userProfile?.tokens || 0) < tokenCost) {
      setIsUploading(false);
      setShowTokenModal(true);
      return;
    }

    setIsUploading(true);
    let finalIconUrl = iconUrl;

    if (iconBase64) {
      try {
        const ext = iconUrl.split('.').pop()?.toLowerCase() || 'jpeg';
        const filename = `${session?.user?.id}_${Date.now()}.${ext}`;
        const filePath = `icons/${filename}`;

        const { error } = await supabase.storage
          .from('public-assets')
          .upload(filePath, decode(iconBase64), {
            contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        finalIconUrl = publicUrl;
      } catch (err: any) {
        setIsUploading(false);
        showAlert('Upload Failed', err.message);
        return;
      }
    }

    if (renewAppId) {
      renewApp({
        appId: renewAppId as string,
        tier,
        tester_limit: displayTesterLimit,
        bounty: displayAppBounty,
        tokenCost,
        owner_id: session?.user?.id as string,
        subscriptionTier,
        app_type: appType,
      }, {
        onSuccess: () => {
          setIsUploading(false);
          router.replace('/(tabs)/studio');
        },
        onError: (err: any) => {
          setIsUploading(false);
          showAlert('Failed to renew app', err.message);
        }
      });
    } else {
      createApp({
        appData: {
          name: name.trim(),
          package_name: packageName.trim(),
          icon_url: finalIconUrl,
          blurb: blurb.trim(),
          bounty: displayAppBounty,
          tier,
          tester_limit: displayTesterLimit,
          geo_targets: geo === 'Specific' ? [geoSpecific] : ['Global'],
          os_requirements: ['Android'],
          internal_test_url: url.trim(),
          owner_id: session?.user?.id,
          app_type: appType,
        },
        tokenCost,
        subscriptionTier,
      }, {
        onSuccess: () => {
          setIsUploading(false);
          router.replace('/(tabs)/studio');
        },
        onError: (err: any) => {
          setIsUploading(false);
          showAlert('Failed to create app', err.message);
        }
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
          <Text style={styles.backText}>{renewAppId ? 'Renew Listing' : 'Build'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.label}>APP TYPE</Text>
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, appType === 'Testing' && styles.segmentBtnActive]}
            onPress={() => setAppType('Testing')}
          >
            <Text style={[styles.segmentText, appType === 'Testing' && styles.segmentTextActive]}>14-Day Testing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, appType === 'Production' && styles.segmentBtnActive]}
            onPress={() => setAppType('Production')}
          >
            <Text style={[styles.segmentText, appType === 'Production' && styles.segmentTextActive]}>Production (ASO)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>APP ICON</Text>
        <TouchableOpacity style={styles.iconUploadBox} onPress={handlePickIcon} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : iconUrl ? (
            <RNImage source={{ uri: iconUrl }} style={styles.iconPreview} />
          ) : (
            <>
              <ImageIcon size={32} color={colors.textSecondary} />
              <Text style={styles.iconUploadText}>Upload Icon</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, marginTop: 16 }}>
          <Text style={[styles.label, { marginBottom: 0, marginTop: 0 }]}>APP NAME</Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '800' }}>{name.length}/30</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="MyApp"
          placeholderTextColor={colors.placeholder}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

        <Text style={styles.label}>ANDROID PACKAGE NAME</Text>
        <TextInput
          editable={false}
          selectTextOnFocus={false}
          style={[styles.input, { opacity: 0.7 }]}
          placeholder="com.company.app (auto-filled from URL)"
          placeholderTextColor={colors.placeholder}
          value={packageName}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, marginTop: 16 }}>
          <Text style={[styles.label, { marginBottom: 0, marginTop: 0 }]}>DESCRIPTION</Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '800' }}>{blurb.length}/50</Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What does it do?"
          placeholderTextColor={colors.placeholder}
          value={blurb}
          onChangeText={setBlurb}
          multiline
          maxLength={50}
        />

        <Text style={styles.label}>{appType === 'Production' ? 'PLAY STORE APP URL' : 'PLAY CONSOLE OPT-IN ANDROID URL'}</Text>
        <TextInput
          style={styles.input}
          placeholder="https://play.google.com/store/..."
          placeholderTextColor={colors.placeholder}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
        />

        <Text style={styles.label}>TIER & DURATION</Text>
        <View style={styles.tierRow}>
          <TouchableOpacity
            style={[styles.tierCard, tier === 'Basic' && styles.tierCardActive]}
            onPress={() => setTier('Basic')}
          >
            <Text style={[styles.tierTitle, tier === 'Basic' && styles.tierTextActive]}>Basic</Text>
            <Text style={[styles.tierSub, tier === 'Basic' && styles.tierTextActive]}>12 TESTERS</Text>
            <Text style={[styles.tierSub, tier === 'Basic' && styles.tierTextActive]}>{appType === 'Production' ? '7 DAYS' : subscriptionTier === 'Pro+' ? 'UNLIMITED' : '14 DAYS'}</Text>
            <Text style={[styles.tierSub2, tier === 'Basic' && styles.tierTextActive, subscriptionTier === 'Pro+' || subscriptionTier === 'Pro' ? styles.freeText : {}]}>
              {subscriptionTier === 'Pro+' || subscriptionTier === 'Pro' ? 'Free' : '80 tokens'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tierCard, tier === 'Pro' && styles.tierCardActive]}
            onPress={() => setTier('Pro')}
          >
            <Text style={[styles.tierTitle, tier === 'Pro' && styles.tierTextActive]}>Pro</Text>
            <Text style={[styles.tierSub, tier === 'Pro' && styles.tierTextActive]}>25 TESTERS</Text>
            <Text style={[styles.tierSub, tier === 'Pro' && styles.tierTextActive]}>{appType === 'Production' ? '7 DAYS' : subscriptionTier === 'Pro+' ? 'UNLIMITED' : '20 DAYS'}</Text>
            <Text style={[styles.tierSub2, tier === 'Pro' && styles.tierTextActive, subscriptionTier === 'Pro+' || subscriptionTier === 'Pro' ? styles.freeText : {}]}>
              {subscriptionTier === 'Pro+' || subscriptionTier === 'Pro' ? 'Free' : '150 tokens'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tierCard, tier === 'Pro+' && styles.tierCardActive]}
            onPress={() => setTier('Pro+')}
          >
            <Text style={[styles.tierTitle, tier === 'Pro+' && styles.tierTextActive]}>Pro+</Text>
            <Text style={[styles.tierSub, tier === 'Pro+' && styles.tierTextActive]}>50 TESTERS</Text>
            <Text style={[styles.tierSub, tier === 'Pro+' && styles.tierTextActive]}>{appType === 'Production' ? '7 DAYS' : subscriptionTier === 'Pro+' ? 'UNLIMITED' : '30 DAYS'}</Text>
            <Text style={[styles.tierSub2, tier === 'Pro+' && styles.tierTextActive, subscriptionTier === 'Pro+' ? styles.freeText : {}]}>
              {subscriptionTier === 'Pro+' ? 'Free' : '300 tokens'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>GOOGLE PLAY CONSOLE SETUP</Text>
        <View style={styles.checklistCard}>

          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
            To quickly add our community of testers, paste the Google Group email below into your Play Console's email list for this track:
          </Text>

          <RNImage 
            source={require('../../../assets/images/tester_googlegroup.jpg')} 
            style={{ width: '100%', height: 160, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
            resizeMode="cover"
          />

          <TouchableOpacity style={styles.copyBox} onPress={handleCopyEmail} activeOpacity={0.7}>
            <Text style={styles.copyEmail}>test4test-community@googlegroups.com</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAddedEmail(!addedEmail)}
          >
            <View style={[styles.checkbox, addedEmail && styles.checkboxActive]}>
              {addedEmail && <Check size={14} color={colors.background} />}
            </View>
            <Text style={styles.checkboxText}>I have added this email to my testers</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>GEO TARGETING</Text>
        <View style={styles.radioGroup}>
          {['Global', 'Specific'].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.radioItem, geo === opt && styles.radioItemActive]}
              onPress={() => setGeo(opt)}
            >
              <View style={[styles.radioCircle, geo === opt && styles.radioCircleActive]}>
                {geo === opt && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioText, geo === opt && { color: '#000' }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {geo === 'Specific' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryList}>
            {COUNTRIES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={[styles.countryItem, geoSpecific === c.code && styles.countryItemActive]}
                onPress={() => setGeoSpecific(c.code)}
              >
                <Text style={styles.countryFlag}>{c.flag}</Text>
                <Text style={[styles.countryName, geoSpecific === c.code && styles.countryNameActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.publishBtn} onPress={handlePublish} disabled={isPending}>
          {isPending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.publishBtnText}>PUBLISH LISTING • {tokenCost} TOKENS</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showTokenModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%', maxWidth: 400 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', padding: 12, borderRadius: 24, marginRight: 12 }}>
                <Coins size={28} color="#eab308" />
              </View>
              <Text style={[styles.modalTitle, { marginBottom: 0, fontSize: 22 }]}>Insufficient Tokens</Text>
            </View>
            
            <Text style={[styles.modalText, { fontSize: 16, textAlign: 'center' }]}>
              You need <Text style={{fontWeight: '800', color: colors.text}}>{tokenCost} Tokens</Text> to publish this app. You currently have <Text style={{fontWeight: '800', color: colors.text}}>{userProfile?.tokens || 0}</Text>.
            </Text>
            <Text style={[styles.modalText, { fontSize: 16, textAlign: 'center' }]}>
              Test apps in the Catalog to earn Tokens for FREE, or buy them from the store.
            </Text>
            
            <View style={{ flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <TouchableOpacity 
                style={[styles.modalBtnGo, { flex: 0, paddingVertical: 16, borderRadius: 12 }]} 
                onPress={() => { setShowTokenModal(false); router.push('/catalog'); }}
              >
                <Text style={[styles.modalBtnTextGo, { fontSize: 16 }]}>Test Apps (Earn Free Tokens)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtnGo, { flex: 0, paddingVertical: 16, borderRadius: 12, backgroundColor: isDark ? '#333' : '#E5E5EA' }]} 
                onPress={() => { setShowTokenModal(false); router.push('/pricing'); }}
              >
                <Text style={[styles.modalBtnTextGo, { color: colors.text, fontSize: 16 }]}>Buy Tokens from Store</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtnCancel, { flex: 0, paddingVertical: 16, borderRadius: 12, backgroundColor: 'transparent' }]} 
                onPress={() => setShowTokenModal(false)}
              >
                <Text style={[styles.modalBtnTextCancel, { fontSize: 16, color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>Email successfully copied!</Text>
        </Animated.View>
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
    paddingTop: 60,
    paddingHorizontal: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
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
    padding: 12,
    paddingBottom: 80,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
  },
  iconUploadBox: {
    height: 100,
    width: 100,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  iconPreview: {
    width: '100%',
    height: '100%',
  },
  iconUploadText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tierCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.text,
    padding: 12,
    borderRadius: 4,
  },
  tierCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  tierSub: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  tierSub2: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '800',
    marginTop: 8,
  },
  freeText: {
    color: colors.success,
    fontWeight: '900',
    fontSize: 12,
  },
  tierTextActive: {
    color: '#fff',
  },
  radioGroup: {
    gap: 8,
    marginBottom: 12,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  radioItemActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: colors.card,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  checklistCard: {
    backgroundColor: isDark ? '#1F1A00' : '#FFF4CE',
    borderWidth: 1,
    borderColor: isDark ? '#997A00' : '#FFCC00',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  copyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#332900' : '#FFE58F',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  copyEmail: {
    fontFamily: 'monospace',
    fontWeight: '800',
    color: isDark ? '#fff' : '#000',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#D4AA00',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: colors.card,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    fontSize: 14,
    color: isDark ? '#fff' : '#000',
    fontWeight: '600',
  },
  countryList: {
    marginTop: 8,
    paddingBottom: 8,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  countryItemActive: {
    backgroundColor: isDark ? '#1C2B36' : '#E5F1FF',
    borderColor: colors.primary,
  },
  countryFlag: {
    fontSize: 16,
    marginRight: 8,
  },
  countryName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  countryNameActive: {
    color: colors.primary,
  },
  publishBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  modalBtnTextCancel: {
    color: colors.text,
    fontWeight: '700',
  },
  modalBtnGo: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalBtnTextGo: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '600',
  }
});
