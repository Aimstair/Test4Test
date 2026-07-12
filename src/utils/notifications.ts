import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

/**
 * Gets the Expo push token for this device and saves it to the user's profile.
 * Must be called after authentication.
 */
export const registerPushToken = async (userId: string) => {
  try {
    if (!Device.isDevice) return; // Push notifications don't work on simulators

    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.log('Push notification permissions not granted.');
      return;
    }

    // Resolve the Expo project ID from app.json > extra.eas.projectId (standard approach)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      process.env.EXPO_PUBLIC_PROJECT_ID;

    if (!projectId) {
      console.warn('registerPushToken: No projectId found. Push tokens will not be registered.');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    if (!token) {
      console.warn('registerPushToken: getExpoPushTokenAsync returned no token.');
      return;
    }

    // Save to database so server-side functions can send pushes
    const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
    if (error) {
      console.warn('registerPushToken: Failed to save token to DB:', error.message);
    } else {
      console.log('Push token registered successfully.');
    }
  } catch (e: any) {
    if (e.message?.includes('FirebaseApp is not initialized')) {
      console.log('Skipping push token registration: google-services.json not configured in app.json.');
    } else {
      console.warn('Failed to register push token:', e);
    }
  }
};

export type NotificationType = 'new_tester' | 'new_review' | 'app_expiry' | 'app_full' | 'daily_reports' | 'subscription' | 'new_proof' | 'check_in' | 'testing_finished' | 'support' | 'report';

const PUSH_FUNCTION_URL = process.env.EXPO_PUBLIC_PUSH_FUNCTION_URL || 'https://dykilozjkathhythocff.supabase.co/functions/v1/send-push';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Sends a notification:
 * 1. Writes to DB for in-app notification bell
 * 2. Sends a real push notification via Expo Push API (Edge Function)
 */
export const sendNotification = async (
  targetUserId: string,
  title: string,
  body: string,
  type: NotificationType,
  currentUserId?: string
) => {
  try {
    // 1. Check user preferences
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_prefs, push_token')
      .eq('id', targetUserId)
      .single();

    if (error) throw error;

    const prefs = user.notification_prefs || {};
    // If explicitly set to false, don't send
    if (prefs[type] === false) {
      return;
    }

    // 2. Save to database for in-app notification bell
    await supabase.from('notifications').insert([{
      user_id: targetUserId,
      title,
      body,
      type
    }]);

    // 3a. Server-side push via Edge Function or direct Expo Push API
    if (user.push_token) {
      if (PUSH_FUNCTION_URL) {
        fetch(PUSH_FUNCTION_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ push_token: user.push_token, title, body, data: { type } }),
        }).catch((e) => console.error('Push send error:', e));
      } else {
        // Direct Expo Push API fallback for development/MVP
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: user.push_token,
            title: title,
            body: body,
            data: { type },
            sound: 'default'
          }),
        }).catch((e) => console.error('Expo Push send error:', e));
      }
    }

    // 3b. Fallback: local immediate notification if sending to self (active device)
    if (!user.push_token && targetUserId === currentUserId) {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { type } },
        trigger: null,
      });
    }
    console.log(`Notification sent to ${targetUserId}`);
  } catch (err: any) {
    console.error('Failed to send notification:', err.message);
  }
};

/**
 * Sends a notification to all admin users.
 */
export const notifyAdmins = async (
  title: string,
  body: string,
  type: NotificationType,
  currentUserId?: string
) => {
  try {
    const { data: admins, error } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');

    if (error) throw error;
    if (!admins || admins.length === 0) return;

    // Send notification to each admin sequentially (or Promise.all)
    await Promise.all(
      admins.map(admin => sendNotification(admin.id, title, body, type, currentUserId))
    );
  } catch (err: any) {
    console.error('Failed to notify admins:', err.message);
  }
};

/**
 * Schedules a local time-based notification (e.g. daily reminders)
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  type: NotificationType,
  trigger: Notifications.NotificationTriggerInput
) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type },
    },
    trigger,
  });
};

export const setupDailyReminders = async (userId: string) => {
  // Cancel all previously scheduled notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Get user preferences
  const { data: user } = await supabase.from('users').select('notification_prefs').eq('id', userId).single();
  const prefs = user?.notification_prefs || {};

  // 1. Daily Reports for App Owners (9:00 AM)
  if (prefs['daily_reports'] !== false) {
    let pendingProofsCount = 0;
    const { data: myApps } = await supabase.from('apps').select('*').eq('owner_id', userId);
    
    if (myApps && myApps.length > 0) {
      const appIds = myApps.map(a => a.id);
      const { data: myContracts } = await supabase.from('contracts').select('id').in('app_id', appIds);
      if (myContracts && myContracts.length > 0) {
        const contractIds = myContracts.map(c => c.id);
        const { count } = await supabase.from('contract_days').select('id', { count: 'exact', head: true }).in('contract_id', contractIds).eq('status', 'pending');
        pendingProofsCount = count || 0;
      }
      
      if (pendingProofsCount > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Pending Proofs Review',
            body: `You have ${pendingProofsCount} new proof${pendingProofsCount > 1 ? 's' : ''} waiting for review. Keep your testers happy by approving them quickly!`,
            data: { type: 'daily_reports' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
          },
        });
      }

      // App Expiration Warning (10:00 AM)
      const activeApps = myApps.filter(a => a.active === true);
      let expiringAppName = null;
      for (const app of activeApps) {
        let effectiveExpiresAt = app.expires_at ? new Date(app.expires_at) : null;
        if (!effectiveExpiresAt && app.created_at) {
          let days = 14;
          if (app.tier === 'Pro') days = 20;
          if (app.tier === 'Pro+') days = 30;
          effectiveExpiresAt = new Date(app.created_at);
          effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + days);
        }
        if (effectiveExpiresAt) {
          const daysLeft = (effectiveExpiresAt.getTime() - Date.now()) / (1000 * 3600 * 24);
          if (daysLeft > 0 && daysLeft <= 2) {
            expiringAppName = app.name;
            break;
          }
        }
      }

      if (expiringAppName) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'App Campaign Expiring',
            body: `Your test for ${expiringAppName} is almost complete! Ready to launch? Convert to a Production (ASO) listing today.`,
            data: { type: 'app_expiry' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 10,
            minute: 0,
          },
        });
      }
    }
  }

  // 2. Daily Check-in Reminder for Testers (6:00 PM)
  if (prefs['check_in'] !== false) {
    const { count: activeContracts } = await supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('tester_id', userId).eq('status', 'active');
    if (activeContracts && activeContracts > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to check in! ⏰',
          body: `You have ${activeContracts} app${activeContracts > 1 ? 's' : ''} waiting for your daily proof. Don't lose your progress!`,
          data: { type: 'check_in' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 18,
          minute: 0,
        },
      });
    }
  }
};
