import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';

// ─── Silence Firebase SDK reCAPTCHA logs (cosmetic, not errors) ───────────────
// Firebase web SDK internally tries to init reCAPTCHA on every phone auth call.
// In React Native there is no browser, so it always logs these two warnings.
// They do NOT affect functionality — the mockVerifier + appVerificationDisabledForTesting
// handle auth correctly. We just suppress the noise.
if (__DEV__) {
  const SUPPRESS = [
    'reCAPTCHA', 'grecaptcha',
    // expo-notifications is crippled in Expo Go (SDK 53+). Warnings are
    // expected — push notifications require a development build.
    'expo-notifications',
    'expo-notifications: Android Push',
    'dev-client',
  ];

  const _log = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (SUPPRESS.some((s) => msg.includes(s))) return;
    _log(...args);
  };
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (SUPPRESS.some((s) => msg.includes(s))) return;
    _warn(...args);
  };
}
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/config/firebase';
import { useAuthStore } from './src/store/authStore';
import { getUserProfile } from './src/utils/firestore-helpers';
import { processDailyLogin } from './src/services/coinService';
import RootNavigator from './src/navigation/RootNavigator';

// Global navigation ref — lets us navigate from outside React components (push notifications)
export const navigationRef = createNavigationContainerRef();

// ─── Auth mode ────────────────────────────────────────────────────────────────
// true  → mock user injected, skips OTP — use this in Expo Go for testing
// false → real Firebase Auth (use in EAS dev build / production APK)
const MOCK_AUTH = false;

export default function App() {
  const { setFirebaseUser, setUserProfile, setLoading } = useAuthStore();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // ─── Auth listener ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (MOCK_AUTH) {
      // ── Mock user ────────────────────────────────────────────────────────────
      const mockProfile = {
        uid:                 'mock-user-123',
        phoneNumber:         '+919999999999',
        name:                'Satish Kumar',
        age:                 23,
        bio:                 'Building Drift 🌊 Coffee addict, music lover, always up for a good conversation.',
        city:                'Bengaluru',
        college:             'VTU',
        interests:           ['Music', 'Gaming', 'Travel', 'Tech', 'Coffee', 'Startups'],
        lookingFor:          ['friends', 'networking'] as ('friends' | 'networking')[],
        vibeProfile: {
          energy: 0.75, social: 0.6, adventure: 0.7, aesthetic: 0.5,
          primaryVibes: ['Chill Vibes', 'Creative', 'Night Owl'],
          musicTaste: ['Indie', 'Lo-fi', 'Hip-hop'],
          nightlifeStyle: 'houseparty' as const,
        },
        coins:               250,
        streak:              { current: 5, longest: 12, lastLoginDate: new Date().toISOString().slice(0, 10) },
        profileCompleteness: 80,
        isVerified:          false,
        isBanned:            false,
        createdAt:           Date.now(),
      };

      setFirebaseUser({ uid: 'mock-user-123', phoneNumber: '+1234567890' } as any);
      setUserProfile(mockProfile);

      // Daily login + streak (silent, non-blocking)
      processDailyLogin('mock-user-123', {
        coins:  mockProfile.coins,
        streak: mockProfile.streak,
      })
        .then(({ coins, streak }) => setUserProfile({ ...mockProfile, coins, streak }))
        .catch(() => {/* non-critical */});

      setLoading(false);
      return;
    }

    // ── Real Firebase Auth ────────────────────────────────────────────────────
    // Safety timeout: if onAuthStateChanged doesn't fire within 6s (can happen
    // on iOS with new architecture), force unblock the loading screen.
    const timeout = setTimeout(() => {
      console.warn('[App] Auth timeout — forcing setLoading(false)');
      setLoading(false);
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      setFirebaseUser(user);

      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);

          if (profile) {
            // Daily login + streak
            processDailyLogin(user.uid, {
              coins:  profile.coins,
              streak: profile.streak,
            })
              .then(({ coins, streak }) => setUserProfile({ ...profile, coins, streak }))
              .catch(() => {/* non-critical */});

            // Push notifications — lazy import to avoid Expo Go crash
            import('./src/services/notificationService')
              .then(({ registerForPushNotifications, scheduleDailyStreakReminder }) => {
                registerForPushNotifications(user.uid)
                  .then((token) => { if (token) scheduleDailyStreakReminder(); })
                  .catch(() => {/* non-critical */});
              })
              .catch(() => {/* non-critical */});
          }
        } catch (err) {
          console.warn('[App] Profile load failed:', err);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // ─── App state — clear badge when foregrounded ─────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        import('./src/services/notificationService')
          .then(({ clearAllNotifications }) => clearAllNotifications())
          .catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ─── Push notification tap → deep-link navigation ─────────────────────────

  useEffect(() => {
    import('./src/services/notificationService')
      .then(({ addResponseListener }) => {
        const sub = addResponseListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown>;
          const type = data?.type as string | undefined;
          if (!navigationRef.isReady()) return;

          switch (type) {
            case 'connection_request':
            case 'connection_accepted':
              // Go to Notifications screen
              navigationRef.navigate('Main' as never);
              setTimeout(() => {
                (navigationRef as any).navigate('Discover', { screen: 'Notifications' });
              }, 300);
              break;
            case 'new_message': {
              const connectionId = data.connectionId as string | undefined;
              if (connectionId) {
                navigationRef.navigate('Main' as never);
                setTimeout(() => {
                  (navigationRef as any).navigate('Discover', { screen: 'Notifications' });
                }, 300);
              }
              break;
            }
            case 'game_invite':
              navigationRef.navigate('Main' as never);
              setTimeout(() => (navigationRef as any).navigate('Play'), 300);
              break;
            case 'event_invite':
            case 'event_rsvp':
              navigationRef.navigate('Main' as never);
              setTimeout(() => (navigationRef as any).navigate('Events'), 300);
              break;
            case 'admin_notification':
            default:
              // Go to Notifications screen for everything else
              navigationRef.navigate('Main' as never);
              setTimeout(() => {
                (navigationRef as any).navigate('Discover', { screen: 'Notifications' });
              }, 300);
              break;
          }
        });
        return () => sub.remove();
      })
      .catch(() => {});
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" />
      <RootNavigator />
    </NavigationContainer>
  );
}
