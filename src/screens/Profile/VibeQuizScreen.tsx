import React, { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import { useTheme, AppColors, spacing, typography, radius } from '../../utils/useTheme';
import { ProfileStackParamList, VibeProfile } from '../../types';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

// ─── Quiz data ─────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question: string;
  subtitle?: string;
  type: 'single' | 'multi';
  options: { label: string; emoji: string; value: string }[];
  maxSelect?: number;
}

const QUESTIONS: Question[] = [
  {
    id: 'energy',
    question: "What's your energy like on a typical day?",
    type: 'single',
    options: [
      { label: 'Calm & reflective', emoji: '🌿', value: '0.1' },
      { label: 'Steady & grounded', emoji: '☕', value: '0.35' },
      { label: 'Lively & engaged', emoji: '⚡', value: '0.65' },
      { label: 'Full throttle always', emoji: '🚀', value: '0.9' },
    ],
  },
  {
    id: 'social',
    question: 'How do you recharge after a long week?',
    type: 'single',
    options: [
      { label: 'Solo time — book, music, silence', emoji: '🎧', value: '0.1' },
      { label: 'Small group of close friends', emoji: '🫂', value: '0.4' },
      { label: 'A dinner party or house hang', emoji: '🍷', value: '0.65' },
      { label: 'Big crowd, loud energy', emoji: '🎉', value: '0.9' },
    ],
  },
  {
    id: 'adventure',
    question: 'Plans for the weekend — how do you feel?',
    type: 'single',
    options: [
      { label: 'I already have it all planned', emoji: '📋', value: '0.1' },
      { label: 'Rough idea, flexible on details', emoji: '🗺️', value: '0.4' },
      { label: 'Open to anything, surprise me', emoji: '🎲', value: '0.7' },
      { label: 'Zero plans is the best plan', emoji: '🌀', value: '0.95' },
    ],
  },
  {
    id: 'aesthetic',
    question: 'Your ideal space looks like…',
    type: 'single',
    options: [
      { label: 'Clean, minimal, functional', emoji: '🪴', value: '0.1' },
      { label: 'Cozy with personality', emoji: '🕯️', value: '0.4' },
      { label: 'Curated & stylish', emoji: '🖼️', value: '0.7' },
      { label: 'Loud, layered, full of art', emoji: '🎨', value: '0.95' },
    ],
  },
  {
    id: 'primaryVibes',
    question: 'Pick your vibes (choose up to 4)',
    subtitle: 'What feels most like you?',
    type: 'multi',
    maxSelect: 4,
    options: [
      { label: 'Creative',     emoji: '🎨', value: 'Creative'     },
      { label: 'Chill',        emoji: '🌊', value: 'Chill'        },
      { label: 'Ambitious',    emoji: '🔥', value: 'Ambitious'    },
      { label: 'Witty',        emoji: '⚡', value: 'Witty'        },
      { label: 'Romantic',     emoji: '🌹', value: 'Romantic'     },
      { label: 'Adventurous',  emoji: '🏕️', value: 'Adventurous'  },
      { label: 'Intellectual', emoji: '📚', value: 'Intellectual' },
      { label: 'Spiritual',    emoji: '✨', value: 'Spiritual'    },
      { label: 'Sporty',       emoji: '💪', value: 'Sporty'       },
      { label: 'Foodie',       emoji: '🍜', value: 'Foodie'       },
    ],
  },
  {
    id: 'musicTaste',
    question: 'Your music taste (pick up to 3)',
    type: 'multi',
    maxSelect: 3,
    options: [
      { label: 'Hip-hop / Rap',    emoji: '🎤', value: 'Hip-hop'    },
      { label: 'Indie / Alt',      emoji: '🎸', value: 'Indie'      },
      { label: 'Electronic / EDM', emoji: '🎛️', value: 'Electronic' },
      { label: 'Pop',              emoji: '🎵', value: 'Pop'        },
      { label: 'R&B / Soul',       emoji: '🎼', value: 'R&B'        },
      { label: 'Classical / Jazz', emoji: '🎹', value: 'Classical'  },
      { label: 'Rock / Metal',     emoji: '🤘', value: 'Rock'       },
      { label: 'Folk / Acoustic',  emoji: '🪕', value: 'Folk'       },
    ],
  },
  {
    id: 'nightlifeStyle',
    question: 'Your ideal night out is…',
    type: 'single',
    options: [
      { label: 'Home with good people',      emoji: '🏠', value: 'homebody'   },
      { label: 'Rooftop or lounge vibes',    emoji: '🥂', value: 'lounge'     },
      { label: 'House party with a playlist', emoji: '🎶', value: 'houseparty' },
      { label: 'Club, dancing all night',    emoji: '🕺', value: 'club'       },
      { label: 'Bonfire / outdoor hangout',  emoji: '🔥', value: 'outdoor'    },
    ],
  },
];

function computeVibeProfile(answers: Record<string, string | string[]>): VibeProfile {
  return {
    energy:        parseFloat(answers.energy as string) || 0.5,
    social:        parseFloat(answers.social as string) || 0.5,
    adventure:     parseFloat(answers.adventure as string) || 0.5,
    aesthetic:     parseFloat(answers.aesthetic as string) || 0.5,
    primaryVibes:  (answers.primaryVibes  as string[]) || [],
    musicTaste:    (answers.musicTaste    as string[]) || [],
    nightlifeStyle:(answers.nightlifeStyle as VibeProfile['nightlifeStyle']) || 'homebody',
    quizCompletedAt: Date.now(),
  };
}

// ─── Option Button ─────────────────────────────────────────────────────────────

function OptionButton({
  option, selected, onPress, C,
}: {
  option: Question['options'][number];
  selected: boolean;
  onPress: () => void;
  C: AppColors;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.option,
        { backgroundColor: C.surface, borderColor: C.border },
        selected && { borderColor: C.primary, backgroundColor: `${C.primary}12` },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.optionEmoji}>{option.emoji}</Text>
      <Text style={[styles.optionLabel, { color: C.text }, selected && { color: C.primary, fontWeight: '600' }]}>
        {option.label}
      </Text>
      {selected && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VibeQuizScreen() {
  const navigation = useNavigation<Nav>();
  const { C } = useTheme();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();
  const [step,    setStep]    = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving,  setSaving]  = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const question = QUESTIONS[step];
  const total    = QUESTIONS.length;
  const progress = (step + 1) / total;

  React.useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 300, useNativeDriver: false }).start();
  }, [step]);

  function getAnswer(): string | string[] {
    return answers[question.id] ?? (question.type === 'multi' ? [] : '');
  }

  function handleSelect(value: string) {
    if (question.type === 'single') {
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
    } else {
      const current = getAnswer() as string[];
      const max = question.maxSelect ?? 99;
      if (current.includes(value)) {
        setAnswers((prev) => ({ ...prev, [question.id]: current.filter((v) => v !== value) }));
      } else if (current.length < max) {
        setAnswers((prev) => ({ ...prev, [question.id]: [...current, value] }));
      }
    }
  }

  function isAnswered(): boolean {
    const ans = getAnswer();
    if (question.type === 'single') return !!ans;
    return (ans as string[]).length > 0;
  }

  function handleNext() {
    if (!isAnswered()) return;
    if (step < total - 1) setStep((s) => s + 1);
    else handleSave();
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
    else navigation.goBack();
  }

  async function handleSave() {
    if (!firebaseUser || !userProfile) return;
    setSaving(true);
    try {
      const vibeProfile = computeVibeProfile(answers);
      const updated = { ...userProfile, vibeProfile, profileCompleteness: Math.min(100, (userProfile.profileCompleteness ?? 60) + 20) };
      await setUserProfile(firebaseUser.uid, { vibeProfile, profileCompleteness: updated.profileCompleteness });
      setStoreProfile(updated);
      Alert.alert('Vibe set! 🔥', 'Your Drift vibe is saved. People who match your energy will find you.', [
        { text: "Let's go", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save your vibe. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const answer = getAnswer();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: C.background }]}>
      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: C.primary, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={[styles.backBtn, { backgroundColor: C.surface }]}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.stepCount, { color: C.textSecondary }]}>{step + 1} / {total}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.question, { color: C.text }]}>{question.question}</Text>
        {question.subtitle && (
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>{question.subtitle}</Text>
        )}
        {question.type === 'multi' && question.maxSelect && (
          <Text style={[styles.hint, { color: C.primary }]}>
            {(answer as string[]).length} / {question.maxSelect} selected
          </Text>
        )}

        <View style={styles.options}>
          {question.options.map((opt) => {
            const selected =
              question.type === 'single'
                ? answer === opt.value
                : (answer as string[]).includes(opt.value);
            return (
              <OptionButton
                key={opt.value}
                option={opt}
                selected={selected}
                onPress={() => handleSelect(opt.value)}
                C={C}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Next button */}
      <View style={[styles.footer, { borderTopColor: C.border, backgroundColor: C.background }]}>
        <TouchableOpacity
          style={[
            styles.nextBtn,
            { backgroundColor: C.primary },
            !isAnswered() && styles.nextBtnDisabled,
          ]}
          onPress={handleNext}
          disabled={!isAnswered() || saving}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {saving ? 'Saving…' : step === total - 1 ? 'Set My Vibe 🔥' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  progressTrack: { height: 3 },
  progressFill:  { height: 3 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full,
  },
  stepCount: { ...typography.caption, fontWeight: '600' },

  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  question:  { ...typography.title, lineHeight: 34, marginBottom: spacing.xs },
  subtitle:  { ...typography.body, marginBottom: spacing.sm },
  hint:      { ...typography.caption, fontWeight: '600', marginBottom: spacing.md },

  options: { gap: spacing.sm, marginTop: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionEmoji:  { fontSize: 22, width: 30, textAlign: 'center' },
  optionLabel:  { flex: 1, ...typography.body, fontWeight: '500' },

  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
  },
  nextBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
