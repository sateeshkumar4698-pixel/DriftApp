import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
import { useAuthStore } from '../../store/authStore';
import { proposeMeetup } from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { DiscoverStackParamList, MeetupProposal, MeetupType } from '../../types';

type RouteProps = RouteProp<DiscoverStackParamList, 'MeetupSuggest'>;

interface MeetupOption {
  type: MeetupType;
  emoji: string;
  label: string;
  description: string;
  placeholderSuggestion: string;
}

const MEETUP_OPTIONS: MeetupOption[] = [
  {
    type: 'cafe',
    emoji: '☕',
    label: 'Coffee / Cafe',
    description: 'Casual, low-pressure',
    placeholderSuggestion: 'e.g. Blue Tokai, Indiranagar',
  },
  {
    type: 'food',
    emoji: '🍕',
    label: 'Food / Dinner',
    description: 'Over a good meal',
    placeholderSuggestion: 'e.g. Fatty Bao, Koramangala',
  },
  {
    type: 'jamming',
    emoji: '🎸',
    label: 'Jamming Session',
    description: 'Make music together',
    placeholderSuggestion: 'e.g. your place, rehearsal studio',
  },
  {
    type: 'gaming',
    emoji: '🎮',
    label: 'Gaming',
    description: 'Play online or in-person',
    placeholderSuggestion: 'e.g. play Ludo on Drift or LAN cafe',
  },
  {
    type: 'event',
    emoji: '🎉',
    label: 'Attend an Event',
    description: 'Go to something together',
    placeholderSuggestion: 'Share a Drift event link or venue',
  },
  {
    type: 'walk',
    emoji: '🌿',
    label: 'Walk / Outdoors',
    description: 'Easy and relaxed',
    placeholderSuggestion: 'e.g. Cubbon Park, Lalbagh',
  },
  {
    type: 'custom',
    emoji: '✨',
    label: 'Something else',
    description: 'Your own idea',
    placeholderSuggestion: 'Describe your idea...',
  },
];

export default function MeetupSuggestionScreen() {
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { connectionId, connectedUser } = route.params;
  const { firebaseUser } = useAuthStore();

  const [selectedType, setSelectedType] = useState<MeetupType | null>(null);
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const selected = MEETUP_OPTIONS.find((o) => o.type === selectedType);
  const canSend = selectedType !== null && note.trim().length >= 10;

  async function handlePropose() {
    if (!canSend || !firebaseUser) return;
    setLoading(true);
    try {
      const proposal: MeetupProposal = {
        id: `meetup_${Date.now()}`,
        proposedBy: firebaseUser.uid,
        meetupType: selectedType!,
        note: note.trim(),
        suggestedPlace: place.trim() || undefined,
        status: 'pending',
        createdAt: Date.now(),
      };
      await proposeMeetup(connectionId, proposal);
      Alert.alert(
        '📅 Meetup Proposed!',
        `Your meetup idea has been sent to ${connectedUser.name}. They'll respond soon!`,
        [{ text: 'Great!', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Error', 'Could not send meetup proposal. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan a Meetup</Text>
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
          {/* Who */}
          <View style={styles.withCard}>
            <Text style={styles.withLabel}>Planning with</Text>
            <View style={styles.withRow}>
              <Avatar name={connectedUser.name} photoURL={connectedUser.photoURL} size={40} />
              <Text style={styles.withName}>{connectedUser.name}</Text>
              {connectedUser.city && (
                <Text style={styles.withCity}>· {connectedUser.city}</Text>
              )}
            </View>
          </View>

          {/* Pick type */}
          <Text style={styles.sectionTitle}>What kind of meetup? 👇</Text>
          <View style={styles.optionsGrid}>
            {MEETUP_OPTIONS.map((option) => {
              const isSelected = selectedType === option.type;
              return (
                <TouchableOpacity
                  key={option.type}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => setSelectedType(option.type)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDesc, isSelected && styles.optionDescSelected]}>
                    {option.description}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedCheck}>
                      <Text style={styles.selectedCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Place (optional) */}
          {selectedType && (
            <>
              <Text style={styles.sectionTitle}>Suggest a place (optional)</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputIcon}>📍</Text>
                <TextInput
                  style={styles.placeInput}
                  value={place}
                  onChangeText={setPlace}
                  placeholder={selected?.placeholderSuggestion ?? ''}
                  placeholderTextColor={C.textSecondary}
                />
              </View>

              {/* Note */}
              <Text style={styles.sectionTitle}>
                Add a note to {connectedUser.name} ✍️
              </Text>
              <View style={styles.noteWrapper}>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder={`Hey ${connectedUser.name}, I was thinking we could...`}
                  placeholderTextColor={C.textSecondary}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{note.length}/300</Text>
              </View>

              {/* Quick suggestions */}
              <View style={styles.quickSection}>
                <Text style={styles.quickLabel}>Quick starters:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.quickRow}>
                    {getQuickStarters(selectedType, connectedUser.name).map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.quickChip}
                        onPress={() => setNote(s)}
                      >
                        <Text style={styles.quickChipText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </>
          )}
        </ScrollView>

        {/* Send */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={handlePropose}
            disabled={!canSend || loading}
          >
            {loading ? (
              <ActivityIndicator color={C.background} />
            ) : (
              <>
                <Text style={styles.sendBtnIcon}>
                  {selected?.emoji ?? '📅'}
                </Text>
                <Text style={styles.sendBtnText}>
                  {canSend
                    ? `Propose to ${connectedUser.name}`
                    : selectedType
                    ? 'Write a note (min 10 chars)'
                    : 'Pick a meetup type above'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getQuickStarters(type: MeetupType, name: string): string[] {
  const starters: Record<MeetupType, string[]> = {
    cafe: [
      `Hey ${name}, want to grab coffee this weekend?`,
      `Would love to chat over coffee — free anytime?`,
    ],
    food: [
      `Hey ${name}, know any good spots? Let's grab dinner!`,
      `Want to try that new place together?`,
    ],
    jamming: [
      `Hey ${name}, would love to jam sometime! What do you play?`,
      `We should make something together — you up for it?`,
    ],
    gaming: [
      `Want to play Ludo on Drift tonight? Should be fun!`,
      `Up for some games this weekend?`,
    ],
    event: [
      `I spotted a cool event this weekend — want to go together?`,
      `There's something happening nearby, thought you might like it!`,
    ],
    walk: [
      `Hey ${name}, want to catch up over a walk sometime?`,
      `Cubbon Park on Sunday morning? Easy and chill.`,
    ],
    custom: [
      `Hey ${name}, had an idea for something fun — hear me out!`,
      `Thinking of something different — what do you think?`,
    ],
  };
  return starters[type] ?? [];
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    headerTitle: { ...typography.heading, color: C.text },

    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

    withCard: {
      backgroundColor: C.surface, borderRadius: radius.md,
      padding: spacing.md, marginBottom: spacing.lg, ...shadows.card,
    },
    withLabel: { ...typography.small, color: C.textSecondary, marginBottom: spacing.sm },
    withRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    withName: { ...typography.body, fontWeight: '700', color: C.text },
    withCity: { ...typography.caption, color: C.textSecondary },

    sectionTitle: {
      ...typography.body, fontWeight: '700', color: C.text,
      marginBottom: spacing.md, marginTop: spacing.md,
    },

    optionsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    },
    optionCard: {
      width: '47%', backgroundColor: C.surface, borderRadius: radius.md,
      padding: spacing.md, borderWidth: 1.5, borderColor: C.border,
      alignItems: 'center', position: 'relative',
    },
    optionCardSelected: {
      borderColor: C.primary, backgroundColor: `${C.primary}08`,
    },
    optionEmoji: { fontSize: 28, marginBottom: spacing.xs },
    optionLabel: { ...typography.caption, fontWeight: '700', color: C.text, textAlign: 'center' },
    optionLabelSelected: { color: C.primary },
    optionDesc: { ...typography.small, color: C.textSecondary, textAlign: 'center', marginTop: 2 },
    optionDescSelected: { color: C.primary },
    selectedCheck: {
      position: 'absolute', top: 8, right: 8,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    },
    selectedCheckText: { ...typography.small, color: C.background, fontWeight: '700' },

    inputBox: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    inputIcon: { fontSize: 16, marginRight: spacing.sm },
    placeInput: { flex: 1, ...typography.body, color: C.text },

    noteWrapper: {
      backgroundColor: C.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    },
    noteInput: {
      padding: spacing.md, ...typography.body, color: C.text,
      minHeight: 100, lineHeight: 24,
    },
    charCount: {
      ...typography.small, color: C.textSecondary,
      textAlign: 'right', padding: spacing.sm,
    },

    quickSection: { marginTop: spacing.md },
    quickLabel: { ...typography.small, color: C.textSecondary, marginBottom: spacing.sm },
    quickRow: { flexDirection: 'row', gap: spacing.sm },
    quickChip: {
      maxWidth: 220, backgroundColor: `${C.secondary}10`,
      borderRadius: radius.md, padding: spacing.sm,
      borderWidth: 1, borderColor: `${C.secondary}30`,
    },
    quickChipText: { ...typography.small, color: C.secondary, lineHeight: 18 },

    footer: {
      padding: spacing.lg, paddingBottom: spacing.xl,
      borderTopWidth: 1, borderTopColor: C.border,
      backgroundColor: C.background,
    },
    sendBtn: {
      backgroundColor: C.primary, borderRadius: radius.lg,
      paddingVertical: spacing.md, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, ...shadows.card,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnIcon: { fontSize: 20 },
    sendBtnText: { ...typography.body, color: C.background, fontWeight: '700' },
  });
}
