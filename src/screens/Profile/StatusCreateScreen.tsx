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
  ActivityIndicator,
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
    description: "What's your energy right now?",
    placeholder: 'Main character energy today…',
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

// ─── Live Preview Card ────────────────────────────────────────────────────────

function PreviewCard({
  config,
  text,
  venue,
  city,
  C,
}: {
  config: StatusConfig;
  text: string;
  venue: string;
  city: string;
  C: AppColors;
}) {
  const isLocation = config.type === 'location_drop';
  const displayText = isLocation
    ? venue || 'Your location…'
    : text || config.placeholder;

  return (
    <LinearGradient
      colors={[config.color + '18', config.color + '05']}
      style={previewStyles.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[previewStyles.border, { borderColor: config.color + '40' }]}>
        {/* Type pill */}
        <LinearGradient
          colors={config.grad}
          style={previewStyles.pill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={{ fontSize: 13 }}>{config.emoji}</Text>
          <Text style={previewStyles.pillLabel}>{config.label}</Text>
        </LinearGradient>

        {/* Content */}
        <Text
          style={[
            previewStyles.contentText,
            { color: (isLocation ? venue : text) ? C.text : C.textTertiary },
          ]}
          numberOfLines={3}
        >
          {isLocation && venue ? `📍 ${venue}${city ? ` · ${city}` : ''}` : displayText}
        </Text>

        {/* Footer */}
        <View style={previewStyles.footer}>
          <View style={[previewStyles.expiry, { backgroundColor: C.surface }]}>
            <Ionicons name="time-outline" size={10} color={C.textTertiary} />
            <Text style={[previewStyles.expiryText, { color: C.textTertiary }]}>24h</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const previewStyles = StyleSheet.create({
  card:        { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  border:      { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, minHeight: 110 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  pillLabel:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  contentText: { fontSize: 17, fontWeight: '600', lineHeight: 24, flex: 1 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  expiry:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full },
  expiryText:  { fontSize: 10, fontWeight: '600' },
});

// ─── Type Selector ────────────────────────────────────────────────────────────

function TypeSelector({
  types,
  selected,
  onSelect,
  C,
}: {
  types: StatusConfig[];
  selected: StatusConfig;
  onSelect: (c: StatusConfig) => void;
  C: AppColors;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
    >
      {types.map((config) => {
        const active = selected.type === config.type;
        return (
          <TouchableOpacity
            key={config.type}
            onPress={() => onSelect(config)}
            activeOpacity={0.75}
          >
            {active ? (
              <LinearGradient
                colors={config.grad}
                style={selectorStyles.chipActive}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={{ fontSize: 14 }}>{config.emoji}</Text>
                <Text style={selectorStyles.chipLabelActive}>{config.label}</Text>
              </LinearGradient>
            ) : (
              <View style={[selectorStyles.chip, { borderColor: C.border, backgroundColor: C.surface }]}>
                <Text style={{ fontSize: 14 }}>{config.emoji}</Text>
                <Text style={[selectorStyles.chipLabel, { color: C.textSecondary }]}>{config.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const selectorStyles = StyleSheet.create({
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5 },
  chipActive:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full },
  chipLabel:       { fontSize: 13, fontWeight: '500' },
  chipLabelActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StatusCreateScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<any>();
  const route      = useRoute<StatusCreateRoute>();
  const initialStatus = (route.params as any)?.initialStatus as DriftStatus | undefined;

  const findConfig = (type: StatusType) =>
    STATUS_TYPES.find((c) => c.type === type) ?? STATUS_TYPES[0];

  const { firebaseUser, userProfile } = useAuthStore();
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

  const isLocationDrop = selectedType.type === 'location_drop';
  const canPost = isLocationDrop ? !!venue.trim() : text.trim().length >= 3;
  const charPct = Math.min(1, text.length / 200);

  async function handlePost() {
    if (!firebaseUser || !canPost) return;
    setSaving(true);
    try {
      const now = Date.now();
      const status: DriftStatus = {
        uid:       firebaseUser.uid,
        type:      selectedType.type,
        text:      isLocationDrop ? undefined : text.trim(),
        location:  isLocationDrop ? { venue: venue.trim(), city: city.trim() } : undefined,
        audience,
        expiresAt: now + 24 * 60 * 60 * 1000,
        views:     [],
        reactions: {},
        createdAt: now,
      };
      await postStatus(firebaseUser.uid, status);
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

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <LinearGradient
            colors={selectedType.grad}
            style={styles.headerIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={{ fontSize: 14 }}>{selectedType.emoji}</Text>
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>Drift Status</Text>
            <Text style={styles.headerSub}>Disappears in 24 hours</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handlePost}
          disabled={!canPost || saving}
          activeOpacity={0.85}
          style={styles.postBtnWrap}
        >
          <LinearGradient
            colors={canPost ? selectedType.grad : [C.border, C.border]}
            style={styles.postBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[styles.postBtnText, !canPost && { color: C.textTertiary }]}>Post</Text>
            }
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
          {/* Type selector (horizontal chips) */}
          <Text style={styles.sectionLabel}>Type</Text>
          <TypeSelector
            types={STATUS_TYPES}
            selected={selectedType}
            onSelect={(c) => { setSelectedType(c); setText(''); setVenue(''); setCity(''); }}
            C={C}
          />

          <View style={styles.divider} />

          {/* Input area */}
          <Text style={styles.sectionLabel}>
            {isLocationDrop ? 'Where are you?' : 'What\'s happening?'}
          </Text>

          <View style={[styles.inputCard, { borderColor: selectedType.color + '60' }]}>
            {isLocationDrop ? (
              <View style={{ gap: spacing.sm }}>
                <View style={styles.inputRow}>
                  <Ionicons name="location" size={18} color={selectedType.color} />
                  <TextInput
                    style={[styles.input, { color: C.text }]}
                    value={venue}
                    onChangeText={setVenue}
                    placeholder="Venue or place name *"
                    placeholderTextColor={C.textTertiary}
                    maxLength={60}
                    autoFocus
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
              <>
                <TextInput
                  style={[styles.textArea, { color: C.text }]}
                  value={text}
                  onChangeText={setText}
                  placeholder={selectedType.placeholder}
                  placeholderTextColor={C.textTertiary}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                  autoFocus
                />
                {/* Char progress bar */}
                <View style={styles.charRow}>
                  <Text style={[
                    styles.charCount,
                    text.trim().length > 0 && text.trim().length < 3 && { color: C.error },
                    text.trim().length >= 3 && { color: C.textSecondary },
                  ]}>
                    {text.trim().length < 3 && text.length > 0
                      ? `${text.trim().length}/3 min`
                      : `${text.length}/200`}
                  </Text>
                  <View style={styles.charTrack}>
                    <View style={[styles.charFill, {
                      width: `${charPct * 100}%`,
                      backgroundColor: charPct > 0.9 ? C.error : selectedType.color,
                    }]} />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Live preview */}
          <Text style={styles.sectionLabel}>Preview</Text>
          <PreviewCard
            config={selectedType}
            text={text}
            venue={venue}
            city={city}
            C={C}
          />

          {/* Audience toggle */}
          <Text style={styles.sectionLabel}>Who can see this?</Text>
          <View style={styles.audienceRow}>
            {(['connections', 'everyone'] as const).map((aud) => {
              const active = audience === aud;
              return (
                <TouchableOpacity
                  key={aud}
                  style={[styles.audienceBtn, active && {
                    backgroundColor: selectedType.color + '12',
                    borderColor: selectedType.color,
                  }]}
                  onPress={() => setAudience(aud)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.audienceEmoji}>
                    {aud === 'connections' ? '🫂' : '🌍'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.audienceTitle, active && { color: selectedType.color }]}>
                      {aud === 'connections' ? 'Connections' : 'Everyone'}
                    </Text>
                    <Text style={styles.audienceSub}>
                      {aud === 'connections' ? 'Only people you\'re connected with' : 'All Drift users'}
                    </Text>
                  </View>
                  {active && (
                    <LinearGradient
                      colors={selectedType.grad}
                      style={styles.audienceCheck}
                    >
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.expiryNote}>
            <Ionicons name="time-outline" size={13} color={C.textTertiary} />
            <Text style={styles.expiryText}>Automatically disappears after 24 hours</Text>
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

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    closeBtn: {
      width: 36, height: 36,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.surface, borderRadius: radius.full,
      borderWidth: 1, borderColor: C.border,
    },
    headerCenter: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    },
    headerIconBg: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { ...typography.body, fontWeight: '700', color: C.text },
    headerSub:   { ...typography.small, color: C.textSecondary, marginTop: 1 },

    postBtnWrap: { borderRadius: radius.full, overflow: 'hidden' },
    postBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 9,
      borderRadius: radius.full,
      minWidth: 68,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postBtnText: { ...typography.label, color: '#fff', fontWeight: '700' },

    container: { padding: spacing.lg, paddingBottom: 100 },

    sectionLabel: {
      ...typography.label,
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: spacing.sm,
    },

    divider: {
      height: 1,
      backgroundColor: C.border,
      marginVertical: spacing.md,
    },

    inputCard: {
      backgroundColor: C.inputBg,
      borderRadius: radius.md,
      borderWidth: 1.5,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    },
    input: {
      flex: 1, ...typography.body, paddingVertical: 2,
    },
    textArea: {
      ...typography.bodyLg, minHeight: 100, paddingVertical: 0,
    },

    charRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      marginTop: spacing.sm,
    },
    charCount:  { ...typography.small, color: C.textTertiary, minWidth: 45 },
    charTrack:  { flex: 1, height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
    charFill:   { height: 3, borderRadius: 2 },

    audienceRow: { gap: spacing.sm, marginBottom: spacing.md },
    audienceBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.surface,
    },
    audienceEmoji: { fontSize: 22 },
    audienceTitle: { ...typography.caption, fontWeight: '700', color: C.text },
    audienceSub:   { ...typography.small, color: C.textSecondary, marginTop: 2 },
    audienceCheck: {
      width: 22, height: 22, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
    },

    expiryNote: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      justifyContent: 'center', marginTop: spacing.sm,
    },
    expiryText: { ...typography.small, color: C.textTertiary },
  });
}
