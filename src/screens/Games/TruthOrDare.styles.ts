import { StyleSheet } from 'react-native';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { AppColors } from '../../utils/useTheme';

// ─── UI Constants ─────────────────────────────────────────────────────────────

export const PLAYER_COLORS: readonly string[] = [
  '#FF4B6E', '#6C5CE7', '#00B894', '#FDCB6E',
  '#0984E3', '#E17055', '#A855F7', '#00CEC9',
  '#FF7675', '#74B9FF', '#55EFC4', '#FD79A8',
];

export const MAX_SKIPS = 3;
export const MAX_PLAYERS = 20;
export const MIN_PLAYERS = 2;

// ─── Bottle Spinner Dimensions ────────────────────────────────────────────────

export const SPINNER_SIZE = 280;
export const SPINNER_CENTER = 140;
export const RING_RADIUS = 98;
export const BUBBLE_R = 18;
export const NEEDLE_W = 170;
export const NEEDLE_H = 10;

// ─── Styles ───────────────────────────────────────────────────────────────────

export function makeStyles(C: AppColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.background,
  },
  flex: {
    flex: 1,
  },

  // ── Room Banner ────────────────────────────────────────────────────────────
  roomBanner: {
    backgroundColor: C.secondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  roomBannerText: {
    color: '#fff',
    ...typography.small,
    fontWeight: '700',
  },

  // ── Spice stripe ───────────────────────────────────────────────────────────
  spiceStripe: {
    height: 3,
    width: '100%',
  },

  // ── Setup ──────────────────────────────────────────────────────────────────
  setupScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  backBtn: {
    padding: spacing.sm,
    marginTop: 2,
  },
  backBtnText: {
    fontSize: 22,
    color: C.text,
    fontWeight: '600',
  },
  setupTitleBlock: {
    flex: 1,
  },
  setupTitle: {
    ...typography.title,
    color: C.text,
  },
  setupSubtitle: {
    ...typography.body,
    color: C.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  playerDot: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
  },
  playerInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: C.text,
    backgroundColor: C.surface,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '700',
  },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    marginTop: spacing.xs,
  },
  addPlayerText: {
    ...typography.body,
    color: C.primary,
    fontWeight: '600',
  },
  spiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  spicePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    gap: 4,
  },
  spicePillWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  spicePillAgeGate: {
    borderStyle: 'dashed',
  },
  spicePillWideInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  ageBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: C.border,
  },
  ageBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  ageBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.textSecondary,
    letterSpacing: 0.5,
  },
  ageBadgeTextSelected: {
    color: '#fff',
  },
  spicePillEmoji: {
    fontSize: 20,
  },
  spicePillLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: C.text,
  },
  spicePillLabelSelected: {
    color: C.background,
  },
  spicePillDesc: {
    fontSize: 10,
    fontWeight: '400',
    color: C.textSecondary,
    textAlign: 'center',
  },
  spicePillDescSelected: {
    color: C.background + 'CC',
  },
  startBtn: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    marginTop: spacing.sm,
  },
  startBtnDisabled: {
    backgroundColor: C.border,
  },
  startBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: C.background,
    fontSize: 18,
  },

  // ── Playing ────────────────────────────────────────────────────────────────
  playingContainer: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  playingTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  roundLabel: {
    ...typography.heading,
    color: C.text,
    fontWeight: '700',
  },
  skipCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  skipDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  skipDotActive: {
    backgroundColor: C.success,
  },
  skipDotUsed: {
    backgroundColor: C.border,
  },
  skipCounterText: {
    ...typography.small,
    color: C.textSecondary,
    marginLeft: 2,
  },
  spiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  spiceBadgeEmoji: { fontSize: 14 },
  spiceBadgeLabel: {
    ...typography.small,
    fontWeight: '700',
  },
  endBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  endBtnText: {
    ...typography.caption,
    color: C.text,
    fontWeight: '600',
  },
  playerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
  },
  playerBannerDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
  },
  playerBannerInfo: {
    flex: 1,
  },
  playerBannerName: {
    ...typography.heading,
    fontWeight: '700',
  },
  playerBannerSub: {
    ...typography.small,
    color: C.textSecondary,
    fontWeight: '500',
  },
  playerBannerStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playerBannerStatText: {
    ...typography.caption,
    color: C.textSecondary,
    fontWeight: '600',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 120,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  actionBtnEmoji: {
    fontSize: 44,
  },
  actionBtnLabel: {
    ...typography.heading,
    color: C.background,
    fontWeight: '800',
    fontSize: 20,
  },
  actionBtnSub: {
    ...typography.small,
    color: C.background + 'BB',
    fontWeight: '500',
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...shadows.modal,
  },
  cardAccentBar: {
    height: 4,
    width: '100%',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  cardHeaderEmoji: {
    fontSize: 20,
  },
  cardHeaderType: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  spiceIndicator: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 4,
  },
  spiceDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  cardBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  cardText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  cardActions: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardActionBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    ...typography.body,
    color: C.background,
    fontWeight: '700',
  },
  skipBtn: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  skipBtnDisabled: {
    opacity: 0.45,
  },
  skipText: {
    ...typography.body,
    color: C.textSecondary,
    fontWeight: '600',
  },
  skipTextDisabled: {
    color: C.border,
  },
  // ── Bottle Spinner ─────────────────────────────────────────────────────────
  spinnerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
  },
  spinnerContainer: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    position: 'relative',
  },
  spinnerBubble: {
    position: 'absolute',
    width: BUBBLE_R * 2,
    height: BUBBLE_R * 2,
    borderRadius: BUBBLE_R,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  spinnerBubbleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  bottleWrapper: {
    position: 'absolute',
    width: NEEDLE_W,
    height: NEEDLE_H,
    top: SPINNER_CENTER - NEEDLE_H / 2,
    left: SPINNER_CENTER - NEEDLE_W / 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottleTail: {
    width: NEEDLE_W * 0.38,
    height: NEEDLE_H * 0.6,
    backgroundColor: '#AAAAAA',
    borderRadius: NEEDLE_H,
  },
  bottleHead: {
    flex: 1,
    height: NEEDLE_H,
    borderRadius: NEEDLE_H,
  },
  bottleArrowhead: {
    width: 0,
    height: 0,
    borderTopWidth: NEEDLE_H + 4,
    borderTopColor: 'transparent',
    borderBottomWidth: NEEDLE_H + 4,
    borderBottomColor: 'transparent',
    borderLeftWidth: 18,
    marginLeft: -2,
  },
  spinnerPivot: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 3,
    top: SPINNER_CENTER - 11,
    left: SPINNER_CENTER - 11,
    zIndex: 10,
    ...shadows.card,
  },
  spinnerStatus: {
    ...typography.heading,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  spinnerWinnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    width: '100%',
    marginTop: spacing.md,
    ...shadows.card,
  },
  spinnerWinnerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerWinnerAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
  },
  spinnerWinnerInfo: {
    flex: 1,
  },
  spinnerWinnerName: {
    fontSize: 22,
    fontWeight: '800',
  },
  spinnerWinnerSub: {
    ...typography.body,
    color: C.textSecondary,
    marginTop: 2,
  },

  miniScoreboard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  miniPlayerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 4,
    maxWidth: '47%',
  },
  miniPlayerDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  miniPlayerName: {
    ...typography.small,
    color: C.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  miniPlayerActive: {
    fontSize: 8,
    marginLeft: 2,
  },

  // ── Game Over ──────────────────────────────────────────────────────────────
  gameoverScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  gameoverTitle: {
    ...typography.title,
    fontSize: 32,
    color: C.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  gameoverSubtitle: {
    ...typography.body,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  gameoverSpiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    marginBottom: spacing.xl,
  },
  gameoverSpiceEmoji: { fontSize: 18 },
  gameoverSpiceLabel: {
    ...typography.body,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 3,
    ...shadows.card,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.small,
    color: C.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  leaderboardCard: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
    width: '100%',
  },
  leaderboardTitle: {
    ...typography.heading,
    color: C.text,
    marginBottom: spacing.md,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: spacing.sm,
  },
  leaderRowFirst: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  leaderRank: {
    fontSize: 18,
    width: 28,
  },
  leaderNameDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  leaderName: {
    ...typography.body,
    color: C.text,
    fontWeight: '600',
    flex: 1,
  },
  leaderStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  leaderStatItem: {
    ...typography.small,
    fontWeight: '600',
    color: C.text,
  },
  leaderTotal: {
    fontSize: 18,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'right',
  },
  highlightsCard: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.card,
    width: '100%',
  },
  highlightsTitle: {
    ...typography.heading,
    color: C.text,
    marginBottom: spacing.md,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  highlightLabel: {
    ...typography.body,
    color: C.textSecondary,
  },
  highlightValue: {
    ...typography.body,
    fontWeight: '700',
    color: C.text,
  },
  playAgainBtn: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    marginBottom: spacing.md,
    width: '100%',
  },
  playAgainText: {
    ...typography.body,
    fontWeight: '700',
    color: C.background,
    fontSize: 18,
  },
  backToGamesBtn: {
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  backToGamesText: {
    ...typography.body,
    color: C.textSecondary,
    fontWeight: '600',
  },
  });
}
