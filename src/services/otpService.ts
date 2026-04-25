/**
 * Custom OTP service — routes through the Node.js backend (Twilio Verify)
 * instead of Firebase phone auth. Avoids the reCAPTCHA requirement that
 * breaks in React Native / Expo Go.
 *
 * Enable by setting EXPO_PUBLIC_BACKEND_URL in your env (e.g. via .env + app.json
 * extra or an `.env` file loaded by `expo-constants`).
 *
 * Flow:
 *   1. sendBackendOtp(phone)      → backend /auth/otp/send (Twilio SMS)
 *   2. verifyBackendOtp(phone,c)  → backend /auth/otp/verify → customToken
 *   3. signInWithCustomToken(auth, token)  → Firebase session
 */

import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../config/firebase';

const BACKEND_URL =
  (process.env.EXPO_PUBLIC_BACKEND_URL as string | undefined) ?? '';

export function isBackendOtpEnabled(): boolean {
  return BACKEND_URL.length > 0;
}

export async function sendBackendOtp(phoneNumber: string): Promise<void> {
  if (!BACKEND_URL) throw new Error('EXPO_PUBLIC_BACKEND_URL is not set');
  const res = await fetch(`${BACKEND_URL}/auth/otp/send`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ phoneNumber }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `OTP send failed (${res.status})`);
  }
}

export async function verifyBackendOtp(
  phoneNumber: string,
  code: string,
): Promise<void> {
  if (!BACKEND_URL) throw new Error('EXPO_PUBLIC_BACKEND_URL is not set');
  const res = await fetch(`${BACKEND_URL}/auth/otp/verify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ phoneNumber, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `OTP verify failed (${res.status})`);
  }
  const { customToken } = (await res.json()) as { customToken: string };
  if (!customToken) throw new Error('No custom token returned by server');
  await signInWithCustomToken(auth, customToken);
  // onAuthStateChanged in App.tsx takes over from here
}
