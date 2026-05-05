import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { auth } from '../../config/firebase';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EmailAuthScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<Nav>();

  const [mode, setMode]               = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  function switchMode(m: 'signin' | 'signup') {
    setMode(m);
    setError('');
    setPassword('');
    setConfirmPw('');
  }

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter a password.'); return; }

    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
        // onAuthStateChanged fires → RootNavigator sees emailVerified=false → shows EmailVerify
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        // onAuthStateChanged fires → RootNavigator routes automatically
      }
    } catch (err: unknown) {
      setError(parseEmailAuthError(err, mode));
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>Drift</Text>
          <Text style={styles.tagline}>Connect. Meet. Drift with purpose.</Text>
        </View>

        {/* ── Mode toggle ── */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'signin' && styles.toggleBtnActive]}
            onPress={() => switchMode('signin')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
            onPress={() => switchMode('signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, error && !password ? styles.inputErr : null]}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
            placeholder="you@example.com"
            placeholderTextColor={C.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter password'}
              placeholderTextColor={C.textTertiary}
              secureTextEntry={!showPw}
              returnKeyType={mode === 'signup' ? 'next' : 'done'}
              onSubmitEditing={mode === 'signin' ? handleSubmit : undefined}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw((p) => !p)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <>
              <Text style={[styles.label, { marginTop: spacing.md }]}>Confirm Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.inputInner}
                  value={confirmPw}
                  onChangeText={(v) => { setConfirmPw(v); setError(''); }}
                  placeholder="Re-enter password"
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showConfirmPw}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPw((p) => !p)}>
                  <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnOff]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Back link ── */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back to Phone</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function parseEmailAuthError(err: unknown, mode: 'signin' | 'signup'): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('weak-password'))
    return 'Password is too weak. Use at least 6 characters.';
  if (msg.includes('email-already-in-use'))
    return 'An account with this email already exists. Try signing in.';
  if (msg.includes('user-not-found') || msg.includes('invalid-credential'))
    return 'No account found with this email. Try signing up.';
  if (msg.includes('wrong-password'))
    return 'Incorrect password. Please try again.';
  if (msg.includes('invalid-email'))
    return 'Please enter a valid email address.';
  if (msg.includes('network') || msg.includes('Network'))
    return 'No internet. Check your connection.';
  if (msg.includes('too-many-requests'))
    return 'Too many attempts. Wait a few minutes and try again.';
  return __DEV__ ? msg : `Failed to ${mode === 'signup' ? 'create account' : 'sign in'}. Try again.`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
    },

    // Logo
    logoSection: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logo: {
      fontSize: 56,
      fontWeight: '800',
      color: C.primary,
      letterSpacing: -2,
      marginBottom: spacing.xs,
    },
    tagline: {
      ...typography.body,
      color: C.textSecondary,
      textAlign: 'center',
    },

    // Mode toggle
    toggle: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: radius.md,
      padding: 4,
      marginBottom: spacing.xl,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radius.sm,
    },
    toggleBtnActive: {
      backgroundColor: C.primary,
    },
    toggleText: {
      ...typography.body,
      fontWeight: '600',
      color: C.textSecondary,
    },
    toggleTextActive: {
      color: '#fff',
    },

    // Form
    form: {
      backgroundColor: C.background,
    },

    label: {
      ...typography.caption,
      fontWeight: '700',
      color: C.textSecondary,
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
    },

    input: {
      borderWidth: 1.5,
      borderColor: C.inputBorder,
      borderRadius: radius.md,
      backgroundColor: C.inputBg,
      height: 56,
      paddingHorizontal: spacing.md,
      ...typography.body,
      fontSize: 16,
      color: C.text,
      marginBottom: spacing.sm,
    },
    inputErr: {
      borderColor: C.error,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: C.inputBorder,
      borderRadius: radius.md,
      backgroundColor: C.inputBg,
      height: 56,
      marginBottom: spacing.sm,
    },
    inputInner: {
      flex: 1,
      paddingHorizontal: spacing.md,
      ...typography.body,
      fontSize: 16,
      color: C.text,
    },
    eyeBtn: {
      paddingHorizontal: spacing.md,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },

    errorText: {
      ...typography.small,
      color: C.error,
      marginBottom: spacing.sm,
    },

    // Button
    btn: {
      backgroundColor: C.primary,
      borderRadius: radius.md,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
      ...shadows.card,
    },
    btnOff: { opacity: 0.4 },
    btnText: { ...typography.body, fontWeight: '700', color: '#fff', fontSize: 16 },

    // Back link
    backBtn:     { alignSelf: 'center', marginTop: spacing.xl },
    backBtnText: { ...typography.body, color: C.primary },
  });
}
