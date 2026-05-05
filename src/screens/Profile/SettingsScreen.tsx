import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut, deleteUser, reauthenticateWithCredential, PhoneAuthProvider } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useTheme } from '../../utils/useTheme';
import { radius, spacing, shadows } from '../../utils/theme';
import { ProfileStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

// ─── Row components ────────────────────────────────────────────────────────────

function SettingRow({
  icon, label, sublabel, iconGrad, onPress, rightEl, danger, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  iconGrad: readonly [string, string];
  onPress?: () => void;
  rightEl?: React.ReactNode;
  danger?: boolean;
  C: ReturnType<typeof useTheme>['C'];
}) {
  return (
    <TouchableOpacity
      style={[row.wrap, { borderBottomColor: C.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <LinearGradient colors={iconGrad} style={row.iconBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name={icon} size={16} color="#fff" />
      </LinearGradient>
      <View style={row.labelWrap}>
        <Text style={[row.label, { color: danger ? '#EF4444' : C.text }]}>{label}</Text>
        {sublabel ? <Text style={[row.sub, { color: C.textSecondary }]}>{sublabel}</Text> : null}
      </View>
      {rightEl ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={C.textTertiary} /> : null)}
    </TouchableOpacity>
  );
}

const row = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  labelWrap:{ flex: 1 },
  label:   { fontSize: 15, fontWeight: '600' },
  sub:     { fontSize: 12, marginTop: 1 },
});

function SectionHeader({ title, C }: { title: string; C: ReturnType<typeof useTheme>['C'] }) {
  return (
    <Text style={[sec.title, { color: C.textSecondary }]}>{title}</Text>
  );
}
const sec = StyleSheet.create({
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 28, marginBottom: 8 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const navigation  = useNavigation<Nav>();
  const { C, isDark } = useTheme();
  const { toggle }  = useThemeStore();
  const { firebaseUser, userProfile, reset } = useAuthStore();
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Sign out ──────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut(auth).catch(() => {});
        reset();
      }},
    ]);
  }

  // ── Delete account ────────────────────────────────────────────────────────
  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              `Type DELETE below is not implemented — tap confirm to proceed.\n\nUID: ${firebaseUser?.uid}`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm Delete', style: 'destructive', onPress: doDeleteAccount },
              ],
            );
          },
        },
      ],
    );
  }

  async function doDeleteAccount() {
    if (!firebaseUser) return;
    setDeletingAccount(true);
    try {
      // Delete Firestore user doc
      await deleteDoc(doc(db, 'users', firebaseUser.uid)).catch(() => {});
      // Delete Firebase Auth user
      await deleteUser(firebaseUser);
      reset();
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Re-authentication needed',
          'For security, please sign out and sign back in, then try deleting your account again.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Error', 'Could not delete account. Please contact support at support@driftapp.in');
      }
    } finally {
      setDeletingAccount(false);
    }
  }

  const bg = C.background;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Subtle gradient overlay on dark mode */}
      {isDark && (
        <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />
      )}

      <SafeAreaView style={s.flex}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : ['#FFFFFF', '#F8F9FA']}
          style={[s.header, { borderBottomColor: C.border }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={isDark ? ['#ffffff18', '#ffffff0A'] : ['#F3F4F6', '#E5E7EB']}
              style={s.backBtn}
            >
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: C.text }]}>Settings</Text>
            <Text style={[s.headerSub, { color: C.textSecondary }]}>Preferences & account</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView
          style={[s.scroll, { backgroundColor: 'transparent' }]}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Appearance ─────────────────────────────────────────── */}
          <SectionHeader title="Appearance" C={C} />
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingRow
              icon="moon-outline"
              label="Dark Mode"
              sublabel={isDark ? 'Currently dark — looking sleek 🌙' : 'Currently light — fresh & clean ☀️'}
              iconGrad={isDark ? ['#6C5CE7', '#4834D4'] : ['#F59E0B', '#FF8C00']}
              C={C}
              rightEl={
                <Switch
                  value={isDark}
                  onValueChange={toggle}
                  trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
                  thumbColor={isDark ? '#A29BFE' : '#fff'}
                />
              }
            />
          </View>

          {/* ── Account ────────────────────────────────────────────── */}
          <SectionHeader title="Account" C={C} />
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingRow icon="person-outline"    label="Edit Profile"       sublabel="Update your name, bio & photos"  iconGrad={['#FF4B6E', '#C2185B']} C={C} onPress={() => navigation.navigate('EditProfile')} />
            <SettingRow icon="at-outline"         label="Drift ID & Handle"  sublabel={userProfile?.driftId ? `@${userProfile.driftId}` : 'Set your @handle'} iconGrad={['#00D2FF', '#0077FF']} C={C} onPress={() => navigation.navigate('DriftId')} />
            <SettingRow icon="shield-checkmark-outline" label="Privacy Settings" sublabel="Control who sees what"      iconGrad={['#6C5CE7', '#4834D4']} C={C} onPress={() => navigation.navigate('PrivacySettings')} />
          </View>

          {/* ── Coins & Rewards ──────────────────────────────────── */}
          <SectionHeader title="Coins & Rewards" C={C} />
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingRow
              icon="time-outline"
              label="Coin History"
              sublabel="See all your earned & spent coins"
              iconGrad={['#FFD700', '#FF8C00']}
              C={C}
              onPress={() => navigation.navigate('CoinHistory')}
              rightEl={
                <View style={s.coinBadge}>
                  <Ionicons name="flash" size={11} color="#FFD700" />
                  <Text style={s.coinBadgeText}>{userProfile?.coins ?? 0}</Text>
                </View>
              }
            />
          </View>

          {/* ── Support ─────────────────────────────────────────── */}
          <SectionHeader title="Support" C={C} />
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingRow icon="chatbubble-ellipses-outline" label="Send Feedback"     sublabel="Rate the app & share suggestions" iconGrad={['#00E676', '#00BCD4']} C={C} onPress={() => navigation.navigate('Feedback')} />
            <SettingRow icon="document-text-outline"       label="Terms & Privacy"   sublabel="Read our policies"                iconGrad={['#8888BB', '#555580']} C={C} onPress={() => navigation.navigate('Terms')} />
          </View>

          {/* ── Danger zone ──────────────────────────────────────── */}
          <SectionHeader title="Danger Zone" C={C} />
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <SettingRow
              icon="log-out-outline"
              label="Sign Out"
              sublabel="You can sign back in anytime"
              iconGrad={['#EF4444', '#C62828']}
              C={C}
              onPress={handleSignOut}
              danger
            />
            <SettingRow
              icon="trash-outline"
              label={deletingAccount ? 'Deleting…' : 'Delete Account'}
              sublabel="Permanently remove all your data"
              iconGrad={['#FF0000', '#8B0000']}
              C={C}
              onPress={deletingAccount ? undefined : handleDeleteAccount}
              danger
              rightEl={
                deletingAccount
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              }
            />
          </View>

          {/* Version */}
          <Text style={[s.version, { color: C.textTertiary }]}>Drift v1.0.0 · Made with ❤️ in Bengaluru</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  flex:  { flex: 1 },
  scroll:{ flex: 1 },
  content:{ paddingHorizontal: spacing.lg, paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  headerSub:    { fontSize: 12, marginTop: 1 },

  card: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    ...shadows.card, shadowColor: '#000', shadowOpacity: 0.15,
  },

  coinBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFD70022', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  coinBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFD700' },

  version: { textAlign: 'center', fontSize: 11, marginTop: 32, marginBottom: 8 },
});
