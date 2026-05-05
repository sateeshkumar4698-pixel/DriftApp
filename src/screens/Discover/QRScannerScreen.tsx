import React, { useEffect, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getUserProfile } from '../../utils/firestore-helpers';
import { useTheme, AppColors, spacing, typography, radius } from '../../utils/useTheme';
import { DiscoverStackParamList } from '../../types';

let CameraModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CameraModule = require('expo-camera');
} catch { /* not installed yet */ }

type Nav = NativeStackNavigationProp<DiscoverStackParamList>;

// ─── Not-installed screen ─────────────────────────────────────────────────────

function PackageNotInstalled() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.center}>
        <Text style={{ fontSize: 60, textAlign: 'center' }}>📦</Text>
        <Text style={styles.permTitle}>Package not installed</Text>
        <Text style={styles.permSub}>Run this in your project folder and restart the bundler:</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>npx expo install expo-camera</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractUid(raw: string): string | null {
  const driftMatch = raw.match(/^drift:\/\/profile\/([A-Za-z0-9_-]+)/);
  if (driftMatch) return driftMatch[1];
  const webMatch = raw.match(/driftapp\.in\/u\/([A-Za-z0-9_-]+)/);
  if (webMatch) return webMatch[1];
  return null;
}

// ─── Viewfinder overlay ───────────────────────────────────────────────────────

const WINDOW_SIZE = 240;
const CORNER = 22;

function ScannerOverlay({ scanning }: { scanning: boolean }) {
  const { C } = useTheme();
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanning]);

  const translateY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, WINDOW_SIZE] });
  const cornerStyle = { position: 'absolute' as const, width: CORNER, height: CORNER, borderColor: C.primary, borderWidth: 3 };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ flexDirection: 'row', height: WINDOW_SIZE }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <View style={{ width: WINDOW_SIZE, height: WINDOW_SIZE, overflow: 'hidden' }}>
          <View style={[cornerStyle, { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 }]} />
          <View style={[cornerStyle, { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 6 }]} />
          <View style={[cornerStyle, { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 }]} />
          <View style={[cornerStyle, { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 6 }]} />
          {scanning && (
            <Animated.View style={{
              height: 2, width: WINDOW_SIZE, backgroundColor: C.primary,
              shadowColor: C.primary, shadowRadius: 4, shadowOpacity: 0.9,
              shadowOffset: { width: 0, height: 0 },
              transform: [{ translateY }],
            }} />
          )}
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      </View>
      <View style={{ flex: 1.5, backgroundColor: 'rgba(0,0,0,0.55)' }} />
    </View>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────

function QRScannerInner() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<Nav>();
  const { CameraView, useCameraPermissions } = CameraModule;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,   setScanned]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || loading) return;
    setScanned(true);
    Vibration.vibrate(Platform.OS === 'android' ? 50 : [0, 50]);

    const uid = extractUid(data);
    if (!uid) {
      setStatusMsg('Not a Drift QR code — try again');
      setTimeout(() => { setScanned(false); setStatusMsg(''); }, 2000);
      return;
    }

    setLoading(true);
    setStatusMsg('Loading profile…');
    try {
      const profile = await getUserProfile(uid);
      if (!profile) throw new Error('not found');
      navigation.replace('ProfileDetail', { user: profile });
    } catch {
      Alert.alert(
        'Profile Not Found',
        'This Drift profile does not exist or has been removed.',
        [{ text: 'Try Again', onPress: () => { setScanned(false); setLoading(false); setStatusMsg(''); } }],
      );
    } finally { setLoading(false); }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSub}>Allow camera to scan Drift profile QR codes</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
          <Text style={styles.permSub}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <ScannerOverlay scanning={!scanned} />
      <SafeAreaView style={[StyleSheet.absoluteFill, { zIndex: 20 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.title}>Scan Drift QR</Text>
          <Text style={styles.subtitle}>Point at a Drift profile card or screen</Text>
        </View>
        <View style={styles.statusBox}>
          {loading && <ActivityIndicator color={C.primary} style={{ marginBottom: spacing.sm }} />}
          {!!statusMsg && (
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{statusMsg}</Text>
            </View>
          )}
        </View>
        {!scanned && (
          <View style={styles.bottomBox}>
            <Text style={styles.bottomTip}>🌊 Works with Drift profile cards, screenshots, and on-screen QR codes</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function QRScannerScreen() {
  if (!CameraModule) return <PackageNotInstalled />;
  return <QRScannerInner />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background, padding: spacing.lg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    backBtn:     { margin: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.h3, color: C.text },
    titleBox:  { alignItems: 'center', marginTop: spacing.md },
    title:     { ...typography.h2, color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
    subtitle:  { ...typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
    statusBox:  { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 180 },
    statusPill: { backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    statusText: { ...typography.body, color: '#fff', fontWeight: '600' },
    bottomBox: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
    bottomTip: { ...typography.small, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
    permTitle:   { ...typography.h1, color: C.text, marginBottom: spacing.sm, textAlign: 'center', fontWeight: '700' },
    permSub:     { ...typography.body, color: C.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
    permBtn:     { backgroundColor: C.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg },
    permBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
    codeBox:  { backgroundColor: '#1E1E2E', borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, width: '100%', marginTop: spacing.sm },
    codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#50FA7B', fontSize: 13 },
  });
}
