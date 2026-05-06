/**
 * logService — writes app errors and events to Firestore `appLogs` collection.
 * Admin can view these in the DriftAdmin Logs page.
 * Never throws — all methods are fire-and-forget safe.
 */

import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Platform } from 'react-native';

type LogLevel = 'error' | 'warn' | 'info';

async function writeLog(
  level: LogLevel,
  source: string,
  message: string,
  details?: unknown,
  uid?: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'appLogs'), {
      level,
      source,
      message,
      details: details ? JSON.stringify(details, null, 2) : null,
      uid: uid ?? null,
      platform: Platform.OS,
      createdAt: Date.now(),
    });
  } catch {
    // Never throw from logger
  }
}

export function logError(source: string, message: string, details?: unknown, uid?: string) {
  writeLog('error', source, message, details, uid).catch(() => {});
}

export function logWarn(source: string, message: string, details?: unknown, uid?: string) {
  writeLog('warn', source, message, details, uid).catch(() => {});
}

export function logInfo(source: string, message: string, details?: unknown, uid?: string) {
  writeLog('info', source, message, details, uid).catch(() => {});
}

/** Install a global JS error handler that logs uncaught errors to Firestore. */
export function installGlobalErrorHandler(getUid?: () => string | undefined): void {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logError(
      'GlobalErrorHandler',
      `${isFatal ? '[FATAL] ' : ''}${error?.message ?? String(error)}`,
      { stack: error?.stack },
      getUid?.(),
    );
    originalHandler(error, isFatal);
  });
}
