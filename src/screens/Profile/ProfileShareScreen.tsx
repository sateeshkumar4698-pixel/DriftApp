/**
 * ProfileShareScreen — Drift profile share card with QR code.
 *
 * Install all at once:
 *   npx expo install expo-linear-gradient expo-sharing expo-clipboard
 *   npx expo install react-native-qrcode-svg react-native-svg react-native-view-shot
 *
 * The screen works at every install stage:
 *   • No packages → shows UID text instead of QR, copies link to clipboard
 *   • Partial install → each feature degrades independently
 *   • Full install → full card capture + share + themed QR
 */

import React, { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../store/authStore';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { ProfileStackParamList } from '../../types';
import {
  CARD_THEMES,
  CardTheme,
  pickThemeForVibe,
  profileDeepLink,
  profileDriftUri,
  profileShareText,
} from '../../utils/profileShare';

// ─── Lazy-load optional packages ──────────────────────────────────────────────
// Each is independently optional — the screen degrades gracefully without them.

let LinearGradient: any = null;
try { LinearGradient = require('expo-linear-gradient').LinearGradient; } catch { /* not installed */ }

let Sharing: any = null;
try { Sharing = require('expo-sharing'); } catch { /* not installed */ }

let Clipboard: any = null;
try { Clipboard = require('expo-clipboard'); } catch { /* not installed */ }

let ViewShot: any = null;
try { ViewShot = require('react-native-view-shot').default; } catch { /* not installed */ }

let QRCode: any = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch { /* not installed */ }

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

// ─── Gradient wrapper — falls back to a plain View if expo-linear-gradient isn't installed ──

function GradientBox({
  colors: gradColors,
  style,
  children,
}: {
  colors: [string, string];
  style?: object;
  children: React.ReactNode;
}) {
  if (LinearGradient) {
    return (
      <LinearGradient colors={gradColors} style={style}>
        {children}
      </LinearGradient>
    );
  }
  // Fallback: use the darker colour as solid background
  return <View style={[style, { backgroundColor: gradColors[0] }]}>{children}</View>;
}

// ─── Share Card ───────────────────────────────────────────────────────────────

interface ShareCardProps {
  theme: CardTheme;
}

function ShareCard({ theme }: ShareCardProps) {
  const { userProfile } = useAuthStore();
  if (!userProfile) return null;

  const top4     = (userProfile.interests ?? []).slice(0, 4);
  const vibes    = userProfile.vibeProfile?.primaryVibes?.slice(0, 3) ?? [];
  const qrValue  = profileDriftUri(userProfile.uid);
  const shortUrl = `driftapp.in/u/${userProfile.uid.slice(0, 8)}`;

  return (
    <GradientBox
      colors={[theme.bgTop, theme.bgBottom]}
      style={[cardStyles.card, { borderColor: theme.border }]}
    >
      {/* Header */}
      <View style={cardStyles.cardHeader}>
        <Text style={[cardStyles.driftLogo, { color: theme.accent }]}>🌊 DRIFT</Text>
        {userProfile.driftId && (
          <Text style={[cardStyles.driftIdBadge, { color: theme.subtext }]}>@{userProfile.driftId}</Text>
        )}
      </View>

      {/* Avatar */}
      <View style={cardStyles.avatarRow}>
        <View style={[cardStyles.avatarRing, { borderColor: theme.accent }]}>
          <Avatar name={userProfile.name} photoURL={userProfile.photoURL} size={72} />
        </View>
      </View>

      {/* Name + city */}
      <Text style={[cardStyles.nameText, { color: theme.text }]}>
        {userProfile.name}, {userProfile.age}
      </Text>
      {userProfile.city && (
        <Text style={[cardStyles.cityText, { color: theme.subtext }]}>📍 {userProfile.city}</Text>
      )}

      {/* Interests */}
      {top4.length > 0 && (
        <View style={cardStyles.chipsRow}>
          {top4.map((i) => (
            <View key={i} style={[cardStyles.chip, { backgroundColor: `${theme.accent}22`, borderColor: `${theme.accent}44` }]}>
              <Text style={[cardStyles.chipText, { color: theme.accent }]}>{i}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Vibes */}
      {vibes.length > 0 && (
        <Text style={[cardStyles.vibeText, { color: theme.subtext }]}>✨ {vibes.join('  ·  ')}</Text>
      )}

      {/* Bio */}
      {userProfile.bio ? (
        <Text style={[cardStyles.bioSnippet, { color: theme.subtext }]} numberOfLines={2}>
          "{userProfile.bio}"
        </Text>
      ) : null}

      {/* Divider */}
      <View style={[cardStyles.divider, { backgroundColor: theme.border }]} />

      {/* QR code or UID fallback */}
      {QRCode ? (
        <View style={[cardStyles.qrWrapper, { backgroundColor: theme.qrBg }]}>
          <QRCode value={qrValue} size={140} color={theme.qrFg} backgroundColor={theme.qrBg} quietZone={10} />
        </View>
      ) : (
        <View style={[cardStyles.qrFallback, { backgroundColor: theme.qrBg, borderColor: theme.accent }]}>
          <Text style={[cardStyles.qrFallbackLabel, { color: theme.qrFg }]}>Profile ID</Text>
          <Text style={[cardStyles.qrFallbackUid, { color: theme.qrFg }]}>{userProfile.uid.slice(0, 16)}</Text>
          <Text style={[cardStyles.qrFallbackNote, { color: theme.subtext }]}>
            Install react-native-qrcode-svg for QR
          </Text>
        </View>
      )}

      <Text style={[cardStyles.scanHint, { color: theme.subtext }]}>Scan to connect on Drift</Text>
      <Text style={[cardStyles.urlText, { color: theme.subtext }]}>{shortUrl}</Text>
    </GradientBox>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: 320, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  cardHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  driftLogo:    { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  driftIdBadge: { fontSize: 12, fontWeight: '600' },
  avatarRow:    { marginVertical: spacing.xs },
  avatarRing:   { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nameText:  { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginTop: 4 },
  cityText:  { fontSize: 13, fontWeight: '500', marginTop: -2 },
  chipsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 2 },
  chip:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  chipText:  { fontSize: 11, fontWeight: '600' },
  vibeText:  { fontSize: 12, fontWeight: '500', marginTop: 2 },
  bioSnippet: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', lineHeight: 18, marginHorizontal: spacing.xs },
  divider:   { width: '60%', height: 1, marginVertical: spacing.xs },
  qrWrapper: { borderRadius: 14, padding: 6, ...shadows.card },
  qrFallback: { borderRadius: 14, padding: spacing.md, borderWidth: 1.5, alignItems: 'center', gap: 4, minWidth: 160 },
  qrFallbackLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  qrFallbackUid:   { fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  qrFallbackNote:  { fontSize: 9, textAlign: 'center', marginTop: 4 },
  scanHint: { fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
  urlText:  { fontSize: 10, marginTop: 2, opacity: 0.7 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileShareScreen() {
  const navigation  = useNavigation<Nav>();
  const { userProfile } = useAuthStore();

  const autoTheme = pickThemeForVibe(userProfile?.vibeProfile);
  const [theme,   setTheme]   = useState<CardTheme>(autoTheme);
  const [sharing, setSharing] = useState(false);
  const [copied,  setCopied]  = useState(false);

  const cardRef = useRef<any>(null);

  if (!userProfile) return null;

  const deepLink = profileDeepLink(userProfile.uid);

  // ── Share card as image (needs ViewShot + Sharing) ───────────────────────
  async function handleShareCard() {
    if (!ViewShot || !cardRef.current) {
      // Fallback: use React Native's built-in Share
      await handleShareText();
      return;
    }
    setSharing(true);
    try {
      const uri = await cardRef.current.capture();
      if (Sharing && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Drift profile' });
      } else {
        await Share.share({ message: profileShareText(userProfile!), url: deepLink });
      }
    } catch {
      Alert.alert('Error', 'Could not share the card. Try "Share via Message" instead.');
    } finally { setSharing(false); }
  }

  // ── Share text via system sheet (built-in React Native Share — always works) ──
  async function handleShareText() {
    try {
      await Share.share({
        message: profileShareText(userProfile!),
        url: deepLink,
        title: `${userProfile!.name}'s Drift Profile`,
      });
    } catch { /* user cancelled */ }
  }

  // ── Copy link ────────────────────────────────────────────────────────────
  async function handleCopyLink() {
    if (Clipboard) {
      await Clipboard.setStringAsync(deepLink);
    } else {
      // expo-clipboard not installed — use Share as fallback
      await Share.share({ message: deepLink });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ─────────────────────────────────────────────────────────────────────────

  const cardComponent = (
    <ShareCard theme={theme} />
  );

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Card (wrapped in ViewShot if available) ── */}
        {ViewShot ? (
          <ViewShot ref={cardRef} options={{ format: 'png', quality: 1.0 }}>
            {cardComponent}
          </ViewShot>
        ) : (
          cardComponent
        )}

        {/* ── Theme picker ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Card Style</Text>
          <View style={styles.themesRow}>
            {CARD_THEMES.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTheme(t)}
                style={[
                  styles.themeBtn,
                  { backgroundColor: t.bgTop, borderColor: t.accent },
                  theme.id === t.id && styles.themeBtnActive,
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.themeBtnLabel}>{t.label}</Text>
                {theme.id === t.id && (
                  <View style={[styles.themeCheck, { backgroundColor: t.accent }]}>
                    <Text style={styles.themeCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.themeHint}>
            {userProfile.vibeProfile
              ? '✨ Auto-picked from your Vibe — tap to switch'
              : 'Complete Vibe Quiz for a personalised theme'}
          </Text>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionsGrid}>
          {/* Share Card */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionPrimary]}
            onPress={handleShareCard}
            disabled={sharing}
            activeOpacity={0.85}
          >
            {sharing
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={styles.actionEmoji}>📤</Text>
                  <Text style={styles.actionPrimaryText}>Share Card</Text>
                  <Text style={styles.actionSubPrimary}>WhatsApp · Insta · SMS</Text>
                </>
            }
          </TouchableOpacity>

          {/* Copy Link */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionSecondary, copied && styles.actionCopied]}
            onPress={handleCopyLink}
            activeOpacity={0.85}
          >
            <Text style={styles.actionEmoji}>{copied ? '✅' : '🔗'}</Text>
            <Text style={[styles.actionSecondaryText, copied && { color: colors.success }]}>
              {copied ? 'Copied!' : 'Copy Link'}
            </Text>
            <Text style={styles.actionSubSecondary}>Profile URL</Text>
          </TouchableOpacity>
        </View>

        {/* ── Share via Message ── */}
        <TouchableOpacity style={styles.msgRow} onPress={handleShareText} activeOpacity={0.85}>
          <View style={styles.msgIcon}><Text style={{ fontSize: 26 }}>💬</Text></View>
          <View style={styles.msgText}>
            <Text style={styles.msgTitle}>Share via Message</Text>
            <Text style={styles.msgSub}>Send profile link over WhatsApp, SMS, or any chat</Text>
          </View>
          <Text style={styles.msgArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Drift ID section ── */}
        <View style={styles.driftIdCard}>
          <View style={styles.driftIdRow}>
            <Text style={styles.driftIdLabel}>Your Drift ID</Text>
            {userProfile.driftId ? (
              <View style={styles.driftIdBadge}>
                <Text style={styles.driftIdBadgeText}>@{userProfile.driftId}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.driftIdDesc}>
            {userProfile.driftId
              ? `Others can find you at driftapp.in/@${userProfile.driftId}`
              : 'Set a custom @handle — easier to share than a QR code'}
          </Text>
          <TouchableOpacity
            style={styles.driftIdBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.85}
          >
            <Text style={styles.driftIdBtnText}>
              {userProfile.driftId ? 'Change Drift ID' : 'Set Drift ID →'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Tips ── */}
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>💡 How to use</Text>
          <Text style={styles.tip}>• Show your QR to someone next to you — they scan with any phone camera</Text>
          <Text style={styles.tip}>• Share the card image on WhatsApp to connect before meeting up</Text>
          <Text style={styles.tip}>• Send your profile link over SMS — no app needed to receive it</Text>
          <Text style={styles.tip}>• Share your @DriftID verbally — no QR, no link needed</Text>
        </View>

      </ScrollView>
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

  scroll: { alignItems: 'center', padding: spacing.lg, paddingBottom: 60, gap: spacing.lg },

  section:      { width: '100%', gap: spacing.sm },
  sectionLabel: { ...typography.caption, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },

  themesRow:       { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  themeBtn:        { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, position: 'relative', alignItems: 'center' },
  themeBtnActive:  { borderWidth: 2.5 },
  themeBtnLabel:   { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  themeCheck:      { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  themeCheckText:  { fontSize: 10, color: '#fff', fontWeight: '700' },
  themeHint:       { ...typography.small, color: colors.textSecondary, fontStyle: 'italic' },

  actionsGrid:     { flexDirection: 'row', gap: spacing.md, width: '100%' },
  actionBtn:       { flex: 1, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', gap: 4, ...shadows.card },
  actionPrimary:   { backgroundColor: colors.primary },
  actionSecondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  actionCopied:    { borderColor: colors.success },
  actionEmoji:         { fontSize: 24 },
  actionPrimaryText:   { ...typography.body, fontWeight: '700', color: '#fff' },
  actionSecondaryText: { ...typography.body, fontWeight: '700', color: colors.text },
  actionSubPrimary:    { ...typography.small, color: 'rgba(255,255,255,0.65)' },
  actionSubSecondary:  { ...typography.small, color: colors.textSecondary },

  msgRow:  { width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.card },
  msgIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  msgText: { flex: 1 },
  msgTitle:{ ...typography.body, fontWeight: '700', color: colors.text },
  msgSub:  { ...typography.small, color: colors.textSecondary, lineHeight: 18, marginTop: 2 },
  msgArrow:{ fontSize: 22, color: colors.textSecondary },

  driftIdCard:      { width: '100%', backgroundColor: `${colors.primary}08`, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.primary}25`, padding: spacing.md, gap: spacing.sm },
  driftIdRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  driftIdLabel:     { ...typography.body, fontWeight: '700', color: colors.text },
  driftIdBadge:     { backgroundColor: `${colors.primary}18`, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  driftIdBadgeText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  driftIdDesc:      { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  driftIdBtn:       { alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  driftIdBtnText:   { ...typography.caption, color: '#fff', fontWeight: '700' },

  tips:      { width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  tipsTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  tip:       { ...typography.small, color: colors.textSecondary, lineHeight: 20 },
});
