import { StyleSheet } from 'react-native';
import { AppColors, spacing, radius, typography, shadows } from '../../utils/useTheme';

// ─── Status Viewer Modal styles ───────────────────────────────────────────────

export function makeSvStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet:         { backgroundColor: C.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden', paddingBottom: 40 },
    colorBar:      { height: 4 },
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    typePill:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
    typePillEmoji: { fontSize: 16 },
    typePillLabel: { ...typography.caption, fontWeight: '700' },
    closeBtn:      { padding: spacing.sm },
    closeBtnText:  { fontSize: 16, color: C.textSecondary, fontWeight: '600' },
    editBtn:       { borderWidth: 1, borderColor: C.border, borderRadius: radius.full, paddingHorizontal: 10 },
    posterName:    { ...typography.body, fontWeight: '700', color: C.text, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    contentBox:    { marginHorizontal: spacing.md, padding: spacing.md, backgroundColor: C.surface, borderRadius: radius.md, marginBottom: spacing.md, minHeight: 80, justifyContent: 'center' },
    contentText:   { fontSize: 20, fontWeight: '600', color: C.text, lineHeight: 30 },
    locationVenue: { fontSize: 20, fontWeight: '700', color: C.text },
    locationCity:  { ...typography.body, color: C.textSecondary, marginTop: 4 },
    footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
    expiryText:    { ...typography.small, color: C.textSecondary },
    audiencePill:  { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
    audienceText:  { ...typography.small, fontWeight: '700' },
  });
}

// ─── MoodStrip static styles ──────────────────────────────────────────────────

export function makeMs() {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 54,
      borderBottomWidth: 1,
      overflow: 'hidden',
      paddingHorizontal: 4,
    },
    arrow:   { width: 34, alignItems: 'center', justifyContent: 'center' },
    arrowTxt:{ fontSize: 26, lineHeight: 30, fontWeight: '300' },
    center:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
    colourDot: { width: 8, height: 8, borderRadius: 4 },
    emoji:   { fontSize: 22 },
    textBlock: { flex: 1, minWidth: 0 },
    moodName:  { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },
    moodDesc:  { fontSize: 10.5, marginTop: 1 },
    dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    dot:     { height: 5, borderRadius: 3 },
  });
}

// ─── ProfileCard static styles ────────────────────────────────────────────────

export function makeCs() {
  return StyleSheet.create({
    glowWrap: {
      borderRadius: radius.lg,
      borderWidth: 1,
      overflow: 'hidden',
      shadowColor: '#FF4B6E',
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 12,
      paddingVertical: 14,
      paddingLeft: 0,
      gap: 11,
    },
    stripe: {
      width: 4,
      alignSelf: 'stretch',
    },

    avatarWrap:  { position: 'relative', marginLeft: 8, flexShrink: 0 },
    avatarRing:  { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
    avatarInner: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
    activeDot:   { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#00E676', borderWidth: 2, borderColor: 'rgba(0,0,0,0.5)' },

    info:     { flex: 1, minWidth: 0, gap: 4 },
    row1:     { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap' },
    chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 3 },

    name:     { fontSize: 15, fontWeight: '800', flexShrink: 1, flexGrow: 0, letterSpacing: -0.2 },
    age:      { fontSize: 13, fontWeight: '500', flexShrink: 0 },
    cityText: { fontSize: 11.5, fontWeight: '500' },

    livePill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#00E67222', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1.5 },
    liveDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#00E676' },
    liveText: { fontSize: 9, fontWeight: '800', color: '#00E676', letterSpacing: 0.3 },

    chip:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, maxWidth: 90 },
    chipTxt: { fontSize: 10, fontWeight: '700' },

    right:          { width: 58, alignItems: 'center', gap: 6, flexShrink: 0 },
    scorePill:      { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 11, minWidth: 44, alignItems: 'center' },
    scoreText:      { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.2 },
    connectBtnWrap: {},
    connectBtn: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: '#FF4B6E',
      shadowOpacity: 0.55,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    connectLabel: { fontSize: 9, fontWeight: '700', color: '#FF4B6E', letterSpacing: 0.3 },
    vibeHint: { fontSize: 11, color: '#6C5CE7', fontWeight: '600', marginTop: 2 },
    shine: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: '50%',
      borderRadius: 19,
    },
  });
}

// ─── Main Screen styles ───────────────────────────────────────────────────────

export function makeMainStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.background },
    flex:    { flex: 1 },
    feedList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 100 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: '#ffffff10',
    },
    headerTitle:   { ...typography.h2, color: C.primary, fontWeight: '800', letterSpacing: -1, fontSize: 26 },
    headerSub:     { ...typography.small, color: C.textSecondary, marginTop: 2, fontWeight: '500' },
    headerSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    bellBtn: { position: 'relative', width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    bellBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: C.background },
    bellBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },

    searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: C.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
    searchInput: { flex: 1, ...typography.body, color: C.text, padding: 0 },

    retryBtn: { marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, backgroundColor: C.primary, borderRadius: radius.full, alignSelf: 'center', ...shadows.sm },
    retryText: { ...typography.body, color: '#fff', fontWeight: '700' },
  });
}
