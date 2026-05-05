import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import { useTheme, AppColors, spacing, radius, shadows } from '../../utils/useTheme';
import { validateDriftId, generateUsername } from '../../utils/profileShare';

// ─── Rules card ───────────────────────────────────────────────────────────────

const RULES = [
  { icon: 'text-outline' as const,          text: '3–20 characters' },
  { icon: 'at-circle-outline' as const,     text: 'Letters, numbers, dots & underscores only' },
  { icon: 'close-circle-outline' as const,  text: 'No spaces or special characters' },
  { icon: 'refresh-circle-outline' as const,text: 'Can be changed anytime' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DriftIdScreen() {
  const navigation = useNavigation();
  const { C, isDark } = useTheme();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();

  const [driftId,     setDriftId]      = useState(userProfile?.driftId ?? '');
  const [error,       setError]        = useState('');
  const [checking,    setChecking]     = useState(false);
  const [available,   setAvailable]    = useState<boolean | null>(null);
  const [saving,      setSaving]       = useState(false);
  const [focused,     setFocused]      = useState(false);

  const currentId = userProfile?.driftId ?? '';
  const trimmed   = driftId.toLowerCase().trim();
  const unchanged = trimmed === currentId;

  // Live-validate format
  function handleChange(v: string) {
    const clean = v.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setDriftId(clean);
    setError('');
    setAvailable(null);
  }

  // Availability check
  async function checkAvailability() {
    const validationError = validateDriftId(trimmed);
    if (validationError) { setError(validationError); return; }
    if (unchanged) { setError(''); setAvailable(true); return; }
    setChecking(true);
    try {
      const snap = await getDoc(doc(db, 'driftIds', trimmed));
      if (snap.exists() && snap.data()?.uid !== firebaseUser?.uid) {
        setAvailable(false);
        setError('This Drift ID is already taken.');
      } else {
        setAvailable(true);
        setError('');
      }
    } catch {
      setError('Could not check availability. Try again.');
    } finally {
      setChecking(false);
    }
  }

  async function handleSave() {
    if (!firebaseUser || !userProfile) return;
    const validationError = validateDriftId(trimmed);
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      let resolvedDriftId = currentId;

      if (trimmed && trimmed !== currentId) {
        // Final availability check
        const snap = await getDoc(doc(db, 'driftIds', trimmed));
        if (snap.exists() && snap.data()?.uid !== firebaseUser.uid) {
          setError('This Drift ID is already taken. Try another.');
          setSaving(false);
          return;
        }
        // Reserve new ID
        await setDoc(doc(db, 'driftIds', trimmed), { uid: firebaseUser.uid });
        // Release old ID if it existed
        if (currentId) {
          await setDoc(doc(db, 'driftIds', currentId), { uid: null }).catch(() => {});
        }
        resolvedDriftId = trimmed;
      }

      const username = userProfile.username || generateUsername(userProfile.name, firebaseUser.uid);

      // Recalculate profile completeness so setting a Drift ID is reflected
      // (DriftId contributes ~5pts towards discovery ranking)
      const profileCompleteness = Math.min(
        100,
        (userProfile.profileCompleteness ?? 0) + (resolvedDriftId && !currentId ? 5 : 0),
      );

      const updated  = { ...userProfile, driftId: resolvedDriftId, username, profileCompleteness };
      await setUserProfile(firebaseUser.uid, { driftId: resolvedDriftId, username, profileCompleteness });
      setStoreProfile(updated);
      Alert.alert('Saved! ✅', `Your Drift ID is now @${resolvedDriftId}`, [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save Drift ID. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Border colour logic
  const borderColor = error
    ? C.error
    : available === true
    ? C.success
    : focused
    ? C.secondary
    : C.border;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}

      <SafeAreaView style={s.flex}>
        {/* ── Header ── */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : ['#FFFFFF', '#F8F9FA']}
          style={[s.header, { borderBottomColor: C.border }]}
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
            <Text style={[s.headerTitle, { color: C.text }]}>Drift ID & Handle</Text>
            <Text style={[s.headerSub, { color: C.textSecondary }]}>Your unique identity on Drift</Text>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={saving || unchanged}>
            {saving ? (
              <ActivityIndicator color={C.primary} size="small" />
            ) : (
              <LinearGradient
                colors={unchanged ? [C.border, C.border] : ['#FF4B6E', '#C2185B']}
                style={s.saveBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={[s.saveBtnText, unchanged && { color: C.textSecondary }]}>Save</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </LinearGradient>

        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Current ID banner ── */}
            {currentId ? (
              <View style={[s.currentBanner, { backgroundColor: `${C.secondary}12`, borderColor: `${C.secondary}25` }]}>
                <LinearGradient colors={['#6C5CE7', '#00D2FF']} style={s.currentAtBox}>
                  <Text style={s.currentAt}>@</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[s.currentLabel, { color: C.textSecondary }]}>Current Drift ID</Text>
                  <Text style={[s.currentValue, { color: C.text }]}>{currentId}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={C.success} />
              </View>
            ) : (
              <View style={[s.notSetBanner, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}20` }]}>
                <Ionicons name="information-circle-outline" size={18} color={C.primary} />
                <Text style={[s.notSetText, { color: C.textSecondary }]}>
                  You haven't set a Drift ID yet. Set one to let friends find you easily.
                </Text>
              </View>
            )}

            {/* ── Input card ── */}
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }, shadows.card]}>
              <Text style={[s.cardTitle, { color: C.text }]}>Choose your @handle</Text>
              <Text style={[s.cardSub, { color: C.textSecondary }]}>
                People can find and add you using this ID.
              </Text>

              <View style={[s.inputRow, { borderColor }]}>
                <LinearGradient colors={['#00D2FF', '#6C5CE7']} style={s.atBox}>
                  <Text style={s.atSymbol}>@</Text>
                </LinearGradient>
                <TextInput
                  style={[s.input, { color: C.text }]}
                  value={driftId}
                  onChangeText={handleChange}
                  placeholder="yourhandle"
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  onFocus={() => setFocused(true)}
                  onBlur={() => { setFocused(false); if (trimmed && !unchanged) checkAvailability(); }}
                />
                {checking && <ActivityIndicator size="small" color={C.secondary} style={{ marginRight: 8 }} />}
                {!checking && available === true && !unchanged && (
                  <Ionicons name="checkmark-circle" size={20} color={C.success} style={{ marginRight: 8 }} />
                )}
                {!checking && available === false && (
                  <Ionicons name="close-circle" size={20} color={C.error} style={{ marginRight: 8 }} />
                )}
              </View>

              {/* Status message */}
              {error ? (
                <View style={s.statusRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={C.error} />
                  <Text style={[s.statusText, { color: C.error }]}>{error}</Text>
                </View>
              ) : available === true && !unchanged ? (
                <View style={s.statusRow}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={C.success} />
                  <Text style={[s.statusText, { color: C.success }]}>@{trimmed} is available!</Text>
                </View>
              ) : (
                <Text style={[s.hint, { color: C.textTertiary }]}>
                  {trimmed.length > 0 ? `${trimmed.length}/20 characters` : 'Letters, numbers, underscores, dots only'}
                </Text>
              )}

              {/* Check availability button */}
              {trimmed.length >= 3 && !unchanged && (
                <TouchableOpacity
                  style={[s.checkBtn, { borderColor: C.secondary, backgroundColor: `${C.secondary}10` }]}
                  onPress={checkAvailability}
                  disabled={checking}
                >
                  <Ionicons name="search-outline" size={14} color={C.secondary} />
                  <Text style={[s.checkBtnText, { color: C.secondary }]}>Check Availability</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Rules card ── */}
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }, shadows.card]}>
              <View style={s.rulesHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#6C5CE7" />
                <Text style={[s.cardTitle, { color: C.text }]}>Handle Rules</Text>
              </View>
              {RULES.map((rule) => (
                <View key={rule.text} style={s.ruleRow}>
                  <View style={[s.ruleIconBox, { backgroundColor: '#6C5CE715' }]}>
                    <Ionicons name={rule.icon} size={13} color="#6C5CE7" />
                  </View>
                  <Text style={[s.ruleText, { color: C.textSecondary }]}>{rule.text}</Text>
                </View>
              ))}
            </View>

            {/* ── Share card ── */}
            {currentId && (
              <View style={[s.card, { backgroundColor: `${C.primary}08`, borderColor: `${C.primary}20` }, shadows.card]}>
                <View style={s.rulesHeader}>
                  <Ionicons name="share-social-outline" size={16} color={C.primary} />
                  <Text style={[s.cardTitle, { color: C.text }]}>Share Your Profile</Text>
                </View>
                <Text style={[s.cardSub, { color: C.textSecondary }]}>
                  Your profile link:
                </Text>
                <View style={[s.linkBox, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={[s.linkText, { color: C.text }]}>drift.app/@{currentId}</Text>
                  <Ionicons name="copy-outline" size={16} color={C.textSecondary} />
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.md },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700' },
  headerSub:    { fontSize: 11, marginTop: 1 },
  saveBtn:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  saveBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  currentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
    marginBottom: spacing.md,
  },
  currentAtBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  currentAt:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  currentLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  currentValue: { fontSize: 16, fontWeight: '800' },

  notSetBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
    marginBottom: spacing.md,
  },
  notSetText: { flex: 1, fontSize: 13, lineHeight: 19 },

  card: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSub:   { fontSize: 12, marginBottom: spacing.md },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: radius.md,
    overflow: 'hidden', marginTop: spacing.sm,
    height: 52,
  },
  atBox:    { width: 46, height: '100%', alignItems: 'center', justifyContent: 'center' },
  atSymbol: { fontSize: 20, fontWeight: '800', color: '#fff' },
  input:    { flex: 1, fontSize: 16, fontWeight: '600', paddingHorizontal: spacing.sm },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  statusText: { fontSize: 12, fontWeight: '500' },
  hint:       { fontSize: 12, marginTop: 7 },

  checkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: spacing.md,
    paddingVertical: 9, borderRadius: radius.full, borderWidth: 1,
  },
  checkBtnText: { fontSize: 13, fontWeight: '700' },

  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 10 },
  ruleIconBox: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  ruleText:    { fontSize: 13, flex: 1 },

  linkBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginTop: 4,
  },
  linkText: { fontSize: 14, fontWeight: '600' },
});
