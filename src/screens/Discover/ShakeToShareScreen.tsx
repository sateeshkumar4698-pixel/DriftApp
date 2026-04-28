/**
 * ShakeToShareScreen — Shake your phone simultaneously with someone nearby
 * to instantly exchange Drift profiles — no number, no QR needed.
 *
 * Install:  npx expo install expo-sensors
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ref as rtdbRef, set, onValue, remove } from 'firebase/database';

import { rtdb } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { getUserProfile } from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { DiscoverStackParamList } from '../../types';
import { RTDB_SHAKES_PATH, SHAKE_TTL_MS } from '../../utils/profileShare';

// ─── Lazy-load expo-sensors ───────────────────────────────────────────────────
let SensorsModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SensorsModule = require('expo-sensors');
} catch { /* not installed yet */ }

type Nav = NativeStackNavigationProp<DiscoverStackParamList>;

// ─── Not-installed screen ─────────────────────────────────────────────────────

function PackageNotInstalled() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shake to Share</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.center}>
        <Text style={{ fontSize: 60 }}>📦</Text>
        <Text style={styles.mainTitle}>Package not installed</Text>
        <Text style={styles.mainSub}>
          Run this command in your project folder, then restart the bundler:
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>npx expo install expo-sensors</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHAKE_THRESHOLD  = 1.8;   // G units
const MIN_SHAKE_GAP_MS = 800;

interface ShakeEntry {
  uid: string;
  name: string;
  photoURL: string;
  timestamp: number;
}

// ─── Pulse rings ──────────────────────────────────────────────────────────────

function PulseRings({ active }: { active: boolean }) {
  const r0 = useRef(new Animated.Value(0)).current;
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const rings = [r0, r1, r2];

  useEffect(() => {
    if (!active) { rings.forEach((r) => r.setValue(0)); return; }
    const anims = rings.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 350),
          Animated.parallel([
            Animated.timing(r, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [active]);

  return (
    <>
      {rings.map((r, i) => {
        const scale   = r.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
        const opacity = r.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 0.4, 0] });
        return (
          <Animated.View
            key={i}
            style={[pulseStyles.ring, { transform: [{ scale }], opacity }]}
            pointerEvents="none"
          />
        );
      })}
    </>
  );
}

const pulseStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.primary,
    alignSelf: 'center',
  },
});

// ─── Phone icon ───────────────────────────────────────────────────────────────

function PhoneIcon({ shaking }: { shaking: boolean }) {
  const rot   = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shaking) { rot.setValue(0); scale.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rot,   { toValue:  1,    duration: 60, useNativeDriver: true }),
          Animated.timing(scale, { toValue:  1.15, duration: 60, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(rot,   { toValue: -1,    duration: 60, useNativeDriver: true }),
          Animated.timing(scale, { toValue:  0.95, duration: 60, useNativeDriver: true }),
        ]),
        Animated.timing(rot,   { toValue:  0, duration: 60, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shaking]);

  const rotate = rot.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-18deg', '0deg', '18deg'] });
  return (
    <Animated.Text style={[{ fontSize: 68, textAlign: 'center' }, { transform: [{ rotate }, { scale }] }]}>
      📱
    </Animated.Text>
  );
}

// ─── Inner component (renders only when expo-sensors is installed) ────────────

type Stage = 'idle' | 'shaking' | 'searching' | 'matched' | 'notfound';

function ShakeToShareInner() {
  const navigation = useNavigation<Nav>();
  const { userProfile, firebaseUser } = useAuthStore();

  const Accelerometer = SensorsModule.Accelerometer;

  const [stage,        setStage]        = useState<Stage>('idle');
  const [match,        setMatch]        = useState<{ uid: string; name: string; photoURL?: string } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const lastShakeTs  = useRef(0);
  const shakeRef     = useRef(false);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listenerRef  = useRef<(() => void) | null>(null);

  const uid  = firebaseUser?.uid ?? '';
  const name = userProfile?.name ?? 'You';

  useFocusEffect(
    useCallback(() => {
      Accelerometer.setUpdateInterval(100);
      const sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (mag > SHAKE_THRESHOLD && now - lastShakeTs.current > MIN_SHAKE_GAP_MS) {
          lastShakeTs.current = now;
          onShakeDetected();
        }
      });
      return () => { sub.remove(); cleanup(); };
    }, [uid, name]),
  );

  async function onShakeDetected() {
    if (shakeRef.current || !uid) return;
    shakeRef.current = true;
    Vibration.vibrate(Platform.OS === 'android' ? [0, 40, 25, 60] : [0, 60]);
    setStage('shaking');
    setTimeout(async () => {
      setStage('searching');
      await publishShake();
      listenForMatch();
    }, 400);
  }

  async function publishShake() {
    if (!uid) return;
    const shakeRef2 = rtdbRef(rtdb, `${RTDB_SHAKES_PATH}/${uid}`);
    await set(shakeRef2, { uid, name, photoURL: userProfile?.photoURL ?? '', timestamp: Date.now() } as ShakeEntry);
    clearTimeout(cleanupTimer.current);
    cleanupTimer.current = setTimeout(() => {
      remove(shakeRef2).catch(() => {});
    }, SHAKE_TTL_MS + 1000);
  }

  function listenForMatch() {
    const rootRef  = rtdbRef(rtdb, RTDB_SHAKES_PATH);
    const now      = Date.now();
    const unsubscribe = onValue(rootRef, async (snap) => {
      if (!snap.exists()) return;
      const all = snap.val() as Record<string, ShakeEntry>;
      const cutoff = now - SHAKE_TTL_MS;
      const candidates = Object.values(all).filter((e) => e.uid !== uid && e.timestamp >= cutoff);
      if (candidates.length === 0) return;

      const best = candidates.sort((a, b) => b.timestamp - a.timestamp)[0];
      unsubscribe();
      listenerRef.current = null;

      Vibration.vibrate(Platform.OS === 'android' ? [0, 80, 40, 120] : [0, 100]);
      setMatchLoading(true);
      try {
        const profile = await getUserProfile(best.uid);
        if (profile) {
          setMatch({ uid: best.uid, name: best.name, photoURL: best.photoURL });
          setStage('matched');
        } else { setStage('notfound'); }
      } catch { setStage('notfound'); }
      finally { setMatchLoading(false); }
    });

    listenerRef.current = unsubscribe;
    setTimeout(() => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
        setStage((s) => s === 'matched' ? s : 'notfound');
      }
    }, SHAKE_TTL_MS);
  }

  function cleanup() {
    listenerRef.current?.();
    listenerRef.current = null;
    clearTimeout(cleanupTimer.current);
    if (uid) remove(rtdbRef(rtdb, `${RTDB_SHAKES_PATH}/${uid}`)).catch(() => {});
  }

  function reset() {
    cleanup();
    shakeRef.current = false;
    setStage('idle');
    setMatch(null);
  }

  async function openMatchProfile() {
    if (!match) return;
    setMatchLoading(true);
    try {
      const profile = await getUserProfile(match.uid);
      if (!profile) throw new Error('not found');
      navigation.navigate('ProfileDetail', { user: profile });
    } catch {
      Alert.alert('Error', 'Could not load their profile. Try again.');
    } finally { setMatchLoading(false); }
  }

  const isActive = stage === 'shaking' || stage === 'searching';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { cleanup(); navigation.goBack(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shake to Share</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>
        {/* IDLE */}
        {stage === 'idle' && (
          <>
            <View style={styles.iconContainer}><PhoneIcon shaking={false} /></View>
            <Text style={styles.mainTitle}>Shake Together</Text>
            <Text style={styles.mainSub}>Both phones shake at the same time → you see each other's profiles</Text>
            <View style={styles.stepsCard}>
              <Text style={styles.step}>① Open this screen on both phones</Text>
              <Text style={styles.step}>② Count to 3 together</Text>
              <Text style={styles.step}>③ Shake your phones simultaneously</Text>
              <Text style={styles.step}>④ Connect — no number sharing needed 🎉</Text>
            </View>
            <Text style={styles.readyHint}>Start shaking — the app is listening</Text>
          </>
        )}

        {/* SHAKING / SEARCHING */}
        {(stage === 'shaking' || stage === 'searching') && (
          <>
            <View style={styles.iconContainer}>
              <PulseRings active={true} />
              <PhoneIcon shaking={stage === 'shaking'} />
            </View>
            <Text style={styles.mainTitle}>{stage === 'shaking' ? 'Shake detected! 🔥' : 'Looking nearby…'}</Text>
            <Text style={styles.mainSub}>
              {stage === 'shaking' ? 'Matching you with nearby shakers' : 'Scanning for other phones shaking right now'}
            </Text>
            {stage === 'searching' && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}
            <TouchableOpacity onPress={reset} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* MATCHED */}
        {stage === 'matched' && match && (
          <>
            <View style={styles.matchBurst}><Text style={{ fontSize: 40 }}>🤝</Text></View>
            <Text style={styles.mainTitle}>Connected!</Text>
            <Text style={styles.mainSub}>You and {match.name} shook at the same moment</Text>
            <View style={styles.matchCard}>
              <Avatar name={match.name} photoURL={match.photoURL} size={72} />
              <Text style={styles.matchName}>{match.name}</Text>
              <Text style={styles.mainSub}>Tap below to view their profile and connect</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={openMatchProfile} disabled={matchLoading} activeOpacity={0.85}>
              {matchLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>View Profile → Connect</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

        {/* NOT FOUND */}
        {stage === 'notfound' && (
          <>
            <Text style={{ fontSize: 60 }}>😅</Text>
            <Text style={styles.mainTitle}>No one found nearby</Text>
            <Text style={styles.mainSub}>Make sure the other person is on this screen and shakes at the same time</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Export — shows install screen if package missing ─────────────────────────

export default function ShakeToShareScreen() {
  if (!SensorsModule) return <PackageNotInstalled />;
  return <ShakeToShareInner />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { ...typography.heading, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.lg },
  iconContainer: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },

  mainTitle: { ...typography.title, color: colors.text, textAlign: 'center', fontWeight: '700' },
  mainSub:   { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },

  stepsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md, width: '100%',
  },
  step: { ...typography.body, color: colors.text, lineHeight: 24 },
  readyHint: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  cancelBtn:  { marginTop: spacing.sm },
  cancelText: { ...typography.body, color: colors.textSecondary },

  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  primaryBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },

  matchBurst: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  matchCard:  { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, width: '100%' },
  matchName:  { ...typography.title, color: colors.text, fontWeight: '700' },

  codeBox: {
    backgroundColor: '#1E1E2E', borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    width: '100%', marginTop: spacing.sm,
  },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#50FA7B', fontSize: 13 },
});
