import * as Notifications from 'expo-notifications';
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

export type NotificationType = 'new_tester' | 'new_review' | 'app_expiry' | 'app_full' | 'daily_reports' | 'subscription' | 'new_proof' | 'check_in' | 'testing_finished';

/**
 * Sends a notification by writing to the database and optionally triggering a local notification.
 */
export const sendNotification = async (
  targetUserId: string, 
  title: string, 
  body: string, 
  type: NotificationType,
  currentUserId?: string // If target is the current user, we can send a local system notification
) => {
  try {
    // 1. Check user preferences
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_prefs')
      .eq('id', targetUserId)
      .single();

    if (error) throw error;

    const prefs = user.notification_prefs || {};
    // If explicitly set to false, don't send
    if (prefs[type] === false) {
      return;
    }

    // 2. Save to database for in-app notifications
    await supabase.from('notifications').insert([{
      user_id: targetUserId,
      title,
      body,
      type
    }]);

    // 3. Trigger local system notification if applicable
    // (Without a push server, we can only trigger system notifications on the active device)
    if (targetUserId === currentUserId) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type },
        },
        trigger: null, // immediate
      });
    }
  } catch (e) {
    console.error('Error sending notification:', e);
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
