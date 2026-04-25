/**
 * Notification Service
 * Handles Expo push token registration and local/remote notification scheduling.
 * Works in both real devices and Expo Go.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Expo Go (SDK 53+) removed remote push notification support.
// Detect it so we can skip all notification setup and avoid noisy warnings.
// In a real dev build / production build, this will be false.
function isExpoGo(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
}

const IN_EXPO_GO = isExpoGo();

// ─── Configure foreground behavior ───────────────────────────────────────────
if (!IN_EXPO_GO) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
        shouldShowBanner: true,
        shouldShowList:   true,
      }),
    });
  } catch {
    // Safe to ignore
  }
}

// ─── Token Registration ───────────────────────────────────────────────────────

/**
 * Requests permission and registers the device push token.
 * Stores the token under users/{uid}/pushToken in Firestore.
 * Safe to call multiple times — no-ops if permission already granted.
 */
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  // Push not supported in Expo Go (SDK 53+) or simulators — skip silently
  if (IN_EXPO_GO || !Device.isDevice) return null;

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied');
    return null;
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:               'Default',
      importance:         Notifications.AndroidImportance.MAX,
      vibrationPattern:   [0, 250, 250, 250],
      lightColor:         '#FF4B6E',
      sound:              'default',
    });
    await Notifications.setNotificationChannelAsync('messages', {
      name:               'Messages',
      importance:         Notifications.AndroidImportance.HIGH,
      vibrationPattern:   [0, 250],
      lightColor:         '#6C5CE7',
      sound:              'default',
    });
  }

  try {
    // projectId is the EAS project ID. Falls back to undefined if not configured,
    // which is fine for Expo Go testing (token won't work for real pushes but
    // doesn't block app startup).
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(async () => {
      // Expo Go with no projectId configured — use a silent fallback
      return { data: null };
    });
    const token = tokenData.data;
    if (!token) {
      console.log('[Notifications] Could not get push token (Expo Go without project ID)');
      return null;
    }

    // Persist to Firestore — save as both pushToken and fcmToken so the
    // backend (/notifications/send) and Expo push APIs both work.
    await setDoc(
      doc(db, 'users', uid),
      {
        pushToken:        token,
        fcmToken:         token,
        pushTokenUpdated: Date.now(),
        platform:         Platform.OS,
      },
      { merge: true },
    );

    console.log('[Notifications] Registered push token:', token);
    return token;
  } catch (err) {
    console.warn('[Notifications] Failed to get push token:', err);
    return null;
  }
}

// ─── Local Notifications ──────────────────────────────────────────────────────

/**
 * Schedule a local notification (e.g., streak reminder).
 */
export async function scheduleDailyStreakReminder(): Promise<void> {
  if (IN_EXPO_GO) return; // local notifications also unreliable in Expo Go

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as Record<string, unknown>)?.type === 'streak_reminder') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await scheduleLocalNotification({
    title:   '🔥 Don\'t break your streak!',
    body:    'Log in today to keep your Drift streak alive and earn coins.',
    data:    { type: 'streak_reminder' },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.DAILY,
      hour:    20,
      minute:  0,
    },
  });
}

export async function scheduleLocalNotification(opts: {
  title:   string;
  body:    string;
  data?:   Record<string, unknown>;
  trigger: Notifications.NotificationTriggerInput;
}): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body:  opts.body,
      data:  opts.data ?? {},
      sound: 'default',
    },
    trigger: opts.trigger,
  });
}

/**
 * Dismiss all delivered notifications and clear badge count.
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

// ─── Notification listener helpers ───────────────────────────────────────────

export type NotificationListener = ReturnType<typeof Notifications.addNotificationReceivedListener>;

/**
 * Set up foreground notification listener.
 * Returns the subscription — caller must call .remove() on unmount.
 */
export function addForegroundListener(
  handler: (notification: Notifications.Notification) => void,
): NotificationListener {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Set up notification response listener (user taps notification).
 * Returns the subscription — caller must call .remove() on unmount.
 */
export function addResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
