export const colors = {
  primary: '#FF4B6E',
  secondary: '#6C5CE7',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1A1A2E',
  textSecondary: '#6C757D',
  border: '#E9ECEF',
  success: '#00B894',
  error: '#FF6B6B',
  warning: '#FDCB6E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const },
  heading: { fontSize: 22, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
