import { StyleSheet } from 'react-native';
import { AppColors } from '../../utils/useTheme';
import { spacing, radius, typography, shadows } from '../../utils/theme';

// ─── Main screen styles ───────────────────────────────────────────────────────

export function makeStyles(C: AppColors, isDark: boolean) {
  return StyleSheet.create({
    flex:          { flex: 1, backgroundColor: isDark ? '#0D0D1A' : C.surface },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : C.border,
    },
    wordmark:      { fontSize: 26, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
    wordmarkSub:   { fontSize: 11, color: C.textSecondary, marginTop: 2, fontWeight: '500' },
    newPostBtn:    { borderRadius: radius.full, overflow: 'hidden', ...shadows.sm },
    newPostGrad:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9 },
    newPostText:   { fontSize: 13, fontWeight: '700', color: '#fff' },
    list:          { paddingTop: spacing.sm, paddingBottom: 120 },
    emptyContainer: { flex: 1 },

    // Segmented tabs
    tabsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: isDark ? '#0D0D1A' : C.background,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : C.border,
    },
    tabPill: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    tabPillActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    tabPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSecondary,
      letterSpacing: -0.1,
    },
    tabPillTextActive: {
      color: '#fff',
      fontWeight: '700',
    },

    // Compose card
    composeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      marginBottom: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      backgroundColor: isDark ? '#15152A' : '#FFFFFF',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      ...shadows.xs,
    },
    composeInput: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      backgroundColor: isDark ? '#1C1C35' : C.surface,
      fontSize: 14,
      color: C.textSecondary,
      fontWeight: '500',
    },
    composeIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    composeIconBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
    },

    fab: {
      position: 'absolute', bottom: 90, right: 20,
      width: 58, height: 58, borderRadius: 29,
      overflow: 'hidden',
      elevation: 10,
      shadowColor: '#FF4B6E',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.55,
      shadowRadius: 14,
    },
    fabGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
}

// ─── Post card styles ─────────────────────────────────────────────────────────

export function makeCardStyles(C: AppColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: isDark ? '#15152A' : '#FFFFFF',
      marginHorizontal: spacing.md,
      marginBottom: 12,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      overflow: 'hidden',
      ...shadows.card,
    },
    stripe: { height: 3 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingTop: spacing.md,
      paddingBottom: spacing.xs, gap: spacing.sm,
    },
    meta:     { flex: 1 },
    username: { fontSize: 14.5, fontWeight: '700', color: C.text, letterSpacing: -0.1 },
    time:     { fontSize: 11, color: C.textSecondary, marginTop: 2 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 9, paddingVertical: 3,
      borderRadius: radius.full, borderWidth: 1,
    },
    badgeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
    caption: {
      fontSize: 15, color: C.text, lineHeight: 23,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs, paddingBottom: spacing.sm,
    },
    pollQuestion: {
      fontSize: 16, fontWeight: '700', color: C.text, lineHeight: 23,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs, paddingBottom: spacing.sm,
    },
    imageWrap:    { overflow: 'hidden', position: 'relative', marginBottom: spacing.xs },
    image:        { width: '100%', height: '100%' },
    heartOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    heartEmoji:   { fontSize: 84 },
    tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    tag:          { backgroundColor: C.secondary + '14', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
    tagText:      { fontSize: 11, fontWeight: '700' },
    engRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 7 },
    engText:      { fontSize: 12, color: C.text, fontWeight: '600' },
    actions:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.border, gap: spacing.lg },
    actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionCount:  { fontSize: 12.5, color: C.textSecondary, fontWeight: '600' },
  });
}

// ─── Comments modal styles ────────────────────────────────────────────────────

export function makeCmStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:        { backgroundColor: C.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%', paddingBottom: 28 },
    handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: spacing.sm },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: C.border },
    title:        { fontSize: 15, fontWeight: '700', color: C.text },
    empty:        { ...typography.body, color: C.textSecondary, textAlign: 'center', padding: spacing.xl },
    list:         { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: 380 },
    row:          { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
    replyRow:     { flexDirection: 'row', gap: spacing.xs, marginLeft: 44, marginBottom: spacing.sm, alignItems: 'flex-start' },
    replyLine:    { width: 2, backgroundColor: C.border, alignSelf: 'stretch', marginRight: 4, borderRadius: 1 },
    bubble:       { flex: 1, backgroundColor: C.surface, borderRadius: radius.md, padding: spacing.sm },
    bubbleTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bubbleName:   { ...typography.small, fontWeight: '700', color: C.text },
    bubbleText:   { ...typography.body, color: C.text, marginTop: 2, lineHeight: 22 },
    bubbleTime:   { ...typography.small, color: C.textSecondary },
    replyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.xs },
    replyBtnText: { ...typography.small, color: C.primary, fontWeight: '600' },
    replyTag:     { ...typography.small, color: C.primary, fontWeight: '600', marginBottom: 2 },
    replyBanner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: `${C.primary}10`, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: `${C.primary}20` },
    replyBannerText: { ...typography.small, color: C.textSecondary },
    inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: C.border },
    input:        { flex: 1, ...typography.body, color: C.text, backgroundColor: C.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: C.border, maxHeight: 100 },
    sendBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  });
}

// ─── Share modal styles ───────────────────────────────────────────────────────

export function makeShStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet:    { backgroundColor: C.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%', paddingBottom: 32 },
    handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: spacing.sm },
    header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: C.border },
    title:    { fontSize: 15, fontWeight: '700', color: C.text },
    empty:    { ...typography.body, color: C.textSecondary, textAlign: 'center', padding: spacing.xl },
    list:     { padding: spacing.md },
    row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    rowInfo:  { flex: 1 },
    rowName:  { ...typography.body, fontWeight: '600', color: C.text },
    rowMeta:  { ...typography.small, color: C.textSecondary },
    sendBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  });
}

// ─── Poll styles ──────────────────────────────────────────────────────────────

export function makePollStyles() {
  return StyleSheet.create({
    container: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 8 },
    option: {
      borderRadius: radius.md, borderWidth: 1.5, borderColor: '#e0e0e0',
      paddingHorizontal: spacing.md, paddingVertical: 13,
      overflow: 'hidden', position: 'relative', minHeight: 48,
      justifyContent: 'center', backgroundColor: 'transparent',
    },
    bar: {
      position: 'absolute', left: 0, top: 0, bottom: 0,
      opacity: 0.15,
    },
    optionText: { fontSize: 14, fontWeight: '500', color: '#333', zIndex: 1 },
    pct: { position: 'absolute', right: spacing.md, fontSize: 12, fontWeight: '700' },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    meta: { fontSize: 11, fontWeight: '500' },
  });
}
