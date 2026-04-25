/**
 * profileShare.ts — utilities for Drift Profile Sharing feature.
 *
 * Covers: deep-link generation, @handle creation, share text,
 * card-theme selection based on VibeProfile.
 *
 * Install before use:
 *   npx expo install expo-linear-gradient expo-sensors expo-camera
 *   npx expo install expo-sharing expo-clipboard
 *   npx expo install react-native-qrcode-svg react-native-svg react-native-view-shot
 *   npm install react-native-nfc-manager   ← needs a dev build (not Expo Go)
 */

import { UserProfile } from '../types';

// ─── Deep link ────────────────────────────────────────────────────────────────

/** Universal link — works in browser (shows web preview) and in app via deep link */
export const DRIFT_DOMAIN = 'https://driftapp.in';

export function profileDeepLink(uid: string): string {
  return `${DRIFT_DOMAIN}/u/${uid}`;
}

/** Drift URI scheme — used as QR payload so the app opens directly */
export function profileDriftUri(uid: string): string {
  return `drift://profile/${uid}`;
}

// ─── Username / Drift ID ──────────────────────────────────────────────────────

/**
 * Auto-generate a unique @handle from name + uid suffix.
 * e.g.  "Priya Sharma", uid "abc7f3a1" → "priyasharma_f3a1"
 * Called once on profile creation; stored in Firestore + usernames map.
 */
export function generateUsername(name: string, uid: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')   // keep only alphanumeric
    .slice(0, 16);
  const suffix = uid.slice(-4);
  return `${base}_${suffix}`;
}

/**
 * Validate a user-chosen Drift ID.
 * Rules: 4-20 chars, alphanumeric + underscore + dot, no leading/trailing dot.
 */
export function validateDriftId(id: string): string | null {
  if (id.length < 4)  return 'Drift ID must be at least 4 characters';
  if (id.length > 20) return 'Drift ID must be 20 characters or less';
  if (!/^[a-z0-9_.]+$/.test(id)) return 'Only letters, numbers, _ and . are allowed';
  if (id.startsWith('.') || id.endsWith('.')) return 'Cannot start or end with a dot';
  return null; // valid
}

// ─── Share text ───────────────────────────────────────────────────────────────

export function profileShareText(profile: UserProfile): string {
  const top3  = (profile.interests ?? []).slice(0, 3).join(', ');
  const city  = profile.city ? ` · ${profile.city}` : '';
  const link  = profileDeepLink(profile.uid);
  const id    = profile.driftId ? `@${profile.driftId}` : '';
  return (
    `Hey! Connect with me on Drift 🌊\n\n` +
    `${profile.name}, ${profile.age}${city}${id ? `\n${id}` : ''}\n` +
    (top3 ? `Into: ${top3}\n` : '') +
    `\n${link}\n\nDrift — Connect. Meet. Drift with purpose.`
  );
}

// ─── Card themes ──────────────────────────────────────────────────────────────

export interface CardTheme {
  id: string;
  label: string;
  bgTop: string;
  bgBottom: string;
  text: string;
  subtext: string;
  accent: string;
  qrFg: string;     // QR code foreground colour
  qrBg: string;     // QR code background colour (always white for scannability)
  border: string;
}

export const CARD_THEMES: CardTheme[] = [
  {
    id: 'cosmic',
    label: '🌌 Cosmic',
    bgTop: '#0D0D1A',
    bgBottom: '#1A1A2E',
    text: '#FFFFFF',
    subtext: '#A0A0C0',
    accent: '#7C5CBF',
    qrFg: '#7C5CBF',
    qrBg: '#FFFFFF',
    border: '#7C5CBF50',
  },
  {
    id: 'neon',
    label: '⚡ Neon',
    bgTop: '#20003A',
    bgBottom: '#40006E',
    text: '#FFFFFF',
    subtext: '#D4A0FF',
    accent: '#FF2CDF',
    qrFg: '#9B00C8',
    qrBg: '#FFFFFF',
    border: '#FF2CDF50',
  },
  {
    id: 'minimal',
    label: '🤍 Minimal',
    bgTop: '#FFFFFF',
    bgBottom: '#F3F0FF',
    text: '#1A1A2E',
    subtext: '#6B6B8A',
    accent: '#7C5CBF',
    qrFg: '#7C5CBF',
    qrBg: '#FFFFFF',
    border: '#DDD8FF',
  },
  {
    id: 'vibe',
    label: '🌿 Forest',
    bgTop: '#081A08',
    bgBottom: '#10300F',
    text: '#E8FFE8',
    subtext: '#88C888',
    accent: '#2ECC71',
    qrFg: '#1A8A45',
    qrBg: '#FFFFFF',
    border: '#2ECC7150',
  },
];

/**
 * Auto-pick the best theme based on the user's VibeProfile scores.
 * Falls back to 'cosmic' if no vibe data exists yet.
 */
export function pickThemeForVibe(vibe?: UserProfile['vibeProfile']): CardTheme {
  if (!vibe) return CARD_THEMES[0]; // cosmic default
  if (vibe.energy    > 0.68) return CARD_THEMES[1]; // neon   — high energy
  if (vibe.aesthetic > 0.68) return CARD_THEMES[2]; // minimal — aesthetic-first
  if (vibe.adventure > 0.68) return CARD_THEMES[3]; // forest — outdoorsy
  return CARD_THEMES[0];                             // cosmic  — default/introvert
}

// ─── RTDB shake-share key ─────────────────────────────────────────────────────

/** Path in Firebase RTDB used by ShakeToShare screen */
export const RTDB_SHAKES_PATH = 'shakes';

/** How long (ms) a shake entry stays active for matching */
export const SHAKE_TTL_MS = 12_000;
