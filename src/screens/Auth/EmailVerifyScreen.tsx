import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';

const RESEND_COOLDOWN = 60; // seconds
const POLL_INTERVAL  = 3000; // ms

export default function EmailVerifyScreen() {
  const { setFirebaseUser, reset } = useAuthStore();

  const email = auth.currentUser?.email ?? '';

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending]           = useState(false);
  const [resendMsg, setResendMsg]           = useState('');

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Poll for email verification ──────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        if (auth.currentUser?.emailVerified) {
          if (pollRef.current) clearInterval(pollRef.current);
          // Updating the store with the refreshed user triggers RootNavigator to proceed
          setFirebaseUser(auth.currentUser);
        }
      } catch {
        // Network hiccup — silently retry next tick
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [setFirebaseUser]);

  // ─── Resend cooldown ticker ────────────────────────────────────────────────
  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ─── Resend ───────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendMsg('');
    try {
      const { sendEmailVerification } = await import('firebase/auth');
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        setResendMsg('Verification email sent!');
        startCooldown();
      }
    } catch {
      setResendMsg('Failed to resend. Try again later.');
    } finally {
      setResending(false);
    }
  }

  // ─── Sign out ─────────────────────────────────────────────────────────────
  async function handleSignOut() {
    try {
      await signOut(auth);
      reset();
    } catch {
      // Ignore — reset clears local state regardless
      reset();
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Logo ── */}
      <View style={styles.logoSection}>
        <Text style={styles.logo}>Drift</Text>
        <Text style={styles.tagline}>Connect. Meet. Drift with purpose.</Text>
      </View>

      {/* ── Card ── */}
      <View style={styles.card}>
        <Text style={styles.envelope}>✉️</Text>
        <Text style={styles.heading}>Check your inbox</Text>
        <Text style={styles.body}>
          We sent a verification link to:
        </Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.instructions}>
          Tap the link in the email to verify your account. This screen will update automatically once verified.
        </Text>

        {resendMsg ? <Text style={styles.resendMsg}>{resendMsg}</Text> : null}

        {/* Resend button */}
        <TouchableOpacity
          style={[
            styles.btn,
            (resendCooldown > 0 || resending) && styles.btnOff,
          ]}
          onPress={handleResend}
          disabled={resendCooldown > 0 || resending}
          activeOpacity={0.82}
        >
          {resending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend Verification Email'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Sign out link ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out and use a different account</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -2,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.card,
  },

  envelope: {
    fontSize: 52,
    marginBottom: spacing.md,
  },

  heading: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  email: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  instructions: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },

  resendMsg: {
    ...typography.small,
    color: colors.success,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  btnOff:  { opacity: 0.4 },
  btnText: { ...typography.body, fontWeight: '700', color: '#fff', fontSize: 16 },

  signOutBtn:  { alignSelf: 'center', marginTop: spacing.xl },
  signOutText: { ...typography.small, color: colors.textSecondary, textDecorationLine: 'underline' },
});
