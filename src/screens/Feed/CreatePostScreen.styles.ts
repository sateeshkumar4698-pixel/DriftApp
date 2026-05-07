import { StyleSheet } from 'react-native';
import { AppColors } from '../../utils/useTheme';
import { spacing, radius, typography } from '../../utils/theme';

export function makeCcStyles(C: AppColors) {
  return StyleSheet.create({
    text: { ...typography.small, fontWeight: '600', textAlign: 'right' },
  });
}

export function makeHsStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: { borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.background },
    row:  { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
    pill: {
      backgroundColor: C.primary + '12', borderRadius: radius.full,
      paddingHorizontal: spacing.sm, paddingVertical: 4,
      borderWidth: 1, borderColor: C.primary + '30',
    },
    text: { ...typography.small, color: C.primary, fontWeight: '700' },
  });
}

export function makePbStyles(C: AppColors) {
  return StyleSheet.create({
    container: { paddingHorizontal: 0, paddingBottom: spacing.md },
    sectionLabel: {
      ...typography.small, fontWeight: '800', color: C.textSecondary,
      letterSpacing: 1.1, marginTop: spacing.md, marginBottom: spacing.sm,
    },
    questionWrap: {
      borderWidth: 1.5, borderRadius: radius.md, backgroundColor: C.surface,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 80,
    },
    questionInput: { ...typography.body, color: C.text, lineHeight: 24, textAlignVertical: 'top' },
    optionRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderRadius: radius.md,
      marginBottom: spacing.sm, paddingRight: spacing.sm,
      backgroundColor: C.surface,
    },
    optionInput: { flex: 1, ...typography.body, color: C.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    removeBtn:  { padding: spacing.xs },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      justifyContent: 'center', marginBottom: spacing.md,
    },
    addBtnText:  { ...typography.body, fontWeight: '600' },
    durationRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    durationPill: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.surface,
    },
    durationText:       { ...typography.caption, color: C.textSecondary, fontWeight: '600' },
    durationTextActive: { color: '#fff', fontWeight: '700' },
  });
}

export function makeWvStyles(C: AppColors) {
  return StyleSheet.create({
    container: { paddingHorizontal: 0, paddingBottom: spacing.md },
    hint:      { ...typography.small, color: C.textSecondary, marginBottom: spacing.md },
    cardRow:   { flexDirection: 'row', marginBottom: spacing.sm },
    connector: { alignItems: 'center', marginRight: spacing.sm, paddingTop: 6, width: 12 },
    dot:       { width: 10, height: 10, borderRadius: 5 },
    vertLine:  { flex: 1, width: 2, marginTop: 4 },
    card: {
      flex: 1, borderWidth: 1.5, borderRadius: radius.md,
      backgroundColor: C.surface, paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    },
    input: {
      ...typography.body, color: C.text, lineHeight: 24,
      minHeight: 72, textAlignVertical: 'top',
    },
    cardFooter: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    charCount:  { ...typography.small, color: C.textSecondary },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      justifyContent: 'center', marginTop: spacing.xs,
    },
    addBtnText: { ...typography.body, fontWeight: '600' },
  });
}

export function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.md, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    closeBtn:      { padding: spacing.xs },
    headerTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
    postBtnWrap:   { borderRadius: radius.full, overflow: 'hidden' },
    postBtn:       { paddingHorizontal: 20, paddingVertical: 9, borderRadius: radius.full, alignItems: 'center', minWidth: 68 },
    postBtnText:   { fontSize: 14, fontWeight: '700', color: '#fff' },

    tabsWrap: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md, paddingVertical: 10,
      gap: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    tabOuter: { flex: 1 },
    tab: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, paddingVertical: 9, borderRadius: radius.md,
      overflow: 'hidden',
    },
    tabEmoji:       { fontSize: 14 },
    tabLabel:       { fontSize: 12, fontWeight: '600' },
    tabLabelActive: { fontSize: 12, fontWeight: '700', color: '#fff' },

    scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

    composeRow:  { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.md },
    composeRight: { flex: 1 },
    displayName:  { ...typography.caption, fontWeight: '700', color: C.text, marginBottom: spacing.xs },

    captionInput: {
      borderWidth: 1.5, borderRadius: radius.md, backgroundColor: C.surface,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 120,
      ...typography.body, color: C.text, lineHeight: 24, textAlignVertical: 'top',
    },
    charRow: { alignItems: 'flex-end', marginTop: spacing.xs },

    imagePicker: {
      height: 200, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed',
      backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, marginBottom: spacing.md,
    },
    imagePickerText: { ...typography.body, fontWeight: '600' },
    imagePreviewWrap: {
      height: 280, borderRadius: radius.lg, overflow: 'hidden',
      marginBottom: spacing.md, position: 'relative',
    },
    imagePreview: { width: '100%', height: '100%' },
    removeImageBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm },
    removeBadge: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center', justifyContent: 'center',
    },
    changeImageBtn: {
      position: 'absolute', bottom: spacing.sm, right: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: spacing.sm, paddingVertical: 4,
      borderRadius: radius.full,
    },
    changeImageText: { ...typography.small, color: '#fff', fontWeight: '600' },

    locationRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      borderWidth: 1, borderRadius: radius.md, backgroundColor: C.surface,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm,
    },
    locationInput: { flex: 1, ...typography.body, color: C.text },

    toolbar: {
      flexDirection: 'row', gap: spacing.md,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderTopWidth: 1, backgroundColor: C.background,
    },
    toolbarBtn: { padding: spacing.xs },
  });
}
