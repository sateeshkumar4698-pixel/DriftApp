import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {
  ConfirmationResult,
  signInWithPhoneNumber,
  type ApplicationVerifier,
} from 'firebase/auth';
import RecaptchaVerifierModal, {
  type RecaptchaVerifierRef,
} from '../../components/RecaptchaVerifierModal';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { normalizePhone, formatIndianNumber } from '../../utils/helpers';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PhoneLoginScreen() {
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<Nav>();

  const [digits, setDigits]             = useState('');
  const [otp, setOtp]                   = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const recaptchaRef    = useRef<RecaptchaVerifierRef>(null);
  const resendTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRef     = useRef<TextInput>(null);

  const e164     = normalizePhone(digits);
  const otpStage = !!confirmation;
  const canSend  = digits.length === 10 && /^[6-9]/.test(digits);

  useEffect(() => {
    return () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); };
  }, []);

  // Auto-focus OTP input when stage changes
  useEffect(() => {
    if (otpStage) setTimeout(() => otpInputRef.current?.focus(), 200);
  }, [otpStage]);

  function startResendCountdown() {
    setResendCountdown(60);
    resendTimerRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) { clearInterval(resendTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function onPhoneChange(val: string) {
    setDigits(val.replace(/\D/g, '').slice(0, 10));
    setError('');
  }

  // ─── Send OTP ─────────────────────────────────────────────────────────────
  async function sendOtp() {
    if (!canSend || loading) return;
    setError('');
    setLoading(true);
    try {
      if (!recaptchaRef.current) {
        setError('Verification not ready. Please wait a moment and try again.');
        setLoading(false);
        return;
      }
      // In __DEV__ appVerificationDisabledForTesting=true so verify() resolves
      // instantly; in prod it shows the reCAPTCHA modal first.
      await recaptchaRef.current.verify();
      const verifier = recaptchaRef.current as unknown as ApplicationVerifier;
      const result = await signInWithPhoneNumber(auth, e164, verifier);
      setConfirmation(result);
      startResendCountdown();
    } catch (err: unknown) {
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  async function verifyOtp() {
    const code = otp.trim();
    if (code.length !== 6 || loading) return;
    setError('');
    setLoading(true);
    try {
      await confirmation!.confirm(code);
      // onAuthStateChanged in App.tsx handles navigation automatically
    } catch (err: unknown) {
      setError(parseOtpError(err));
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (resendCountdown > 0 || loading) return;
    setOtp('');
    setError('');
    setLoading(true);
    try {
      if (!recaptchaRef.current) { setError('Verification not ready. Try again.'); setLoading(false); return; }
      await recaptchaRef.current.verify();
      const verifier = recaptchaRef.current as unknown as ApplicationVerifier;
      const result = await signInWithPhoneNumber(auth, e164, verifier);
      setConfirmation(result);
      startResendCountdown();
    } catch (err: unknown) {
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  function changeNumber() {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setResendCountdown(0);
    setConfirmation(null);
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* reCAPTCHA — shown only in production; bypassed in dev mode */}
      <RecaptchaVerifierModal
        ref={recaptchaRef}
        title="Quick Verification"
        cancelLabel="Cancel"
        attemptInvisibleVerification
      />

      {/* ── Brand top section ── */}
      <View style={styles.brand}>
        <Text style={styles.logo}>Drift</Text>
        <Text style={styles.tagline}>Meet people. Make memories.</Text>
      </View>

      {/* ── Card ── */}
      <View style={styles.card}>
        {!otpStage ? (
          /* ── Phone entry ── */
          <>
            <Text style={styles.cardTitle}>Enter your number</Text>
            <Text style={styles.cardSub}>We'll send a one-time code via SMS</Text>

            <View style={[styles.phoneRow, error ? styles.fieldErr : null]}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.dialCode}>+91</Text>
              <View style={styles.sep} />
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
              {canSend && (
                <Ionicons name="checkmark-circle" size={22} color={C.success} />
              )}
            </View>

            {error ? <Text style={styles.errText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (!canSend || loading) && styles.btnDisabled]}
              onPress={sendOtp}
              disabled={!canSend || loading}
              activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Send OTP →</Text>}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => navigation.navigate('EmailAuth')}
              activeOpacity={0.82}
            >
              <Ionicons name="mail-outline" size={18} color={C.primary} style={{ marginRight: 8 }} />
              <Text style={styles.emailBtnText}>Continue with Email</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ── OTP entry ── */
          <>
            <TouchableOpacity style={styles.backRow} onPress={changeNumber}>
              <Ionicons name="arrow-back" size={20} color={C.primary} />
              <Text style={styles.backRowText}>+91 {formatIndianNumber(digits)}</Text>
            </TouchableOpacity>

            <Text style={styles.cardTitle}>Enter the code</Text>
            <Text style={styles.cardSub}>6-digit code sent to your number</Text>

            <TextInput
              ref={otpInputRef}
              style={[styles.otpInput, error ? styles.fieldErr : null]}
              value={otp}
              onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="• • • • • •"
              placeholderTextColor={C.textTertiary}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={verifyOtp}
              textAlign="center"
            />

            {error ? <Text style={styles.errText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (loading || otp.length !== 6) && styles.btnDisabled]}
              onPress={verifyOtp}
              disabled={loading || otp.length !== 6}
              activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Verify & Continue →</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendBtn, (resendCountdown > 0 || loading) && { opacity: 0.4 }]}
              onPress={resendOtp}
              disabled={resendCountdown > 0 || loading}
              activeOpacity={0.7}
            >
              <Text style={styles.resendText}>
                {resendCountdown > 0
                  ? `Resend code in ${resendCountdown}s`
                  : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.legal}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
    </KeyboardAvoidingView>
  );
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function parseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('invalid-phone-number') || msg.includes('INVALID_PHONE_NUMBER'))
    return 'Invalid phone number. Please check and try again.';
  if (msg.includes('too-many-requests') || msg.includes('quota-exceeded'))
    return 'Too many attempts. Please wait a few minutes.';
  if (msg.includes('network') || msg.includes('Network') || msg.includes('fetch'))
    return 'Network error. Check your internet connection.';
  if (msg.includes('app-not-authorized') || msg.includes('APP_NOT_AUTHORIZED'))
    return 'App not authorised for SMS. Please contact support.';
  if (msg.includes('captcha') || msg.includes('recaptcha'))
    return 'Verification failed. Please try again.';
  return __DEV__ ? `OTP error: ${msg}` : 'Failed to send OTP. Please try again.';
}

function parseOtpError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('invalid-verification-code') || msg.includes('INVALID_CODE'))
    return 'Wrong code. Check your SMS and try again.';
  if (msg.includes('code-expired') || msg.includes('SESSION_EXPIRED'))
    return 'Code expired. Request a new one.';
  if (msg.includes('network') || msg.includes('Network'))
    return 'Network error. Check your connection.';
  return __DEV__ ? `Verify error: ${msg}` : 'Invalid code. Please try again.';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.background,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },

    // Brand
    brand: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logo: {
      fontSize: 52,
      fontWeight: '800',
      color: C.primary,
      letterSpacing: -2,
      marginBottom: 4,
    },
    tagline: {
      ...typography.body,
      color: C.textSecondary,
    },

    // Card
    card: {
      backgroundColor: C.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      ...shadows.modal,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardTitle: {
      ...typography.h2,
      color: C.text,
      marginBottom: spacing.xs,
    },
    cardSub: {
      ...typography.body,
      color: C.textSecondary,
      marginBottom: spacing.lg,
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
    flag:      { fontSize: 20 },
    dialCode:  { ...typography.body, fontWeight: '700', color: C.text, marginHorizontal: 8 },
    sep:       { width: 1, height: 24, backgroundColor: C.border, marginRight: 10 },
    phoneInput: {
      flex: 1,
      ...typography.body,
      fontSize: 18,
      color: C.text,
      letterSpacing: 0.5,
    },
    fieldErr: { borderColor: C.error },

    // OTP input
    otpInput: {
      borderWidth: 1.5,
      borderColor: C.inputBorder,
      borderRadius: radius.md,
      backgroundColor: C.inputBg,
      height: 68,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: 16,
      color: C.text,
      marginBottom: spacing.sm,
    },

    errText: {
      ...typography.small,
      color: C.error,
      marginBottom: spacing.sm,
    },

    // Primary button
    primaryBtn: {
      backgroundColor: C.primary,
      borderRadius: radius.md,
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
      ...shadows.card,
    },
    btnDisabled: { opacity: 0.4 },
    primaryBtnText: {
      ...typography.body,
      fontWeight: '700',
      color: '#fff',
      fontSize: 16,
    },

    // Divider
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
    dividerText: {
      ...typography.caption,
      color: C.textSecondary,
      marginHorizontal: spacing.md,
      fontWeight: '600',
    },

    // Email button
    emailBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: C.primary,
      borderRadius: radius.md,
      height: 52,
    },
    emailBtnText: {
      ...typography.body,
      fontWeight: '700',
      color: C.primary,
      fontSize: 16,
    },

    // Back row (OTP stage)
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.lg,
    },
    backRowText: {
      ...typography.body,
      color: C.primary,
      fontWeight: '600',
    },

    // Resend
    resendBtn: {
      alignSelf: 'center',
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    resendText: {
      ...typography.body,
      color: C.primary,
      fontWeight: '600',
    },

    // Legal
    legal: {
      ...typography.small,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: spacing.xl,
      lineHeight: 18,
    },
  });
}
