import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList } from '../../types';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { gameSounds } from '../../services/gameSounds';

// ─── Navigation ───────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<GamesStackParamList, 'NeverHaveIEver'>;

// ─── Domain Types ─────────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'playing' | 'stats';
type SpiceLevel = 'mild' | 'spicy' | 'wild' | 'adult' | 'extreme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Player Colors ────────────────────────────────────────────────────────────

const PLAYER_COLORS: readonly string[] = [
  '#FF4B6E', '#6C5CE7', '#00B894', '#FDCB6E',
  '#0984E3', '#E17055', '#A855F7', '#00CEC9',
];

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

// ─── Card Data ────────────────────────────────────────────────────────────────

const NHIE_MILD: string[] = [
  'Never have I ever been on a road trip with strangers.',
  'Never have I ever fallen asleep in a movie theater.',
  'Never have I ever eaten food directly from the pot.',
  'Never have I ever lied about my age.',
  'Never have I ever pretended to be asleep to avoid a conversation.',
  'Never have I ever stayed in a hotel alone.',
  'Never have I ever eaten an entire pizza by myself.',
  'Never have I ever called the wrong person by accident.',
  'Never have I ever gone a full day without looking at my phone.',
  'Never have I ever danced alone in my room.',
  'Never have I ever cried while watching a movie.',
  'Never have I ever gotten lost in my own city.',
  'Never have I ever bought something from an infomercial.',
  'Never have I ever pulled an all-nighter for fun.',
  'Never have I ever gone to a restaurant alone.',
  'Never have I ever sent a text to the wrong person.',
  'Never have I ever binge-watched an entire season in one day.',
  'Never have I ever talked to an animal like they understood me.',
  'Never have I ever sung a full song in the shower.',
  'Never have I ever worn an outfit twice in a row.',
  'Never have I ever fallen asleep on public transport.',
  'Never have I ever eaten something that was expired.',
  'Never have I ever googled something embarrassing.',
  'Never have I ever re-gifted a present.',
  'Never have I ever pretended to like a gift.',
];

const NHIE_SPICY: string[] = [
  'Never have I ever had a crush on a teacher or professor.',
  'Never have I ever stayed up all night talking to someone I liked.',
  'Never have I ever sent someone a risky text I almost immediately regretted.',
  'Never have I ever dated two people at the same time.',
  'Never have I ever kissed a friend.',
  'Never have I ever had a dream about someone in this room.',
  'Never have I ever stalked an ex on social media.',
  'Never have I ever canceled plans to stay home with someone I was talking to.',
  'Never have I ever had a secret crush on a friend\'s partner.',
  'Never have I ever flirted my way out of a situation.',
  'Never have I ever sent a voice note I immediately cringed at.',
  'Never have I ever told someone I liked them over text.',
  'Never have I ever had feelings for someone who didn\'t know.',
  'Never have I ever been on a date that went really unexpectedly well.',
  'Never have I ever blocked someone after a date.',
  'Never have I ever liked a bunch of someone\'s old posts.',
  'Never have I ever rehearsed a conversation before having it.',
  'Never have I ever been ghosted by someone I really liked.',
  'Never have I ever left a date early.',
  'Never have I ever fallen for someone I met online.',
  'Never have I ever confessed my feelings and been rejected.',
  'Never have I ever slow-danced with someone I liked.',
  'Never have I ever pretended not to see someone to avoid talking to them.',
  'Never have I ever kept a screenshot of a good conversation.',
  'Never have I ever had a crush on my best friend.',
];

const NHIE_WILD: string[] = [
  'Never have I ever done something illegal (minor stuff).',
  'Never have I ever lied to get out of serious trouble.',
  'Never have I ever skipped school or work and gone completely off the grid.',
  'Never have I ever snuck out of my house at night.',
  'Never have I ever made a huge impulse decision I still stand by.',
  'Never have I ever gotten into a physical fight.',
  'Never have I ever been kicked out of a place.',
  'Never have I ever stolen something, even something small.',
  'Never have I ever faked sick to avoid responsibility.',
  'Never have I ever been in a police situation.',
  'Never have I ever done something I knew was wrong and done it anyway.',
  'Never have I ever been dared to do something and actually did it.',
  'Never have I ever broken someone\'s trust.',
  'Never have I ever lied on a resume or application.',
  'Never have I ever cheated in a test or exam.',
  'Never have I ever done something for money that I\'m not proud of.',
  'Never have I ever eavesdropped on a private conversation.',
  'Never have I ever started a rumor.',
  'Never have I ever pretended to be someone else online.',
  'Never have I ever gotten into a stranger\'s car.',
  'Never have I ever gambled with money I didn\'t have.',
  'Never have I ever vandalized something.',
  'Never have I ever been in a situation where I thought I might not get out of.',
  'Never have I ever ratted someone out.',
  'Never have I ever been completely blackout on a school/work night.',
];

const NHIE_ADULT: string[] = [
  'Never have I ever kissed someone the same day I met them.',
  'Never have I ever had a relationship with someone significantly older or younger.',
  'Never have I ever been in an open relationship.',
  'Never have I ever had a friends-with-benefits situation.',
  'Never have I ever kissed someone whose name I didn\'t know.',
  'Never have I ever been in a situationship I should have ended sooner.',
  'Never have I ever done something intimate in a public place.',
  'Never have I ever slid into someone\'s DMs and had it work out.',
  'Never have I ever had a secret that, if revealed, would change how someone sees me.',
  'Never have I ever had feelings for someone who was taken.',
  'Never have I ever been with someone purely because of physical attraction.',
  'Never have I ever had an ex come back and considered going back.',
  'Never have I ever sent or received something I\'d never want my parents to see.',
  'Never have I ever had a one-night stand.',
  'Never have I ever made out with someone in front of others.',
  'Never have I ever had a crush on two people from the same friend group.',
  'Never have I ever ended something because the chemistry was off in person.',
  'Never have I ever kept someone as a backup option.',
  'Never have I ever fallen asleep next to someone I barely knew.',
  'Never have I ever had a heated argument that ended in making up.',
  'Never have I ever been the one who ended something real.',
  'Never have I ever been physically attracted to someone I genuinely disliked.',
  'Never have I ever had a late-night conversation that changed how I felt about someone.',
  'Never have I ever kissed someone I probably shouldn\'t have.',
  'Never have I ever had a secret fling nobody knew about.',
];

const NHIE_EXTREME: string[] = [
  'Never have I ever hooked up with someone from this group.',
  'Never have I ever been intimate with someone in this very building.',
  'Never have I ever had a situationship with someone significant in my life (family friend, coworker, etc.).',
  'Never have I ever been caught being intimate.',
  'Never have I ever had feelings for two people simultaneously and acted on both.',
  'Never have I ever been in a relationship with someone I knew was bad for me and couldn\'t stop.',
  'Never have I ever had an encounter so wild I still can\'t fully believe it happened.',
  'Never have I ever kept a major secret about my romantic life from everyone I know.',
  'Never have I ever been the reason someone\'s relationship ended.',
  'Never have I ever done something during intimacy that I\'ve never told anyone about.',
  'Never have I ever had feelings for someone in this room and not said it.',
  'Never have I ever been intimate while someone else was home.',
  'Never have I ever taken a risk in my romantic life that completely paid off.',
  'Never have I ever had a photo or video on my phone that no one can ever see.',
  'Never have I ever lost control of myself because of how attracted I was to someone.',
  'Never have I ever had a connection so intense it scared me.',
  'Never have I ever done something in a relationship that I\'m ashamed of.',
  'Never have I ever completely changed who I was for someone I was attracted to.',
  'Never have I ever had something happen in one night that I\'ll never forget.',
  'Never have I ever crossed a line I said I never would in a relationship.',
  'Never have I ever had feelings for someone here right now.',
  'Never have I ever been someone\'s dirty secret.',
  'Never have I ever had a one-night stand with someone I still think about.',
  'Never have I ever had an encounter that if anyone knew, it would change everything.',
  'Never have I ever done something intimate that made me see myself completely differently.',
];

// ─── Spice Level Config ───────────────────────────────────────────────────────

interface SpiceOption {
  level: SpiceLevel;
  emoji: string;
  label: string;
  description: string;
  color: string;
  neonColor: string;
  ageGate?: boolean;
}

const SPICE_OPTIONS: SpiceOption[] = [
  { level: 'mild',    emoji: '🟢', label: 'Mild',    description: 'Safe & fun for all',    color: '#00B894', neonColor: '#00E676' },
  { level: 'spicy',   emoji: '🌶️', label: 'Spicy',   description: 'Revealing & flirty',    color: '#FF7675', neonColor: '#FF6B6B' },
  { level: 'wild',    emoji: '🔥', label: 'Wild',    description: 'No filter zone',         color: '#FF4B6E', neonColor: '#FF4757' },
  { level: 'adult',   emoji: '🍑', label: 'Adult+',  description: 'Bold & intimate (18+)',  color: '#A855F7', neonColor: '#BD6FFF', ageGate: true },
  { level: 'extreme', emoji: '💀', label: 'Extreme', description: 'Maximum boldness 🔞',    color: '#7C3AED', neonColor: '#9B59B6', ageGate: true },
];

function getPool(level: SpiceLevel): string[] {
  if (level === 'mild')    return NHIE_MILD;
  if (level === 'spicy')   return NHIE_SPICY;
  if (level === 'wild')    return NHIE_WILD;
  if (level === 'adult')   return NHIE_ADULT;
  return NHIE_EXTREME;
}

function shufflePool(pool: string[]): string[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NeverHaveIEverScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { C, isDark } = useTheme();
  const styles = makeStyles(C, isDark);

  // ── Phase ──
  const [phase, setPhase] = useState<GamePhase>('setup');

  // ── Setup ──
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('mild');

  // ── Game State ──
  const [players, setPlayers] = useState<{ name: string; color: string; haveCount: number }[]>([]);
  const [cards, setCards] = useState<string[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  // Set of player indices who said "I HAVE" for the current card
  const [haveSet, setHaveSet] = useState<Set<number>>(new Set());
  // History: cardText → indices who said "I HAVE"
  const [history, setHistory] = useState<Array<{ card: string; haveIndices: number[] }>>([]);

  // ── Animation ──
  const cardFlipAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(1)).current;

  const spiceConfig = SPICE_OPTIONS.find((s) => s.level === spiceLevel)!;

  // ─── Setup Handlers ────────────────────────────────────────────────────────

  function updatePlayerName(index: number, name: string) {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }

  function addPlayer() {
    if (playerNames.length < MAX_PLAYERS) setPlayerNames((prev) => [...prev, '']);
  }

  function removePlayer(index: number) {
    if (playerNames.length > MIN_PLAYERS) setPlayerNames((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSpiceSelect(opt: SpiceOption) {
    if (opt.ageGate) {
      Alert.alert(
        `${opt.emoji} ${opt.label} Mode`,
        `This mode contains mature content intended for adults (18+) only.\n\nOnly proceed if everyone is comfortable with bold, intimate statements.\n\nAre you all 18+?`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: "Yes, We're 18+", style: 'destructive', onPress: () => setSpiceLevel(opt.level) },
        ],
      );
    } else {
      setSpiceLevel(opt.level);
    }
  }

  const canStart = playerNames.every((n) => n.trim().length > 0);

  function startGame() {
    const initialPlayers = playerNames.map((name, i) => ({
      name: name.trim(),
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      haveCount: 0,
    }));
    const shuffled = shufflePool(getPool(spiceLevel));
    setPlayers(initialPlayers);
    setCards(shuffled);
    setCurrentCardIdx(0);
    setHaveSet(new Set());
    setHistory([]);
    setPhase('playing');
    gameSounds.fire('button_tap');
    animateCardIn();
  }

  // ─── Animation Helpers ──────────────────────────────────────────────────────

  function animateCardIn() {
    cardFlipAnim.setValue(0);
    cardScaleAnim.setValue(0.85);
    Animated.parallel([
      Animated.spring(cardFlipAnim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.spring(cardScaleAnim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }

  function animateCardOut(onDone: () => void) {
    Animated.parallel([
      Animated.timing(cardFlipAnim, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(cardScaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ]).start(() => onDone());
  }

  // ─── Game Handlers ──────────────────────────────────────────────────────────

  function toggleHave(playerIdx: number) {
    gameSounds.fire('button_tap');
    setHaveSet((prev) => {
      const next = new Set(prev);
      if (next.has(playerIdx)) next.delete(playerIdx);
      else next.add(playerIdx);
      return next;
    });
  }

  function handleNext() {
    gameSounds.fire('turn_change');
    const currentCard = cards[currentCardIdx];
    const haveIndices = Array.from(haveSet);

    // Update haveCount on players
    setPlayers((prev) => prev.map((p, i) => ({
      ...p,
      haveCount: p.haveCount + (haveSet.has(i) ? 1 : 0),
    })));

    // Save history
    setHistory((prev) => [...prev, { card: currentCard, haveIndices }]);

    const nextIdx = currentCardIdx + 1;
    if (nextIdx >= cards.length) {
      setPhase('stats');
      return;
    }

    animateCardOut(() => {
      setCurrentCardIdx(nextIdx);
      setHaveSet(new Set());
      animateCardIn();
    });
  }

  function endGame() {
    Alert.alert('End Game?', 'Are you sure you want to end?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Game', style: 'destructive', onPress: () => {
          // Commit current card to history before ending
          const currentCard = cards[currentCardIdx];
          const haveIndices = Array.from(haveSet);
          setPlayers((prev) => prev.map((p, i) => ({
            ...p,
            haveCount: p.haveCount + (haveSet.has(i) ? 1 : 0),
          })));
          setHistory((prev) => [...prev, { card: currentCard, haveIndices }]);
          setPhase('stats');
        },
      },
    ]);
  }

  function playAgain() {
    setPhase('setup');
    setPlayerNames(players.map((p) => p.name));
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const cardOpacity = cardFlipAnim;
  const cardTranslateY = cardFlipAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  // ─── PHASE: Setup ───────────────────────────────────────────────────────────

  if (phase === 'setup') {
    const row1 = SPICE_OPTIONS.slice(0, 3);
    const row2 = SPICE_OPTIONS.slice(3);

    return (
      <View style={styles.root}>
        <LinearGradient
          colors={isDark ? ['#0D0D1A', '#0A0A1F', '#0D0D1A'] : [C.background, C.surface]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <StatusBar barStyle="light-content" />
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={styles.setupScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.setupHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={22} color={C.text} />
                </TouchableOpacity>
                <View style={styles.setupTitleBlock}>
                  <Text style={styles.setupEmoji}>🙈</Text>
                  <Text style={styles.setupTitle}>Never Have I Ever</Text>
                  <Text style={styles.setupSubtitle}>Who's done the most? Find out.</Text>
                </View>
              </View>

              {/* Players */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PLAYERS ({playerNames.length}/{MAX_PLAYERS})</Text>
                {playerNames.map((name, i) => (
                  <View key={i} style={styles.playerRow}>
                    <View style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }]} />
                    <TextInput
                      style={[styles.playerInput, { color: C.text, borderColor: C.border }]}
                      placeholder={`Player ${i + 1} name`}
                      placeholderTextColor={C.textSecondary}
                      value={name}
                      onChangeText={(v) => updatePlayerName(i, v)}
                      maxLength={20}
                      returnKeyType="done"
                    />
                    {playerNames.length > MIN_PLAYERS && (
                      <TouchableOpacity onPress={() => removePlayer(i)} style={styles.removeBtn}>
                        <Ionicons name="close-circle" size={20} color={C.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {playerNames.length < MAX_PLAYERS && (
                  <TouchableOpacity onPress={addPlayer} style={[styles.addPlayerBtn, { borderColor: C.primary + '60' }]}>
                    <Ionicons name="add" size={18} color={C.primary} />
                    <Text style={[styles.addPlayerText, { color: C.primary }]}>Add Player</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Spice Level */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SPICE LEVEL</Text>
                <View style={styles.spiceRow}>
                  {row1.map((opt) => {
                    const selected = spiceLevel === opt.level;
                    return (
                      <TouchableOpacity
                        key={opt.level}
                        onPress={() => handleSpiceSelect(opt)}
                        activeOpacity={0.8}
                        style={[
                          styles.spicePill,
                          selected && { backgroundColor: opt.color + 'CC', borderColor: opt.color },
                          !selected && { borderColor: opt.color + '40' },
                        ]}
                      >
                        <Text style={styles.spicePillEmoji}>{opt.emoji}</Text>
                        <Text style={[styles.spicePillLabel, selected && { color: '#fff' }, !selected && { color: C.text }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.spicePillDesc, selected && { color: 'rgba(255,255,255,0.8)' }, !selected && { color: C.textSecondary }]}>
                          {opt.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={[styles.spiceRow, { marginTop: spacing.sm }]}>
                  {row2.map((opt) => {
                    const selected = spiceLevel === opt.level;
                    return (
                      <TouchableOpacity
                        key={opt.level}
                        onPress={() => handleSpiceSelect(opt)}
                        activeOpacity={0.8}
                        style={[
                          styles.spicePillWide,
                          selected && { backgroundColor: opt.color + 'CC', borderColor: opt.color },
                          !selected && { borderColor: opt.color + '40' },
                        ]}
                      >
                        <View style={styles.spicePillWideInner}>
                          <Text style={styles.spicePillEmoji}>{opt.emoji}</Text>
                          <View>
                            <Text style={[styles.spicePillLabel, selected && { color: '#fff' }, !selected && { color: C.text }]}>
                              {opt.label}
                            </Text>
                            <Text style={[styles.spicePillDesc, selected && { color: 'rgba(255,255,255,0.8)' }, !selected && { color: C.textSecondary }]}>
                              {opt.description}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.ageBadge, selected && { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: '#fff' }]}>
                          <Text style={[styles.ageBadgeText, selected && { color: '#fff' }]}>18+</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Start Button */}
              <TouchableOpacity
                onPress={startGame}
                disabled={!canStart}
                activeOpacity={0.85}
                style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: canStart ? 1 : 0.45 }}
              >
                <LinearGradient
                  colors={[spiceConfig.color, spiceConfig.neonColor]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.startBtn}
                >
                  <Text style={styles.startBtnText}>{spiceConfig.emoji}  Start Game</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ─── PHASE: Playing ─────────────────────────────────────────────────────────

  if (phase === 'playing') {
    const currentCard = cards[currentCardIdx];
    const totalCards = cards.length;
    const progress = (currentCardIdx + 1) / totalCards;

    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#0D0D1A', '#1A0A2E', '#0D0D1A']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <StatusBar barStyle="light-content" />

          {/* Top Bar */}
          <View style={styles.playTopBar}>
            <TouchableOpacity onPress={endGame} style={styles.endBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            {/* Progress */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: spiceConfig.neonColor }]}
                />
              </View>
              <Text style={styles.progressText}>{currentCardIdx + 1} / {totalCards}</Text>
            </View>

            <View style={[styles.spiceBadge, { backgroundColor: spiceConfig.color + '30', borderColor: spiceConfig.color + '60' }]}>
              <Text style={styles.spiceBadgeEmoji}>{spiceConfig.emoji}</Text>
              <Text style={[styles.spiceBadgeLabel, { color: spiceConfig.neonColor }]}>{spiceConfig.label}</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.playScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Card */}
            <Animated.View
              style={[
                styles.cardOuter,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }, { scale: cardScaleAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={[spiceConfig.color + '30', '#1A1A2E', '#0D0D1A']}
                style={styles.card}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {/* Neon accent top bar */}
                <View style={[styles.cardAccentBar, { backgroundColor: spiceConfig.neonColor }]} />

                {/* Spice dots */}
                <View style={styles.spiceDotsRow}>
                  {SPICE_OPTIONS.map((opt, i) => (
                    <View
                      key={opt.level}
                      style={[
                        styles.spiceDot,
                        i <= SPICE_OPTIONS.findIndex((s) => s.level === spiceLevel)
                          ? { backgroundColor: spiceConfig.neonColor }
                          : { backgroundColor: 'rgba(255,255,255,0.15)' },
                      ]}
                    />
                  ))}
                </View>

                {/* Card text */}
                <Text style={styles.cardText}>{currentCard}</Text>

                {/* Decorative emoji */}
                <Text style={styles.cardDecoEmoji}>🙈</Text>
              </LinearGradient>
            </Animated.View>

            {/* Who said "I HAVE" */}
            <Text style={styles.sectionTitle}>Tap who's done it:</Text>
            <View style={styles.playerChipGrid}>
              {players.map((player, idx) => {
                const done = haveSet.has(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => toggleHave(idx)}
                    activeOpacity={0.8}
                    style={[
                      styles.playerChip,
                      done
                        ? { backgroundColor: player.color, borderColor: player.color }
                        : { backgroundColor: player.color + '15', borderColor: player.color + '40' },
                    ]}
                  >
                    <Text style={[styles.playerChipText, done && { color: '#fff' }]}>
                      {done ? '✓ ' : ''}{player.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* I HAVE count */}
            {haveSet.size > 0 && (
              <View style={[styles.haveCountBanner, { backgroundColor: spiceConfig.color + '20', borderColor: spiceConfig.color + '40' }]}>
                <Text style={[styles.haveCountText, { color: spiceConfig.neonColor }]}>
                  {haveSet.size} {haveSet.size === 1 ? 'person has' : 'people have'} done it! 👀
                </Text>
              </View>
            )}

            {/* Next Button */}
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.85}
              style={{ borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.lg }}
            >
              <LinearGradient
                colors={[spiceConfig.color, spiceConfig.neonColor]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.nextBtn}
              >
                <Text style={styles.nextBtnText}>
                  {currentCardIdx < cards.length - 1 ? 'Next Card →' : 'See Stats →'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ─── PHASE: Stats ────────────────────────────────────────────────────────────

  const sortedPlayers = [...players].sort((a, b) => b.haveCount - a.haveCount);
  const mostExperienced = sortedPlayers[0];
  const leastExperienced = sortedPlayers[sortedPlayers.length - 1];
  const totalCards = history.length;
  const totalHaves = history.reduce((sum, h) => sum + h.haveIndices.length, 0);

  // The card where the most people said "I HAVE"
  const wildestCard = history.reduce<{ card: string; count: number }>(
    (best, h) => h.haveIndices.length > best.count ? { card: h.card, count: h.haveIndices.length } : best,
    { card: '', count: 0 },
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D0D1A', '#1A0A2E', '#0D0D1A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.statsScroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Text style={styles.statsTitle}>Game Over! 🙈</Text>
          <Text style={styles.statsSubtitle}>Here's who's been up to what</Text>

          {/* Spice badge */}
          <View style={[styles.statsSpiceBadge, { backgroundColor: spiceConfig.color + '20', borderColor: spiceConfig.color + '40' }]}>
            <Text style={styles.statsSpiceEmoji}>{spiceConfig.emoji}</Text>
            <Text style={[styles.statsSpiceLabel, { color: spiceConfig.neonColor }]}>{spiceConfig.label} Mode</Text>
          </View>

          {/* Summary row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderTopColor: spiceConfig.neonColor }]}>
              <Text style={styles.statEmoji}>🃏</Text>
              <Text style={[styles.statValue, { color: spiceConfig.neonColor }]}>{totalCards}</Text>
              <Text style={styles.statLabel}>Cards Played</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#FF4B6E' }]}>
              <Text style={styles.statEmoji}>🙋</Text>
              <Text style={[styles.statValue, { color: '#FF4B6E' }]}>{totalHaves}</Text>
              <Text style={styles.statLabel}>Total "I Have"s</Text>
            </View>
            <View style={[styles.statCard, { borderTopColor: '#FDCB6E' }]}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={[styles.statValue, { color: '#FDCB6E' }]}>{players.length}</Text>
              <Text style={styles.statLabel}>Players</Text>
            </View>
          </View>

          {/* Leaderboard */}
          <View style={styles.leaderCard}>
            <Text style={styles.leaderTitle}>🏆 Most Experienced</Text>
            {sortedPlayers.map((player, i) => (
              <View key={i} style={[styles.leaderRow, i === 0 && { backgroundColor: player.color + '15' }]}>
                <Text style={styles.leaderRank}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </Text>
                <View style={[styles.leaderDot, { backgroundColor: player.color }]} />
                <Text style={styles.leaderName}>{player.name}</Text>
                <Text style={[styles.leaderCount, { color: player.color }]}>
                  {player.haveCount} "I Have"s
                </Text>
              </View>
            ))}
          </View>

          {/* Highlights */}
          <View style={styles.highlightsCard}>
            <Text style={styles.highlightsTitle}>✨ Highlights</Text>

            {mostExperienced && (
              <View style={styles.highlightRow}>
                <View style={styles.highlightLeft}>
                  <Text style={styles.highlightIcon}>🌶️</Text>
                  <Text style={styles.highlightLabel}>Most Experienced</Text>
                </View>
                <Text style={[styles.highlightValue, { color: mostExperienced.color }]}>
                  {mostExperienced.name} ({mostExperienced.haveCount})
                </Text>
              </View>
            )}

            {leastExperienced && leastExperienced.name !== mostExperienced?.name && (
              <View style={styles.highlightRow}>
                <View style={styles.highlightLeft}>
                  <Text style={styles.highlightIcon}>😇</Text>
                  <Text style={styles.highlightLabel}>Most Innocent</Text>
                </View>
                <Text style={[styles.highlightValue, { color: leastExperienced.color }]}>
                  {leastExperienced.name} ({leastExperienced.haveCount})
                </Text>
              </View>
            )}

            {wildestCard.card.length > 0 && (
              <View style={[styles.highlightRow, { borderBottomWidth: 0 }]}>
                <View style={styles.highlightLeft}>
                  <Text style={styles.highlightIcon}>🔥</Text>
                  <Text style={styles.highlightLabel}>Wildest Card</Text>
                </View>
                <Text style={[styles.highlightValue, { color: spiceConfig.neonColor, maxWidth: 180 }]} numberOfLines={2}>
                  {wildestCard.card.replace('Never have I ever ', '')}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <TouchableOpacity
            onPress={playAgain}
            activeOpacity={0.85}
            style={{ borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md }}
          >
            <LinearGradient
              colors={[spiceConfig.color, spiceConfig.neonColor]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.playAgainBtn}
            >
              <Text style={styles.playAgainText}>🔄  Play Again</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={styles.backBtn2}>
            <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backBtnText2}>Back to Games</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, isDark: boolean) {
  const dark = '#0D0D1A';
  const cardBg = isDark ? '#151528' : C.surface;
  const textPrimary = isDark ? '#F0F0FF' : C.text;
  const textSecondary = isDark ? 'rgba(240,240,255,0.6)' : C.textSecondary;
  const border = isDark ? 'rgba(255,255,255,0.1)' : C.border;

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: dark },
    flex: { flex: 1 },

    // ── Setup ────────────────────────────────────────────────────────────────
    setupScroll: { padding: spacing.lg, paddingBottom: 100 },
    setupHeader: { alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.sm },
    backBtn: { position: 'absolute', left: 0, top: 0, padding: spacing.xs },
    setupEmoji: { fontSize: 52, marginBottom: spacing.sm },
    setupTitleBlock: { alignItems: 'center' },
    setupTitle: { fontSize: 26, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 },
    setupSubtitle: { ...typography.body, color: textSecondary, marginTop: 4 },

    section: { marginBottom: spacing.xl },
    sectionLabel: { ...typography.small, fontWeight: '800', color: textSecondary, letterSpacing: 1.5, marginBottom: spacing.md },

    playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    playerDot: { width: 12, height: 12, borderRadius: 6 },
    playerInput: {
      flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : C.surface,
      borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm, ...typography.body, fontWeight: '600',
    },
    removeBtn: { padding: 4 },
    addPlayerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      alignSelf: 'flex-start',
    },
    addPlayerText: { ...typography.body, fontWeight: '700' },

    spiceRow: { flexDirection: 'row', gap: spacing.sm },
    spicePill: {
      flex: 1, borderWidth: 1.5, borderRadius: radius.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
      alignItems: 'center', gap: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : C.surface,
    },
    spicePillWide: {
      flex: 1, borderWidth: 1.5, borderRadius: radius.md,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : C.surface,
    },
    spicePillWideInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    spicePillEmoji: { fontSize: 20 },
    spicePillLabel: { fontSize: 13, fontWeight: '800' },
    spicePillDesc: { fontSize: 10, fontWeight: '500', marginTop: 1 },
    ageBadge: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)',
    },
    ageBadgeText: { fontSize: 10, fontWeight: '800', color: textSecondary },

    startBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: radius.lg,
    },
    startBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

    // ── Playing ──────────────────────────────────────────────────────────────
    playTopBar: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    endBtn: { padding: spacing.xs, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)' },
    progressWrap: { flex: 1, gap: 4 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    progressText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
    spiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
    spiceBadgeEmoji: { fontSize: 13 },
    spiceBadgeLabel: { fontSize: 11, fontWeight: '800' },

    playScroll: { padding: spacing.lg, paddingBottom: 80 },

    cardOuter: { marginBottom: spacing.xl },
    card: {
      borderRadius: radius.xl, overflow: 'hidden', minHeight: 220,
      padding: spacing.xl, paddingTop: spacing.lg,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center', justifyContent: 'center',
      ...shadows.card,
    },
    cardAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    spiceDotsRow: { flexDirection: 'row', gap: 5, marginBottom: spacing.lg },
    spiceDot: { width: 8, height: 8, borderRadius: 4 },
    cardText: {
      fontSize: SCREEN_W < 380 ? 20 : 22, fontWeight: '800', color: '#F0F0FF',
      textAlign: 'center', lineHeight: 32, letterSpacing: -0.2,
    },
    cardDecoEmoji: { fontSize: 36, marginTop: spacing.lg, opacity: 0.5 },

    sectionTitle: { ...typography.body, fontWeight: '800', color: textSecondary, marginBottom: spacing.md },

    playerChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    playerChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1.5,
    },
    playerChipText: { fontSize: 13, fontWeight: '700', color: textPrimary },

    haveCountBanner: {
      padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
      alignItems: 'center', marginBottom: spacing.sm,
    },
    haveCountText: { fontSize: 15, fontWeight: '800' },

    nextBtn: { paddingVertical: spacing.md + 2, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
    nextBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },

    // ── Stats ─────────────────────────────────────────────────────────────────
    statsScroll: { padding: spacing.lg, paddingBottom: 100, alignItems: 'center' },
    statsTitle: { fontSize: 28, fontWeight: '800', color: textPrimary, marginBottom: 4, textAlign: 'center' },
    statsSubtitle: { ...typography.body, color: textSecondary, textAlign: 'center', marginBottom: spacing.lg },
    statsSpiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, marginBottom: spacing.lg },
    statsSpiceEmoji: { fontSize: 16 },
    statsSpiceLabel: { fontSize: 13, fontWeight: '800' },

    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    statCard: {
      flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : C.surface,
      borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: 2,
      borderTopWidth: 3, ...shadows.card,
    },
    statEmoji: { fontSize: 20 },
    statValue: { fontSize: 24, fontWeight: '800' },
    statLabel: { fontSize: 10, fontWeight: '700', color: textSecondary, textAlign: 'center' },

    leaderCard: {
      width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : C.surface,
      borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: border,
    },
    leaderTitle: { fontSize: 16, fontWeight: '800', color: textPrimary, marginBottom: spacing.md },
    leaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingVertical: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.xs,
    },
    leaderRank: { fontSize: 18, width: 32, textAlign: 'center' },
    leaderDot: { width: 10, height: 10, borderRadius: 5 },
    leaderName: { flex: 1, fontSize: 15, fontWeight: '700', color: textPrimary },
    leaderCount: { fontSize: 13, fontWeight: '800' },

    highlightsCard: {
      width: '100%', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : C.surface,
      borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: border,
    },
    highlightsTitle: { fontSize: 16, fontWeight: '800', color: textPrimary, marginBottom: spacing.md },
    highlightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: border },
    highlightLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    highlightIcon: { fontSize: 16 },
    highlightLabel: { ...typography.small, color: textSecondary, fontWeight: '600' },
    highlightValue: { fontSize: 13, fontWeight: '800', textAlign: 'right', flex: 1, marginLeft: spacing.sm },

    playAgainBtn: { paddingVertical: spacing.md + 2, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
    playAgainText: { fontSize: 17, fontWeight: '800', color: '#fff' },
    backBtn2: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.md },
    backBtnText2: { ...typography.body, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  });
}
