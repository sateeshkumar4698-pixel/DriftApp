/**
 * NFCWriteScreen — Write your Drift profile URL to a physical NFC sticker/card.
 *
 * ⚠️  IMPORTANT: Phone-to-phone NFC P2P is NOT supported on iOS (never was)
 *     and was removed from Android (Android Beam deprecated in Android 10,
 *     removed in Android 14). This screen writes to PHYSICAL NFC TAGS instead.
 *
 * Use case:
 *  • Put an NFC sticker on your laptop, notebook, or bike
 *  • Anyone taps it with their phone → browser opens → Drift profile loads
 *  • If they have the app → deep link opens ProfileDetail directly
 *
 * Hardware: Any NFC NTAG213/215/216 sticker (~₹20–50 each on Amazon India)
 *
 * Package needed (requires a DEV BUILD — does NOT work in Expo Go):
 *   npm install react-native-nfc-manager
 *   # Then rebuild: npx expo run:ios / npx expo run:android
 *
 * iOS: Add "com.apple.developer.nfc.readersession.formats" entitlement in Xcode
 * Android: Handled automatically by the library's AndroidManifest.xml
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { profileDeepLink } from '../../utils/profileShare';

// ─── Lazy-load react-native-nfc-manager ──────────────────────────────────────
// If not installed yet, the UI still renders with a "not available" state.
let NfcManager: any = null;
let Ndef:       any = null;

try {
  const pkg  = require('react-native-nfc-manager');
  NfcManager  = pkg.default ?? pkg.NfcManager;
  Ndef        = pkg.Ndef;
} catch {
  // Library not installed — graceful degradation
}

// ─── NFC ring animation ───────────────────────────────────────────────────────

function NfcRing({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { anim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.3, 0] });

  return (
    <Animated.View style={[ringStyle.ring, { transform: [{ scale }], opacity }]} pointerEvents="none" />
  );
}

const ringStyle = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: colors.primary,
    alignSelf: 'center',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Stage = 'idle' | 'waiting' | 'success' | 'error' | 'unavailable';

export default function NFCWriteScreen() {
  const navigation     = useNavigation();
  const { userProfile } = useAuthStore();

  const [stage,    setStage]    = useState<Stage>('idle');
  const [errMsg,   setErrMsg]   = useState('');
  const [nfcReady, setNfcReady] = useState(false);

  const uid      = userProfile?.uid ?? '';
  const deepLink = profileDeepLink(uid); // https://driftapp.in/u/{uid}

  // ── Init NFC on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!NfcManager) {
      setStage('unavailable');
      return;
    }
    NfcManager.start()
      .then(() => setNfcReady(true))
      .catch(() => { setStage('unavailable'); });

    return () => {
      NfcManager?.cancelTechnologyRequest?.().catch(() => {});
    };
  }, []);

  // ── Write tag ─────────────────────────────────────────────────────────────
  async function writeTag() {
    if (!NfcManager || !Ndef || !uid) return;
    setStage('waiting');

    try {
      // Request NFC technology
      await NfcManager.requestTechnology('Ndef');

      // Build NDEF message: URI record containing the Drift deep link
      const bytes = Ndef.encodeMessage([Ndef.uriRecord(deepLink)]);

      // Write to tag
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      setStage('success');
      NfcManager.cancelTechnologyRequest().catch(() => {});
    } catch (ex: any) {
      NfcManager.cancelTechnologyRequest().catch(() => {});

      const msg = String(ex?.message ?? ex);
      if (msg.toLowerCase().includes('cancelled') || msg.toLowerCase().includes('cancel')) {
        // User cancelled — go back to idle silently
        setStage('idle');
      } else if (msg.toLowerCase().includes('readonly') || msg.toLowerCase().includes('read only')) {
        setErrMsg('This tag is read-only and cannot be written to. Use a blank NTAG213 sticker.');
        setStage('error');
      } else {
        setErrMsg('Could not write to the tag. Make sure it is a blank writable NFC sticker (NTAG213/215/216).');
        setStage('error');
      }
    }
  }

  function reset() {
    setStage('idle');
    setErrMsg('');
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NFC Sticker</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>

        {/* ── Library not installed ── */}
        {stage === 'unavailable' && (
          <>
            <Text style={styles.bigEmoji}>📡</Text>
            <Text style={styles.title}>NFC Not Available</Text>
            <Text style={styles.sub}>
              {!NfcManager
                ? `Install the NFC library to enable this feature.\n\nnpm install react-native-nfc-manager\n\nThen rebuild your development build.`
                : Platform.OS === 'ios'
                ? 'NFC writing requires iPhone 13 or later with iOS 15+'
                : 'This device does not support NFC or NFC is disabled in Settings'}
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Idle: explain + start ── */}
        {stage === 'idle' && (
          <>
            <View style={styles.iconBox}>
              <Text style={{ fontSize: 60 }}>📡</Text>
            </View>

            <Text style={styles.title}>Write to NFC Sticker</Text>
            <Text style={styles.sub}>
              Write your Drift profile to a physical NFC sticker. Anyone who taps it
              opens your profile instantly — no app needed to tap, but they'll be prompted to download Drift to connect.
            </Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What you need</Text>
              <Text style={styles.infoItem}>📦 Any NTAG213 / 215 / 216 NFC sticker</Text>
              <Text style={styles.infoItem}>   (₹20–50 each · search "NFC sticker" on Amazon India)</Text>
              <Text style={styles.infoItem}>📱 A phone with NFC enabled</Text>
              <Text style={styles.infoItem}>🖊️ One write per sticker — works forever after</Text>
            </View>

            <Text style={styles.linkPreview}>Will write: {deepLink}</Text>

            {nfcReady ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={writeTag} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Start Writing →</Text>
              </TouchableOpacity>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </>
        )}

        {/* ── Waiting for tag ── */}
        {stage === 'waiting' && (
          <>
            <View style={styles.iconBox}>
              <NfcRing active={true} />
              <Text style={{ fontSize: 60, zIndex: 1 }}>📡</Text>
            </View>
            <Text style={styles.title}>Hold Near Sticker</Text>
            <Text style={styles.sub}>
              Hold the back of your phone against the NFC sticker and keep still for 2–3 seconds
            </Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            <TouchableOpacity onPress={reset} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Success ── */}
        {stage === 'success' && (
          <>
            <View style={[styles.iconBox, styles.successBox]}>
              <Text style={{ fontSize: 60 }}>✅</Text>
            </View>
            <Text style={styles.title}>NFC Sticker Written!</Text>
            <Text style={styles.sub}>
              Anyone who taps this sticker will see your Drift profile.
              Stick it on your laptop, notebook, water bottle — anywhere.
            </Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What happens when someone taps</Text>
              <Text style={styles.infoItem}>📱 Has Drift app → opens your profile directly</Text>
              <Text style={styles.infoItem}>🌐 No app → opens driftapp.in in browser</Text>
              <Text style={styles.infoItem}>   (they'll be prompted to download Drift)</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Write Another Sticker</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <>
            <Text style={styles.bigEmoji}>⚠️</Text>
            <Text style={styles.title}>Write Failed</Text>
            <Text style={styles.sub}>{errMsg}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={reset} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </SafeAreaView>
  );
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
  backText:    { fontSize: 22, color: colors.primary },
  headerTitle: { ...typography.heading, color: colors.text },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.lg,
  },

  bigEmoji: { fontSize: 70, textAlign: 'center' },

  iconBox: {
    width: 110, height: 110,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successBox: {
    backgroundColor: `${colors.success}12`,
    borderRadius: 55,
    borderWidth: 1, borderColor: `${colors.success}30`,
  },

  title: { ...typography.title, color: colors.text, textAlign: 'center', fontWeight: '700' },
  sub:   { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },

  infoCard: {
    width: '100%', backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 6,
  },
  infoTitle: { ...typography.body, fontWeight: '700', color: colors.text, marginBottom: 4 },
  infoItem:  { ...typography.small, color: colors.textSecondary, lineHeight: 20 },

  linkPreview: { ...typography.small, color: colors.primary, fontStyle: 'italic', textAlign: 'center' },

  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    ...shadows.card,
  },
  primaryBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },

  cancelBtn:  { marginTop: spacing.xs },
  cancelText: { ...typography.body, color: colors.textSecondary },
});
