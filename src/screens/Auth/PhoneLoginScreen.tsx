import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ConfirmationResult,
  signInWithPhoneNumber,
  type ApplicationVerifier,
} from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { auth } from '../../config/firebase';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { normalizePhone, formatIndianNumber } from '../../utils/helpers';
import { isBackendOtpEnabled, sendBackendOtp, verifyBackendOtp } from '../../services/otpService';
import { RootStackParamList } from '../../types';

/**
 * Firebase SDK v12 requires an ApplicationVerifier even when
 * appVerificationDisabledForTesting = true. In React Native there is no DOM
 * so we cannot use RecaptchaVerifier. This mock satisfies the interface and
 * is silently ignored by Firebase when testing-mode is on.
 *
 * _reset() is an internal Firebase method called after verification to clear
 * the reCAPTCHA widget. Must be present (even as a no-op) or iOS throws
 * "verify?._reset is not a function".
 */
const mockVerifier = {
  type: 'recaptcha' as const,
  verify: (): Promise<string> => Promise.resolve('test-token'),
  _reset: (): void => { /* no-op — no DOM widget to reset in React Native */ },
} as unknown as ApplicationVerifier;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PhoneLoginScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<Nav>();
  const [digits, setDigits]             = useState('');
  const [otp, setOtp]                   = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [backendSent, setBackendSent]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const useBackend = isBackendOtpEnabled();
  const otpStage   = useBackend ? backendSent : !!confirmation;
  const e164       = normalizePhone(digits);

  function onPhoneChange(val: string) {
    setDigits(val.replace(/\D/g, '').slice(0, 10));
    setError('');
  }

  // ─── Send OTP ─────────────────────────────────────────────────────────────
  async function sendOtp() {
    if (digits.length !== 10) { setError('Enter your 10-digit mobile number'); return; }
    if (!/^[6-9]/.test(digits)) { setError('Number must start with 6, 7, 8 or 9'); return; }
    setError('');
    setLoading(true);
    try {
      if (useBackend) {
        await sendBackendOtp(e164);
        setBackendSent(true);
      } else {
        // Pass mockVerifier — required by Firebase SDK v12 even in test mode.
        // Firebase ignores the token when appVerificationDisabledForTesting = true.
        const result = await signInWithPhoneNumber(auth, e164, mockVerifier);
        setConfirmation(result);
      }
    } catch (err: unknown) {
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  async function verifyOtp() {
    const code = otp.trim();
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      if (useBackend) {
        await verifyBackendOtp(e164, code);
      } else {
        await confirmation!.confirm(code);
      }
      // onAuthStateChanged in App.tsx handles navigation automatically
    } catch (err: unknown) {
      setError(parseOtpError(err));
    } finally {
      setLoading(false);
    }
  }

  function changeNumber() {
    setConfirmation(null);
    setBackendSent(false);
    setOtp('');
    setDigits('');
    setError('');
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Logo ── */}
      <View style={styles.logoSection}>
        <Text style={styles.logo}>Drift</Text>
        <Text style={styles.tagline}>Connect. Meet. Drift with purpose.</Text>
      </View>

      {/* ── Form ── */}
      <View style={styles.form}>
        {!otpStage ? (
          <>
            <Text style={styles.label}>Mobile Number</Text>

            <View style={[styles.phoneRow, error ? styles.inputErr : null]}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.code}>+91</Text>
              <View style={styles.divider} />
              <TextInput
                style={styles.phoneInput}
                value={formatIndianNumber(digits)}
                onChangeText={onPhoneChange}
                placeholder="98765 43210"
                placeholderTextColor={C.textTertiary}
                keyboardType="number-pad"
                maxLength={11}
                returnKeyType="done"
                onSubmitEditing={sendOtp}
                autoFocus
              />
              {digits.length === 10 && <Text style={styles.tick}>✓</Text>}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, (loading || digits.length !== 10) && styles.btnOff]}
              onPress={sendOtp}
              disabled={loading || digits.length !== 10}
              activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send OTP</Text>}
            </TouchableOpacity>

            {/* ── OR divider ── */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => navigation.navigate('EmailAuth')}
              activeOpacity={0.82}
            >
              <Text style={styles.emailBtnText}>Continue with Email →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter OTP</Text>
            <Text style={styles.sentTo}>
              Sent to +91 {formatIndianNumber(digits)}
            </Text>

            <TextInput
              style={[styles.otpInput, error ? styles.inputErr : null]}
              value={otp}
              onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="• • • • • •"
              placeholderTextColor={C.textTertiary}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={verifyOtp}
              autoFocus
              textAlign="center"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, (loading || otp.length !== 6) && styles.btnOff]}
              onPress={verifyOtp}
              disabled={loading || otp.length !== 6}
              activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify & Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.changeBtn} onPress={changeNumber}>
              <Text style={styles.changeBtnText}>← Change number</Text>
            </TouchableOpacity>

            {__DEV__ && !useBackend && (
              <TouchableOpacity
                onPress={() => Alert.alert('Dev tip', 'Use the test OTP code you set in Firebase Console → Auth → Phone → Test numbers.')}
                style={styles.hint}
              >
                <Text style={styles.hintText}>Not getting code?</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function parseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('invalid-phone-number') || msg.includes('INVALID_PHONE_NUMBER'))
    return 'Invalid phone number. Please check and try again.';
  if (msg.includes('too-many-requests'))
    return 'Too many attempts. Wait a few minutes.';
  if (msg.includes('argument-error'))
    return __DEV__
      ? 'Add this number as a Firebase test number (Console → Auth → Phone → Test numbers).'
      : 'Verification failed. Try again.';
  if (msg.includes('network') || msg.includes('Network'))
    return 'No internet. Check your connection.';
  return __DEV__ ? msg : 'Failed to send OTP. Try again.';
}

function parseOtpError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('invalid-verification-code') || msg.includes('INVALID_CODE'))
    return 'Wrong code. Check your SMS and try again.';
  if (msg.includes('code-expired') || msg.includes('SESSION_EXPIRED'))
    return 'Code expired. Go back and request a new one.';
  return __DEV__ ? msg : 'Invalid code. Try again.';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.background,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
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

    // Form card
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

    // Phone row
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: C.inputBorder,
      borderRadius: radius.md,
      backgroundColor: C.inputBg,
      height: 56,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    flag:      { fontSize: 22, marginRight: 6 },
    code:      { ...typography.body, fontWeight: '700', color: C.text, marginRight: 8 },
    divider:   { width: 1, height: 26, backgroundColor: C.border, marginRight: 10 },
    phoneInput: {
      flex: 1,
      ...typography.body,
      fontSize: 18,
      color: C.text,
      letterSpacing: 0.5,
    },
    tick: { fontSize: 18, color: C.success, fontWeight: '700', marginLeft: 4 },

    // OTP input
    otpInput: {
      borderWidth: 1.5,
      borderColor: C.inputBorder,
      borderRadius: radius.md,
      backgroundColor: C.inputBg,
      height: 64,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 14,
      color: C.text,
      marginBottom: spacing.sm,
    },

    inputErr: { borderColor: C.error },

    sentTo: {
      ...typography.body,
      color: C.textSecondary,
      marginBottom: spacing.md,
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

    changeBtn:     { alignSelf: 'center', marginTop: spacing.lg },
    changeBtnText: { ...typography.body, color: C.primary },

    hint:     { alignSelf: 'center', marginTop: spacing.md },
    hintText: { ...typography.small, color: C.textSecondary, textDecorationLine: 'underline' },

    // OR divider + email button
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: C.border,
    },
    orText: {
      ...typography.caption,
      color: C.textSecondary,
      marginHorizontal: spacing.sm,
      fontWeight: '600',
    },
    emailBtn: {
      borderWidth: 1.5,
      borderColor: C.primary,
      borderRadius: radius.md,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailBtnText: {
      ...typography.body,
      fontWeight: '700',
      color: C.primary,
      fontSize: 16,
    },
  });
}
