/**
 * useTheme()
 * Returns the current color palette (dark or light) based on the user's
 * preference stored in themeStore. Import this wherever you need colors
 * instead of importing `colors` directly from theme.ts.
 *
 * Usage:
 *   const { C, isDark } = useTheme();
 *   <View style={{ backgroundColor: C.background }} />
 */

import { useThemeStore } from '../store/themeStore';

// ─── Light palette ────────────────────────────────────────────────────────────
export const lightColors = {
  background:     '#FFFFFF',
  surface:        '#F8F9FA',
  surfaceElevated:'#FFFFFF',
  card:           '#FFFFFF',
  cardAlt:        '#F3F4F6',

  text:           '#0F0F23',
  textSecondary:  '#6B7280',
  textTertiary:   '#9CA3AF',
  textInverse:    '#FFFFFF',

  border:         '#E5E7EB',
  borderLight:    '#F3F4F6',
  divider:        '#F3F4F6',

  primary:        '#FF4B6E',
  primaryLight:   '#FF7A93',
  primaryDark:    '#D93056',
  secondary:      '#6C5CE7',
  secondaryLight: '#A29BFE',

  success:        '#10B981',
  successLight:   '#D1FAE5',
  error:          '#EF4444',
  errorLight:     '#FEE2E2',
  warning:        '#F59E0B',
  warningLight:   '#FEF3C7',

  like:           '#EF4444',
  gold:           '#F59E0B',
  online:         '#10B981',

  // header / nav
  headerBg:       '#FFFFFF',
  inputBg:        '#F3F4F6',
  inputBorder:    '#E5E7EB',
  inputFocus:     '#6C5CE7',
  switchTrack:    '#E5E7EB',
};

// ─── Dark palette ─────────────────────────────────────────────────────────────
export const darkColors = {
  background:     '#0D0D1A',
  surface:        '#15152A',
  surfaceElevated:'#1C1C35',
  card:           '#15152A',
  cardAlt:        '#1C1C35',

  text:           '#FFFFFF',
  textSecondary:  '#8888BB',
  textTertiary:   '#555580',
  textInverse:    '#0D0D1A',

  border:         '#2A2A4A',
  borderLight:    '#222240',
  divider:        '#2A2A4A',

  primary:        '#FF4B6E',
  primaryLight:   '#FF7A93',
  primaryDark:    '#D93056',
  secondary:      '#6C5CE7',
  secondaryLight: '#A29BFE',

  success:        '#00E676',
  successLight:   '#00E67622',
  error:          '#EF4444',
  errorLight:     '#EF444422',
  warning:        '#FFD700',
  warningLight:   '#FFD70022',

  like:           '#EF4444',
  gold:           '#FFD700',
  online:         '#00E676',

  // header / nav
  headerBg:       '#0A0A1F',
  inputBg:        '#1C1C35',
  inputBorder:    '#2A2A4A',
  inputFocus:     '#6C5CE7',
  switchTrack:    '#2A2A4A',
};

export type AppColors = typeof lightColors;

export function useTheme(): { C: AppColors; isDark: boolean } {
  const isDark = useThemeStore((s) => s.isDark);
  return { C: isDark ? darkColors : lightColors, isDark };
}
