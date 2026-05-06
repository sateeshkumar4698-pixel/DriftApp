import { collection, addDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db, auth } from '../config/firebase';

/**
 * A remote logger that writes logs to Firestore so you can view them from the Firebase Console.
 * It will also output to the local console during development.
 */
export const Logger = {
  /**
   * Base logging function
   */
  log: async (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    // 1. Output to the standard console for local debugging
    if (level === 'error') {
      console.error(`[REMOTE LOG ERROR]: ${message}`, data || '');
    } else if (level === 'warn') {
      console.warn(`[REMOTE LOG WARN]: ${message}`, data || '');
    } else {
      console.log(`[REMOTE LOG INFO]: ${message}`, data || '');
    }

    // 2. Upload to Firestore for remote users
    try {
      const user = auth.currentUser;
      // We only log if a user is authenticated, to respect firestore rules
      if (user) {
        await addDoc(collection(db, 'appLogs'), {
          uid: user.uid,
          level,
          message,
          data: data ? JSON.stringify(data) : null,
          timestamp: Date.now(),
          platform: Platform.OS,
          version: Platform.Version,
        });
      }
    } catch (e) {
      console.error('Failed to write remote log to Firestore:', e);
    }
  },

  info: (message: string, data?: any) => Logger.log('info', message, data),
  warn: (message: string, data?: any) => Logger.log('warn', message, data),
  error: (message: string, data?: any) => Logger.log('error', message, data),
};
