import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../utils/useTheme';
import { spacing, radius, shadows } from '../../utils/theme';

const CATEGORIES = [
  { label: 'Bug Report',    icon: 'bug-outline' as const,           grad: ['#EF4444', '#C62828'] as const },
  { label: 'Feature Idea',  icon: 'bulb-outline' as const,          grad: ['#FFD700', '#FF8C00'] as const },
  { label: 'UI/Design',     icon: 'color-palette-outline' as const,  grad: ['#6C5CE7', '#4834D4'] as const },
  { label: 'Performance',   icon: 'speedometer-outline' as const,    grad: ['#00D2FF', '#0077FF'] as const },
  { label: 'Other',         icon: 'chatbubble-outline' as const,     grad: ['#00E676', '#00BCD4'] as const },
];

const STAR_LABELS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Amazing!'];

export default function FeedbackScreen() {
  const navigation    = useNavigation();
  const { C, isDark } = useTheme();
  const { firebaseUser, userProfile } = useAuthStore();

  const [rating,   setRating]   = useState(0);
  const [category, setCategory] = useState('');
  const [text,     setText]     = useState('');
  const [focused,  setFocused]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  async function handleSubmit() {
    if (rating === 0) { Alert.alert('Rate us first', 'Please tap a star to rate your experience.'); return; }
    if (!text.trim())  { Alert.alert('Add feedback', 'Please write a short note so we can improve.'); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        uid:       firebaseUser?.uid ?? 'anonymous',
        name:      userProfile?.name ?? '',
        rating,
        category,
        text:      text.trim(),
        createdAt: serverTimestamp(),
        version:   '1.0.0',
        platform:  Platform.OS,
      });
      setDone(true);
    } catch {
      Alert.alert('Error', 'Could not submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}

      <SafeAreaView style={s.flex}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : ['#FFFFFF', '#F8F9FA']}
          style={[s.header, { borderBottomColor: C.border }]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient colors={isDark ? ['#ffffff18', '#ffffff0A'] : ['#F3F4F6', '#E5E7EB']} style={s.backBtn}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: C.text }]}>Feedback</Text>
            <Text style={[s.headerSub, { color: C.textSecondary }]}>Help us build better</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        {done ? (
          /* ── Success state ─────────────────────────────────────────── */
          <View style={s.doneWrap}>
            <LinearGradient colors={['#00E676', '#00BCD4']} style={s.doneIcon}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </LinearGradient>
            <Text style={[s.doneTitle, { color: C.text }]}>Thank you! 🙌</Text>
            <Text style={[s.doneSub, { color: C.textSecondary }]}>
              Your feedback helps us make Drift better for everyone. We read every single message!
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <LinearGradient colors={['#FF4B6E', '#C2185B']} style={s.doneBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.doneBtnText}>Back to Settings</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── Star rating ──────────────────────────────────────── */}
              <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.cardTitle, { color: C.text }]}>How's your experience?</Text>
                <View style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                      <Ionicons
                        name={n <= rating ? 'star' : 'star-outline'}
                        size={40}
                        color={n <= rating ? '#FFD700' : C.border}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {rating > 0 && (
                  <LinearGradient
                    colors={rating >= 4 ? ['#00E676', '#00BCD4'] : rating === 3 ? ['#FFD700', '#FF8C00'] : ['#EF4444', '#C62828']}
                    style={s.ratingLabel}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={s.ratingLabelText}>{STAR_LABELS[rating]}</Text>
                  </LinearGradient>
                )}
              </View>

              {/* ── Category ──────────────────────────────────────────── */}
              <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.cardTitle, { color: C.text }]}>What's it about?</Text>
                <Text style={[s.cardSub, { color: C.textSecondary }]}>Optional — helps us route it faster</Text>
                <View style={s.catGrid}>
                  {CATEGORIES.map((cat) => {
                    const sel = category === cat.label;
                    return (
                      <TouchableOpacity key={cat.label} style={s.catWrap} onPress={() => setCategory(sel ? '' : cat.label)} activeOpacity={0.75}>
                        {sel ? (
                          <LinearGradient colors={cat.grad} style={s.catSel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Ionicons name={cat.icon} size={15} color="#fff" />
                            <Text style={s.catLabelSel}>{cat.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={[s.catUnsel, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
                            <Ionicons name={cat.icon} size={15} color={C.textSecondary} />
                            <Text style={[s.catLabel, { color: C.textSecondary }]}>{cat.label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Text input ────────────────────────────────────────── */}
              <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.cardTitle, { color: C.text }]}>Tell us more</Text>
                <View style={[s.textBox, { backgroundColor: C.inputBg, borderColor: focused ? C.inputFocus : C.inputBorder }]}>
                  <TextInput
                    style={[s.textInput, { color: C.text }]}
                    value={text}
                    onChangeText={setText}
                    placeholder="What can we improve? What do you love? Any bugs?"
                    placeholderTextColor={C.textTertiary}
                    multiline
                    maxLength={500}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                  <Text style={[s.charCount, { color: C.textTertiary }]}>{text.length}/500</Text>
                </View>
              </View>

              {/* ── Submit ────────────────────────────────────────────── */}
              <TouchableOpacity onPress={handleSubmit} activeOpacity={0.85} disabled={loading}>
                <LinearGradient colors={['#FF4B6E', '#C2185B', '#6C5CE7']} style={s.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="send-outline" size={18} color="#fff" />
                        <Text style={s.submitText}>Send Feedback</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

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
  headerTitle:  { fontSize: 18, fontWeight: '700' },
  headerSub:    { fontSize: 12, marginTop: 1 },

  card: {
    borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, marginBottom: spacing.md,
    ...shadows.card, shadowColor: '#000', shadowOpacity: 0.15,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSub:   { fontSize: 12, marginBottom: 12 },

  starsRow:   { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  ratingLabel:{ alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.full, marginTop: 4 },
  ratingLabelText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  catGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginTop: spacing.sm },
  catWrap:  { width: '48.5%' },
  catSel:   { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.lg },
  catUnsel: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1.5 },
  catLabelSel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  catLabel:    { fontSize: 12, fontWeight: '600' },

  textBox: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginTop: spacing.sm, minHeight: 120 },
  textInput:{ fontSize: 14, lineHeight: 22, minHeight: 90 },
  charCount:{ fontSize: 11, textAlign: 'right', marginTop: 6 },

  submitBtn: { height: 56, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.md },
  submitText:{ fontSize: 16, fontWeight: '800', color: '#fff' },

  // Done state
  doneWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  doneIcon:  { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '800' },
  doneSub:   { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  doneBtn:   { paddingHorizontal: 32, paddingVertical: 14, borderRadius: radius.full, marginTop: spacing.sm },
  doneBtnText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
});
