import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileStackParamList, DiscoverStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { postStatus } from '../../utils/firestore-helpers';
import { useTheme, AppColors, spacing, typography, radius } from '../../utils/useTheme';
import { DriftStatus, StatusType } from '../../types';

// StatusCreate lives in both Profile and Discover stacks
type StatusCreateRoute =
  | RouteProp<ProfileStackParamList, 'StatusCreate'>
  | RouteProp<DiscoverStackParamList, 'StatusCreate'>;

// ─── Status type configs ──────────────────────────────────────────────────────

interface StatusConfig {
  type: StatusType;
  emoji: string;
  label: string;
  description: string;
  placeholder: string;
  color: string;
  grad: readonly [string, string];
}

const STATUS_TYPES: StatusConfig[] = [
  {
    type: 'vibe_check',
    emoji: '✨',
    label: 'Vibe Check',
    description: "What's the energy right now?",
    placeholder: 'Main character vibes today…',
    color: '#6C5CE7',
    grad: ['#6C5CE7', '#A29BFE'],
  },
  {
    type: 'location_drop',
    emoji: '📍',
    label: 'Location Drop',
    description: 'Share where you are',
    placeholder: 'e.g. Third Wave, Koramangala',
    color: '#00B894',
    grad: ['#00B894', '#00CEC9'],
  },
  {
    type: 'looking_for',
    emoji: '👀',
    label: 'Looking For',
    description: 'What are you trying to do today?',
    placeholder: 'Looking for someone to jam with…',
    color: '#FF4B6E',
    grad: ['#FF4B6E', '#FF7A93'],
  },
  {
    type: 'game_invite',
    emoji: '🎮',
    label: 'Game Invite',
    description: 'Invite people to play',
    placeholder: 'Anyone up for Valorant tonight?',
    color: '#0984E3',
    grad: ['#0984E3', '#74B9FF'],
  },
  {
    type: 'photo_moment',
    emoji: '📸',
    label: 'Photo Moment',
    description: 'Share a moment (caption)',
    placeholder: 'Caught this incredible sunset…',
    color: '#E17055',
    grad: ['#E17055', '#FAB1A0'],
  },
  {
    type: 'memory_share',
    emoji: '🌟',
    label: 'Memory Share',
    description: 'Share a throwback or memory',
    placeholder: 'Remember when we…',
    color: '#FDCB6E',
    grad: ['#FDCB6E', '#F9CA24'],
  },
];

// ─── Type selector card ───────────────────────────────────────────────────────

function TypeCard({
  config,
  selected,
  onPress,
  C,
}: {
  config: StatusConfig;
  selected: boolean;
  onPress: () => void;
  C: AppColors;
}) {
  const styles = makeStyles(C);
  return (
    <TouchableOpacity
      style={[
        styles.typeCard,
        selected && { borderColor: config.color, backgroundColor: config.color + '12' },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.typeEmojiWrap, { backgroundColor: config.color + '18' }]}>
        <Text style={styles.typeEmoji}>{config.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.typeLabel, selected && { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={styles.typeDesc}>{config.description}</Text>
      </View>
      {selected ? (
        <View style={[styles.selectedDot, { backgroundColor: config.color }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatusCreateScreen() {
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<any>();
  const route      = useRoute<StatusCreateRoute>();
  const initialStatus = (route.params as any)?.initialStatus as DriftStatus | undefined;

  const findConfig = (type: StatusType) =>
    STATUS_TYPES.find((c) => c.type === type) ?? STATUS_TYPES[0];

  const { firebaseUser } = useAuthStore();
  const [selectedType, setSelectedType] = useState<StatusConfig>(
    initialStatus ? findConfig(initialStatus.type) : STATUS_TYPES[0],
  );
  const [text,     setText]     = useState(initialStatus?.text ?? '');
  const [venue,    setVenue]    = useState(initialStatus?.location?.venue ?? '');
  const [city,     setCity]     = useState(initialStatus?.location?.city ?? '');
  const [audience, setAudience] = useState<'connections' | 'everyone'>(
    initialStatus?.audience ?? 'connections',
  );
  const [saving, setSaving] = useState(false);

  function isLocationDrop() { return selectedType.type === 'location_drop'; }

  function canPost(): boolean {
    if (isLocationDrop()) return !!venue.trim();
    return text.trim().length >= 3;
  }

  async function handlePost() {
    if (!firebaseUser || !canPost()) return;
    setSaving(true);
    try {
      const now = Date.now();
      const status: DriftStatus = {
        uid:       firebaseUser.uid,
        type:      selectedType.type,
        text:      isLocationDrop() ? undefined : text.trim(),
        location:  isLocationDrop() ? { venue: venue.trim(), city: city.trim() } : undefined,
        audience,
        expiresAt: now + 24 * 60 * 60 * 1000,
        views:     [],
        reactions: {},
        createdAt: now,
      };
      await postStatus(firebaseUser.uid, status);
      setSaving(false);
      navigation.goBack();
    } catch (err: unknown) {
      setSaving(false);
      const msg  = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('permission') || msg.includes('PERMISSION')
        ? 'Permission denied — make sure you are signed in.'
        : msg;
      Alert.alert('Could not post status', __DEV__ ? hint : 'Try again in a moment.');
    }
  }

  const activeColor = selectedType.color;
  const charPct     = text.length / 200;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Drift Status</Text>
          <Text style={styles.headerSub}>Disappears in 24 hours</Text>
        </View>
        <TouchableOpacity
          onPress={handlePost}
          disabled={!canPost() || saving}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={canPost() ? selectedType.grad : [C.border, C.border]}
            style={styles.postBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.postBtnText, !canPost() && { color: C.textTertiary }]}>
              {saving ? '…' : 'Post'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Selected type preview banner ── */}
          <LinearGradient
            colors={[selectedType.color + '18', selectedType.color + '06']}
            style={styles.previewBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.previewEmoji}>{selectedType.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewLabel, { color: selectedType.color }]}>{selectedType.label}</Text>
              <Text style={styles.previewDesc}>{selectedType.description}</Text>
            </View>
          </LinearGradient>

          {/* ── Input area ── */}
          <View style={[styles.inputCard, { borderColor: activeColor + '60' }]}>
            {isLocationDrop() ? (
              <View style={{ gap: spacing.sm }}>
                <View style={styles.inputRow}>
                  <Ionicons name="location" size={18} color={activeColor} />
                  <TextInput
                    style={[styles.input, { color: C.text }]}
                    value={venue}
                    onChangeText={setVenue}
                    placeholder="Venue / place name *"
                    placeholderTextColor={C.textTertiary}
                    maxLength={60}
                  />
                </View>
                <View style={[styles.inputRow, { borderTopWidth: 1, borderTopColor: C.border, paddingTop: spacing.sm }]}>
                  <Ionicons name="business-outline" size={16} color={C.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: C.text }]}
                    value={city}
                    onChangeText={setCity}
                    placeholder="City (optional)"
                    placeholderTextColor={C.textTertiary}
                    maxLength={40}
                  />
                </View>
              </View>
            ) : (
              <TextInput
                style={[styles.textArea, { color: C.text }]}
                value={text}
                onChangeText={setText}
                placeholder={selectedType.placeholder}
                placeholderTextColor={C.textTertiary}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
            )}
          </View>

          {/* Char count */}
          {!isLocationDrop() && (
            <View style={styles.charRow}>
              <Text style={[
                styles.charCount,
                text.trim().length > 0 && text.trim().length < 3 && { color: C.error },
                text.trim().length >= 3 && { color: C.textSecondary },
              ]}>
                {text.trim().length < 3
                  ? `${text.trim().length}/3 minimum`
                  : `${text.length} / 200`}
              </Text>
              {/* Char progress ring hint */}
              <View style={styles.charTrack}>
                <View style={[styles.charFill, {
                  width: `${Math.min(100, charPct * 100)}%`,
                  backgroundColor: charPct > 0.9 ? C.error : activeColor,
                }]} />
              </View>
            </View>
          )}

          {/* ── Type selector ── */}
          <Text style={styles.sectionLabel}>Type of status</Text>
          <View style={styles.typeGrid}>
            {STATUS_TYPES.map((config) => (
              <TypeCard
                key={config.type}
                config={config}
                selected={selectedType.type === config.type}
                C={C}
                onPress={() => {
                  setSelectedType(config);
                  setText('');
                  setVenue('');
                  setCity('');
                }}
              />
            ))}
          </View>

          {/* ── Audience toggle ── */}
          <Text style={styles.sectionLabel}>Who can see this?</Text>
          <View style={styles.audienceRow}>
            {(['connections', 'everyone'] as const).map((aud) => {
              const active = audience === aud;
              return (
                <TouchableOpacity
                  key={aud}
                  style={[
                    styles.audienceBtn,
                    active && { backgroundColor: activeColor + '15', borderColor: activeColor },
                  ]}
                  onPress={() => setAudience(aud)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audienceEmoji}>{aud === 'connections' ? '🫂' : '🌍'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.audienceTitle, active && { color: activeColor }]}>
                      {aud === 'connections' ? 'Connections' : 'Everyone'}
                    </Text>
                    <Text style={styles.audienceSub}>
                      {aud === 'connections' ? 'Only your connections' : 'All Drift users'}
                    </Text>
                  </View>
                  {active && (
                    <View style={[styles.audienceCheck, { backgroundColor: activeColor }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Expiry note ── */}
          <View style={styles.expiryNote}>
            <Ionicons name="time-outline" size={14} color={C.textTertiary} />
            <Text style={styles.expiryText}>Disappears automatically after 24 hours</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    cancelBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle:{ ...typography.body, fontWeight: '700', color: C.text },
    headerSub:  { ...typography.small, color: C.textSecondary, marginTop: 1 },
    postBtn: {
      paddingHorizontal: spacing.md + 4,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      minWidth: 64,
      alignItems: 'center',
    },
    postBtnText: { ...typography.caption, color: '#fff', fontWeight: '700' },

    container: { padding: spacing.lg, paddingBottom: 100 },

    // Preview banner
    previewBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md,
    },
    previewEmoji: { fontSize: 28 },
    previewLabel: { ...typography.body, fontWeight: '700' },
    previewDesc:  { ...typography.small, color: C.textSecondary, marginTop: 2 },

    // Input
    inputCard: {
      backgroundColor: C.inputBg, borderRadius: radius.md,
      borderWidth: 1.5, padding: spacing.md,
      marginBottom: spacing.xs,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      flex: 1, ...typography.body, paddingVertical: 2,
    },
    textArea: {
      ...typography.body, minHeight: 96, paddingVertical: 0,
    },

    // Char count
    charRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    charCount: { ...typography.small },
    charTrack: { flex: 1, height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
    charFill:  { height: 3, borderRadius: 2 },

    // Section label
    sectionLabel: {
      ...typography.label, color: C.textSecondary,
      marginBottom: spacing.sm, marginTop: spacing.md,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },

    // Type grid
    typeGrid:   { gap: spacing.sm, marginBottom: spacing.md },
    typeCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.surface,
    },
    typeEmojiWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    typeEmoji:    { fontSize: 20 },
    typeLabel:    { ...typography.body, fontWeight: '600', color: C.text },
    typeDesc:     { ...typography.small, color: C.textSecondary, marginTop: 1 },
    selectedDot:  { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

    // Audience
    audienceRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    audienceBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.surface,
    },
    audienceEmoji:{ fontSize: 22 },
    audienceTitle:{ ...typography.caption, fontWeight: '700', color: C.text },
    audienceSub:  { ...typography.small, color: C.textSecondary, marginTop: 1 },
    audienceCheck:{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

    // Expiry
    expiryNote: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      justifyContent: 'center', marginTop: spacing.md,
    },
    expiryText: { ...typography.small, color: C.textTertiary },
  });
}
