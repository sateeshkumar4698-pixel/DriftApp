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
import { ProfileStackParamList, DiscoverStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { postStatus } from '../../utils/firestore-helpers';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { DriftStatus, StatusType } from '../../types';

// StatusCreate lives in both Profile and Discover stacks — use the wider union type
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
  bgColor: string;
}

const STATUS_TYPES: StatusConfig[] = [
  {
    type: 'vibe_check',
    emoji: '✨',
    label: 'Vibe Check',
    description: "What's the energy right now?",
    placeholder: 'Main character vibes today...',
    color: '#6C5CE7',
    bgColor: '#6C5CE715',
  },
  {
    type: 'location_drop',
    emoji: '📍',
    label: 'Location Drop',
    description: 'Share where you are',
    placeholder: 'e.g. Third Wave, Koramangala',
    color: '#00B894',
    bgColor: '#00B89415',
  },
  {
    type: 'looking_for',
    emoji: '👀',
    label: 'Looking For',
    description: 'What are you trying to do today?',
    placeholder: 'Looking for someone to jam with...',
    color: '#FF4B6E',
    bgColor: '#FF4B6E15',
  },
  {
    type: 'game_invite',
    emoji: '🎮',
    label: 'Game Invite',
    description: 'Invite people to play',
    placeholder: 'Anyone up for Valorant tonight?',
    color: '#0984E3',
    bgColor: '#0984E315',
  },
  {
    type: 'photo_moment',
    emoji: '📸',
    label: 'Photo Moment',
    description: 'Share a moment (caption)',
    placeholder: 'Caught this incredible sunset...',
    color: '#E17055',
    bgColor: '#E1705515',
  },
  {
    type: 'memory_share',
    emoji: '🌟',
    label: 'Memory Share',
    description: 'Share a throwback or memory',
    placeholder: 'Remember when we...',
    color: '#FDCB6E',
    bgColor: '#FDCB6E20',
  },
];

// ─── Type selector card ───────────────────────────────────────────────────────

function TypeCard({
  config,
  selected,
  onPress,
}: {
  config: StatusConfig;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.typeCard,
        { backgroundColor: selected ? config.bgColor : colors.surface },
        selected && { borderColor: config.color },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.typeEmoji}>{config.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.typeLabel, selected && { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={styles.typeDesc}>{config.description}</Text>
      </View>
      {selected && (
        <View style={[styles.selectedDot, { backgroundColor: config.color }]} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatusCreateScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<StatusCreateRoute>();
  const initialStatus = (route.params as any)?.initialStatus as DriftStatus | undefined;

  // Pre-fill form if editing an existing status
  const findConfig = (type: StatusType) =>
    STATUS_TYPES.find((c) => c.type === type) ?? STATUS_TYPES[0];

  const { firebaseUser } = useAuthStore();
  const [selectedType, setSelectedType] = useState<StatusConfig>(
    initialStatus ? findConfig(initialStatus.type) : STATUS_TYPES[0],
  );
  const [text, setText] = useState(initialStatus?.text ?? '');
  const [venue, setVenue] = useState(initialStatus?.location?.venue ?? '');
  const [city, setCity] = useState(initialStatus?.location?.city ?? '');
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
        uid: firebaseUser.uid,
        type: selectedType.type,
        text: isLocationDrop() ? undefined : text.trim(),
        location: isLocationDrop() ? { venue: venue.trim(), city: city.trim() } : undefined,
        audience,
        expiresAt: now + 24 * 60 * 60 * 1000,
        views: [],
        reactions: {},
        createdAt: now,
      };
      await postStatus(firebaseUser.uid, status);
      setSaving(false);
      // goBack() returns to whichever screen opened StatusCreate —
      // DiscoverFeed (when tapping "Add Status" in the stories bar) or
      // ProfileMain (when tapping "Post Status" in the quick actions).
      navigation.goBack();
    } catch (err: unknown) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('permission') || msg.includes('PERMISSION')
        ? 'Permission denied — make sure you are signed in.'
        : msg;
      Alert.alert('Could not post status', __DEV__ ? hint : 'Try again in a moment.');
    }
  }

  const activeColor = selectedType.color;

  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drift Status</Text>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: canPost() ? activeColor : colors.border }]}
          onPress={handlePost}
          disabled={!canPost() || saving}
        >
          <Text style={styles.postBtnText}>{saving ? '…' : 'Post'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Status type selector */}
          <Text style={styles.sectionLabel}>What kind of status?</Text>
          <View style={styles.typeGrid}>
            {STATUS_TYPES.map((config) => (
              <TypeCard
                key={config.type}
                config={config}
                selected={selectedType.type === config.type}
                onPress={() => { setSelectedType(config); setText(''); setVenue(''); setCity(''); }}
              />
            ))}
          </View>

          {/* Input area */}
          <View style={[styles.inputCard, { borderColor: activeColor }]}>
            <Text style={[styles.inputEmoji]}>{selectedType.emoji}</Text>

            {isLocationDrop() ? (
              <View style={{ flex: 1, gap: spacing.sm }}>
                <TextInput
                  style={styles.input}
                  value={venue}
                  onChangeText={setVenue}
                  placeholder="Venue / place name"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={60}
                />
                <TextInput
                  style={[styles.input, styles.inputSecondary]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City (optional)"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={40}
                />
              </View>
            ) : (
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={text}
                onChangeText={setText}
                placeholder={selectedType.placeholder}
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={200}
              />
            )}
          </View>
          {!isLocationDrop() && (
            <Text style={[styles.charCount, text.trim().length > 0 && text.trim().length < 3 && { color: colors.error }]}>
              {text.trim().length < 3 ? `${text.trim().length}/3 minimum chars` : `${text.length} / 200`}
            </Text>
          )}

          {/* Audience toggle */}
          <Text style={styles.sectionLabel}>Who can see this?</Text>
          <View style={styles.audienceRow}>
            {(['connections', 'everyone'] as const).map((aud) => (
              <TouchableOpacity
                key={aud}
                style={[styles.audienceBtn, audience === aud && { backgroundColor: `${activeColor}15`, borderColor: activeColor }]}
                onPress={() => setAudience(aud)}
              >
                <Text style={styles.audienceEmoji}>{aud === 'connections' ? '🫂' : '🌍'}</Text>
                <Text style={[styles.audienceText, audience === aud && { color: activeColor, fontWeight: '700' }]}>
                  {aud === 'connections' ? 'Connections only' : 'Everyone'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Expiry note */}
          <View style={styles.expiryNote}>
            <Text style={styles.expiryText}>⏱ Disappears in 24 hours</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: { paddingHorizontal: 4 },
  cancelText: { ...typography.body, color: colors.textSecondary },
  headerTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  postBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  postBtnText: { ...typography.caption, color: '#fff', fontWeight: '700' },

  container: { padding: spacing.lg, paddingBottom: spacing.xxl },

  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  typeGrid: { gap: spacing.sm },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  typeEmoji: { fontSize: 22, width: 28 },
  typeLabel: { ...typography.body, fontWeight: '600', color: colors.text },
  typeDesc: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  selectedDot: { width: 8, height: 8, borderRadius: 4 },

  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: colors.surface,
    marginTop: spacing.lg,
  },
  inputEmoji: { fontSize: 24, marginTop: 2 },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    minHeight: 40,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  inputSecondary: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, minHeight: 36 },
  charCount: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  audienceRow: { flexDirection: 'row', gap: spacing.sm },
  audienceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  audienceEmoji: { fontSize: 20 },
  audienceText: { ...typography.caption, color: colors.text, fontWeight: '500' },

  expiryNote: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  expiryText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
