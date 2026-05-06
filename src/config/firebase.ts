import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Persistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyCNDRrFb7R0G3lukOnORMOj1-6AV8rhOAE',
  authDomain: 'community-app-5a4d1.firebaseapp.com',
  projectId: 'community-app-5a4d1',
  storageBucket: 'community-app-5a4d1.firebasestorage.app',
  messagingSenderId: '1068329993869',
  appId: '1:1068329993869:web:87130665a386fab63004c4',
  // measurementId omitted — Firebase Analytics is browser-only and throws
  // 'getElementsByTagName of undefined' in React Native. Never call getAnalytics()
  // in a React Native app; use @react-native-firebase/analytics if you need it.
  // asia-southeast1 region — use the regional URL, NOT the default firebaseio.com URL
  databaseURL: 'https://community-app-5a4d1-default-rtdb.asia-southeast1.firebasedatabase.app',
};

// getReactNativePersistence is only exported in Firebase's react-native bundle.
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

const isNew = getApps().length === 0;
const app   = isNew ? initializeApp(firebaseConfig) : getApp();

export const auth = isNew
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

// Dev mode: bypass reCAPTCHA so Firebase test phone numbers work
if (__DEV__) {
  auth.settings.appVerificationDisabledForTesting = true;
}

// Firestore — React Native doesn't support IndexedDB/LocalStorage so we use
// memoryLocalCache (no IndexedDB errors). Firestore's real-time listeners
// still work perfectly; only offline persistence between app restarts is skipped.
export const db = isNew
  ? initializeFirestore(app, { localCache: memoryLocalCache() })
  : getFirestore(app);

export const storage = getStorage(app);
export const rtdb    = getDatabase(app);

export default app;
