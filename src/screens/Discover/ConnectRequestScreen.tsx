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
import { useAuthStore } from '../../store/authStore';
import { sendConnectionRequest } from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { DiscoverStackParamList } from '../../types';

type RouteProps = RouteProp<DiscoverStackParamList, 'ConnectRequest'>;

const MIN_CHARS = 20;
const MAX_CHARS = 300;

// Prompt starters to help users write a genuine note
const PROMPT_STARTERS = [
  "Your bio about __ really resonated because...",
  "I noticed we're both into __ and I'd love to...",
  "Your vibe seems __ and I think we'd get along because...",
  "I'm going to [event/place] and thought you might...",
  "Your memory about __ caught my attention...",
];

export default function ConnectRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { user } = route.params;
  const { firebaseUser } = useAuthStore();

  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTip, setActiveTip] = useState<number | null>(null);

  const charsLeft = MAX_CHARS - note.length;
  const isReady = note.trim().length >= MIN_CHARS;

  function applyStarter(starter: string) {
    setNote(starter.replace('__', ''));
    setActiveTip(null);
  }

  async function handleSend() {
    if (!isReady || !firebaseUser) return;
    setLoading(true);
    try {
      await sendConnectionRequest(firebaseUser.uid, user.uid, note);
      Alert.alert(
        'Request Sent! 🤝',
        `Your connect request has been sent to ${user.name}. They'll get back to you soon.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Error', 'Could not send request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Who you're connecting with */}
          <View style={styles.toCard}>
            <Avatar name={user.name} photoURL={user.photoURL} size={52} />
            <View style={styles.toInfo}>
              <Text style={styles.toName}>{user.name}, {user.age}</Text>
              {user.city && (
                <Text style={styles.toCity}>📍 {user.city}</Text>
              )}
              <View style={styles.toVibes}>
                {user.vibeProfile?.primaryVibes.slice(0, 2).map((v) => (
                  <View key={v} style={styles.vibePill}>
                    <Text style={styles.vibePillText}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* The ask */}
          <View style={styles.promptSection}>
            <Text style={styles.promptTitle}>
              What made {user.name} interesting to you? ✨
            </Text>
            <Text style={styles.promptSubtitle}>
              Be genuine — a thoughtful note gets 3× more responses than "hey".
              Minimum {MIN_CHARS} characters.
            </Text>
          </View>

          {/* Text input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={`Write something genuine to ${user.name}...`}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={MAX_CHARS}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.inputFooter}>
              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min((note.trim().length / MIN_CHARS) * 100, 100)}%`,
                      backgroundColor: isReady ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.charCount, charsLeft < 50 && styles.charCountWarning]}>
                {isReady ? '✓ ' : `${note.trim().length}/${MIN_CHARS} `}
                {charsLeft < MAX_CHARS ? `${charsLeft} left` : ''}
              </Text>
            </View>
          </View>

          {/* Prompt starters */}
          <View style={styles.startersSection}>
            <Text style={styles.startersLabel}>Need a nudge? Try these:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.startersList}>
                {PROMPT_STARTERS.map((starter, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.starterChip, activeTip === i && styles.starterChipActive]}
                    onPress={() => applyStarter(starter)}
                  >
                    <Text
                      style={[styles.starterText, activeTip === i && styles.starterTextActive]}
                      numberOfLines={2}
                    >
                      {starter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>💡 What works</Text>
            <Text style={styles.tipLine}>• Mention something specific from their profile</Text>
            <Text style={styles.tipLine}>• Share why you think you'd vibe</Text>
            <Text style={styles.tipLine}>• Suggest a casual activity (coffee, event, game)</Text>
            <Text style={styles.tipLine}>• Keep it relaxed — no pressure</Text>
          </View>
        </ScrollView>

        {/* Send button */}
        <View style={styles.sendBar}>
          <TouchableOpacity
            style={[styles.sendBtn, !isReady && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!isReady || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Text style={styles.sendBtnIcon}>🤝</Text>
                <Text style={styles.sendBtnText}>
                  {isReady ? `Send to ${user.name}` : `${MIN_CHARS - note.trim().length} more chars needed`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backIcon: { fontSize: 22, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  toCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.lg, ...shadows.card,
  },
  toInfo: { flex: 1 },
  toName: { ...typography.body, fontWeight: '700', color: colors.text },
  toCity: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  toVibes: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  vibePill: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full, backgroundColor: `${colors.secondary}15`,
  },
  vibePillText: { ...typography.small, color: colors.secondary, fontWeight: '600' },

  promptSection: { marginBottom: spacing.md },
  promptTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
  promptSubtitle: {
    ...typography.body, color: colors.textSecondary, lineHeight: 24,
  },

  inputWrapper: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  noteInput: {
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 120,
    lineHeight: 24,
  },
  inputFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  progressBar: {
    flex: 1, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  charCount: { ...typography.small, color: colors.textSecondary },
  charCountWarning: { color: colors.error },

  startersSection: { marginBottom: spacing.lg },
  startersLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '600' },
  startersList: { flexDirection: 'row', gap: spacing.sm },
  starterChip: {
    width: 160, padding: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  starterChipActive: { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
  starterText: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  starterTextActive: { color: colors.primary },

  tipsCard: {
    backgroundColor: `${colors.secondary}08`,
    borderRadius: radius.md, padding: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.secondary,
  },
  tipsTitle: { ...typography.caption, fontWeight: '700', color: colors.secondary, marginBottom: spacing.sm },
  tipLine: { ...typography.caption, color: colors.textSecondary, lineHeight: 22 },

  sendBar: {
    padding: spacing.lg, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  sendBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...shadows.card,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnIcon: { fontSize: 20 },
  sendBtnText: { ...typography.body, color: colors.background, fontWeight: '700' },
});
