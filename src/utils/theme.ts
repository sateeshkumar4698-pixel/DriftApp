// ─── Drift Design System v2 ───────────────────────────────────────────────────

export const colors = {
  // Brand
  primary:        '#FF4B6E',
  primaryLight:   '#FF7A93',
  primaryDark:    '#D93056',
  secondary:      '#6C5CE7',
  secondaryLight: '#A29BFE',

  // Surface
  background:     '#FFFFFF',
  surface:        '#F8F9FA',
  surfaceElevated:'#FFFFFF',
  card:           '#FFFFFF',

  // Text
  text:           '#0F0F23',
  textSecondary:  '#6B7280',
  textTertiary:   '#9CA3AF',
  textInverse:    '#FFFFFF',

  // Borders
  border:         '#E5E7EB',
  borderLight:    '#F3F4F6',
  divider:        '#F3F4F6',

  // Semantic
  success:        '#10B981',
  successLight:   '#D1FAE5',
  error:          '#EF4444',
  errorLight:     '#FEE2E2',
  warning:        '#F59E0B',
  warningLight:   '#FEF3C7',

  // Special
  like:           '#EF4444',
  gold:           '#F59E0B',
  online:         '#10B981',
} as const;

export const spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const typography = {
  // Legacy aliases kept for compatibility with existing screens
  title:    { fontSize: 28, fontWeight: '700' as const },
  heading:  { fontSize: 22, fontWeight: '600' as const },
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400' as const },
  small:    { fontSize: 11, fontWeight: '400' as const },
  // New additions
  display:  { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
  h1:       { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2:       { fontSize: 22, fontWeight: '700' as const },
  h3:       { fontSize: 18, fontWeight: '600' as const },
  bodyLg:   { fontSize: 17, fontWeight: '400' as const, lineHeight: 26 },
  label:    { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4 },
  tab:      { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.3 },
} as const;

export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   20,
  xl:   28,
  full: 999,
} as const;

export const shadows = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

// ─── Gradient color pairs (for expo-linear-gradient) ─────────────────────────
export const gradients = {
  primary:  ['#FF4B6E', '#FF7A93'] as const,
  secondary:['#6C5CE7', '#A29BFE'] as const,
  sunset:   ['#FF4B6E', '#F59E0B'] as const,
  ocean:    ['#3B82F6', '#6C5CE7'] as const,
  dark:     ['#0F0F23', '#1A1A3E'] as const,
} as const;
