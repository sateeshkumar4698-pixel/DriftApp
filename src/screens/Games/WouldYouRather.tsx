/**
 * Would You Rather — 2-player real-time social game
 *
 * Psychology: Forces binary decisions that reveal personality and values.
 * Both players answer simultaneously (answers hidden until both submit),
 * then the reveal shows agreement/disagreement — sparking conversations.
 *
 * RTDB structure:
 *   gameRooms/{roomId}/wyr/
 *     phase: 'waiting' | 'answering' | 'revealed' | 'gameover'
 *     questionIdx: number          // index into WYR_QUESTIONS
 *     answers: { [uid]: 'A'|'B' }  // hidden until phase===revealed
 *     score:   { [uid]: number }
 *     round:   number              // 1-based
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ref as rtdbRef,
  set as rtdbSet,
  update as rtdbUpdate,
  onValue,
  get,
} from 'firebase/database';
import { getDoc, doc } from 'firebase/firestore';
import { rtdb, db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { GamesStackParamList } from '../../types';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import GameChatVoice from '../../components/GameChatVoice';

type Nav   = NativeStackNavigationProp<GamesStackParamList, 'WouldYouRather'>;
type Route = RouteProp<GamesStackParamList, 'WouldYouRather'>;

// ─── Questions ────────────────────────────────────────────────────────────────

const TOTAL_ROUNDS = 10;

interface WYRQuestion {
  a: string;
  b: string;
  category: 'lifestyle' | 'social' | 'power' | 'adventure' | 'deep';
}

const WYR_QUESTIONS: WYRQuestion[] = [
  // Lifestyle
  { a: 'Always be 10 minutes late', b: 'Always be 20 minutes early', category: 'lifestyle' },
  { a: 'Only eat sweet food forever', b: 'Only eat savoury food forever', category: 'lifestyle' },
  { a: 'Live in a city with no nature', b: 'Live in nature with no city', category: 'lifestyle' },
  { a: 'Sleep 4 hrs but feel fully rested', b: 'Sleep 10 hrs every night', category: 'lifestyle' },
  { a: 'Never use social media again', b: 'Never watch movies/shows again', category: 'lifestyle' },
  { a: 'Work from home forever', b: 'Work in an office forever', category: 'lifestyle' },
  { a: 'Only eat your favourite food', b: 'Never eat your favourite food again', category: 'lifestyle' },
  { a: 'Be a morning person', b: 'Be a night owl', category: 'lifestyle' },
  // Social
  { a: 'Be famous but hated', b: 'Be unknown but loved', category: 'social' },
  { a: 'Have 100 acquaintances', b: 'Have 3 true best friends', category: 'social' },
  { a: 'Always speak your mind', b: 'Always know what others are thinking', category: 'social' },
  { a: 'Relive your best day forever', b: 'Live a new adventure every day', category: 'social' },
  { a: 'Never lie again', b: 'Never hear the truth again', category: 'social' },
  { a: 'Be the funniest person in the room', b: 'Be the smartest person in the room', category: 'social' },
  // Power
  { a: 'Have unlimited money but no time', b: 'Have unlimited time but little money', category: 'power' },
  { a: 'Be able to fly', b: 'Be able to read minds', category: 'power' },
  { a: 'Pause time for 10 seconds anytime', b: 'Rewind time by 30 seconds once a day', category: 'power' },
  { a: 'Always win arguments', b: 'Always know when someone is lying', category: 'power' },
  { a: 'Never need to sleep', b: 'Never need to eat', category: 'power' },
  // Adventure
  { a: 'Travel the world but never stay anywhere more than 2 weeks', b: 'Never travel but have a perfect life at home', category: 'adventure' },
  { a: 'Skydive from 10,000 ft', b: 'Deep sea dive to 100m', category: 'adventure' },
  { a: 'Live in the past (1990s)', b: 'Live in the future (2080s)', category: 'adventure' },
  // Deep
  { a: 'Know when you will die', b: 'Know how you will die', category: 'deep' },
  { a: 'Have no enemies', b: 'Have no regrets', category: 'deep' },
  { a: 'Be remembered after death', b: 'Live forever but be forgotten', category: 'deep' },
  { a: 'Always know the right answer', b: 'Always ask the right question', category: 'deep' },
  { a: 'Change the past', b: 'See the future', category: 'deep' },
  { a: 'Have a photographic memory', b: 'Have unlimited creativity', category: 'deep' },
  { a: 'Find true love but lose it', b: 'Never find true love but be content', category: 'deep' },
  { a: 'Be famous for 5 years', b: 'Be secretly influential forever', category: 'deep' },
];

const CATEGORY_COLOR: Record<WYRQuestion['category'], string> = {
  lifestyle: '#00B894',
  social:    '#6C5CE7',
  power:     '#FDCB6E',
  adventure: '#FF4B6E',
  deep:      '#2D3436',
};

const CATEGORY_EMOJI: Record<WYRQuestion['category'], string> = {
  lifestyle: '🌿',
  social:    '👥',
  power:     '⚡',
  adventure: '🚀',
  deep:      '🌊',
};

// ─── RTDB state types ─────────────────────────────────────────────────────────

type WYRPhase = 'waiting' | 'answering' | 'revealed' | 'gameover';

interface WYRState {
  phase:       WYRPhase;
  questionIdx: number;
  round:       number;
  answers:     Record<string, 'A' | 'B'>;
  score:       Record<string, number>;
}

const DEFAULT_STATE: WYRState = {
  phase:       'waiting',
  questionIdx: 0,
  round:       1,
  answers:     {},
  score:       {},
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WouldYouRather() {
  const { C, isDark } = useTheme();
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const { firebaseUser, userProfile } = useAuthStore();

  const roomId     = route.params?.roomId;
  const myUid      = firebaseUser?.uid ?? '';
  const myName     = userProfile?.name ?? 'You';

  const [gs, setGs]               = useState<WYRState>(DEFAULT_STATE);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentUid, setOpponentUid]   = useState('');
  const [myChoice, setMyChoice]         = useState<'A' | 'B' | null>(null);

  // Reveal animation
  const revealAnim = useRef(new Animated.Value(0)).current;
  const flipAnim   = useRef(new Animated.Value(0)).current;

  const isHost = useRef(false);

  // ─── Load opponent info ──────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;
    getDoc(doc(db, 'gameRooms', roomId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      isHost.current = data.hostUid === myUid;
      const players: string[] = data.players ?? [];
      const oppUid = players.find((u) => u !== myUid) ?? '';
      setOpponentUid(oppUid);
      if (oppUid) {
        getDoc(doc(db, 'users', oppUid)).then((u) => {
          if (u.exists()) setOpponentName(u.data().name ?? 'Opponent');
        });
      }

      // Host initialises the WYR state with shuffled questions
      if (data.hostUid === myUid) {
        const shuffled = [...WYR_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
        const questionIdxes = shuffled.map((_, i) => i);
        // Store shuffled order in RTDB
        rtdbSet(rtdbRef(rtdb, `gameRooms/${roomId}/wyr`), {
          ...DEFAULT_STATE,
          phase: 'answering',
          questionIdxes,
          questionIdx: questionIdxes[0],
        });
      }
    });
  }, [roomId, myUid]);

  // ─── Subscribe to RTDB ──────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;
    const wyrRef = rtdbRef(rtdb, `gameRooms/${roomId}/wyr`);
    const unsub  = onValue(wyrRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      setGs((prev) => ({ ...DEFAULT_STATE, ...data }));

      // Trigger reveal animation when phase changes to 'revealed'
      if (data.phase === 'revealed') {
        Animated.spring(revealAnim, {
          toValue: 1, useNativeDriver: true, tension: 60, friction: 8,
        }).start();
      } else {
        revealAnim.setValue(0);
      }
    });
    return () => unsub();
  }, [roomId]);

  // ─── Reset my choice when round changes ─────────────────────────────────

  useEffect(() => {
    setMyChoice(null);
    flipAnim.setValue(0);
  }, [gs.round, gs.questionIdx]);

  // ─── Choose answer ────────────────────────────────────────────────────

  const choose = useCallback(async (choice: 'A' | 'B') => {
    if (!roomId || gs.phase !== 'answering' || myChoice !== null) return;
    setMyChoice(choice);

    // Animate flip
    Animated.timing(flipAnim, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start();

    // Write to RTDB
    await rtdbUpdate(rtdbRef(rtdb, `gameRooms/${roomId}/wyr/answers`), {
      [myUid]: choice,
    });

    // Check if both answered — host reveals
    const wyrSnap = await get(rtdbRef(rtdb, `gameRooms/${roomId}/wyr`));
    const wyr = wyrSnap.val();
    if (!wyr) return;

    const answers: Record<string, 'A' | 'B'> = { ...wyr.answers, [myUid]: choice };
    const allPlayers = [myUid, opponentUid].filter(Boolean);
    const allAnswered = allPlayers.every((uid) => answers[uid]);

    if (allAnswered && isHost.current) {
      // Calculate if both matched
      const vals = Object.values(answers);
      const matched = vals.every((v) => v === vals[0]);

      // Update scores (1 point each if matched, else 0 for this round)
      const prevScore: Record<string, number> = wyr.score ?? {};
      const newScore = { ...prevScore };
      if (matched) {
        allPlayers.forEach((uid) => { newScore[uid] = (newScore[uid] ?? 0) + 1; });
      }

      const isLast = wyr.round >= TOTAL_ROUNDS;
      await rtdbUpdate(rtdbRef(rtdb, `gameRooms/${roomId}/wyr`), {
        phase:   isLast ? 'gameover' : 'revealed',
        score:   newScore,
        answers,
      });
    }
  }, [roomId, gs.phase, myChoice, myUid, opponentUid]);

  // ─── Next question (host only) ────────────────────────────────────────

  const nextQuestion = useCallback(async () => {
    if (!roomId || !isHost.current) return;
    const wyrSnap = await get(rtdbRef(rtdb, `gameRooms/${roomId}/wyr`));
    const wyr = wyrSnap.val();
    if (!wyr) return;

    const nextRound   = (wyr.round ?? 1) + 1;
    const nextIdxList: number[] = wyr.questionIdxes ?? [];
    const nextIdx     = nextIdxList[(nextRound - 1) % nextIdxList.length] ?? 0;

    await rtdbUpdate(rtdbRef(rtdb, `gameRooms/${roomId}/wyr`), {
      phase:       'answering',
      round:       nextRound,
      questionIdx: nextIdx,
      answers:     {},
    });
  }, [roomId]);

  // ─── Derived ─────────────────────────────────────────────────────────

  const currentQ  = WYR_QUESTIONS[gs.questionIdx] ?? WYR_QUESTIONS[0];
  const myScore   = gs.score?.[myUid] ?? 0;
  const oppScore  = gs.score?.[opponentUid] ?? 0;
  const catColor  = CATEGORY_COLOR[currentQ.category];
  const catEmoji  = CATEGORY_EMOJI[currentQ.category];
  const opponentChoice = gs.answers?.[opponentUid] ?? null;
  const bothAnswered   = myChoice !== null && opponentChoice !== null;
  const matched = bothAnswered && gs.phase === 'revealed' && gs.answers?.[myUid] === gs.answers?.[opponentUid];

  // Reveal scale animation
  const revealScale = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const revealOpacity = revealAnim;

  // ─── Gameover screen ─────────────────────────────────────────────────

  if (gs.phase === 'gameover') {
    const myFinal  = gs.score?.[myUid] ?? 0;
    const oppFinal = gs.score?.[opponentUid] ?? 0;
    const compatibility = Math.round((myFinal / TOTAL_ROUNDS) * 100);
    const won  = myFinal > oppFinal;
    const draw = myFinal === oppFinal;

    return (
      <SafeAreaView style={[gos.root, { backgroundColor: C.background }]}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={[catColor + 'CC', C.background]} style={gos.bgGrad} />

        <ScrollView contentContainerStyle={gos.content} showsVerticalScrollIndicator={false}>
          <Text style={gos.title}>Game Over! 🎉</Text>

          {/* Compatibility meter */}
          <View style={[gos.compatCard, { backgroundColor: C.surface }]}>
            <Text style={[gos.compatLabel, { color: C.textSecondary }]}>Compatibility</Text>
            <Text style={[gos.compatPct, { color: catColor }]}>{compatibility}%</Text>
            <View style={[gos.compatBarBg, { backgroundColor: C.border }]}>
              <View style={[gos.compatBarFill, { width: `${compatibility}%`, backgroundColor: catColor }]} />
            </View>
            <Text style={[gos.compatDesc, { color: C.textSecondary }]}>
              {compatibility >= 80
                ? '🔥 You two think alike! Great match.'
                : compatibility >= 60
                ? '✨ Pretty compatible — lots in common.'
                : compatibility >= 40
                ? '🌊 Different perspectives — interesting combo.'
                : '⚡ Opposites attract! Great conversations ahead.'}
            </Text>
          </View>

          {/* Scores */}
          <View style={gos.scoreRow}>
            <View style={[gos.scoreCard, { backgroundColor: C.surface }]}>
              <Text style={[gos.scoreName, { color: C.textSecondary }]} numberOfLines={1}>{myName.split(' ')[0]}</Text>
              <Text style={[gos.scoreNum, { color: C.primary }]}>{myFinal}</Text>
              <Text style={[gos.scoreLabel, { color: C.textTertiary }]}>matches</Text>
            </View>
            <Text style={[gos.vs, { color: C.textSecondary }]}>vs</Text>
            <View style={[gos.scoreCard, { backgroundColor: C.surface }]}>
              <Text style={[gos.scoreName, { color: C.textSecondary }]} numberOfLines={1}>{opponentName.split(' ')[0]}</Text>
              <Text style={[gos.scoreNum, { color: C.secondary }]}>{oppFinal}</Text>
              <Text style={[gos.scoreLabel, { color: C.textTertiary }]}>matches</Text>
            </View>
          </View>

          {/* Result message */}
          <Text style={[gos.resultMsg, { color: C.text }]}>
            {draw ? "It's a draw! You're perfectly balanced." : won ? `${myName.split(' ')[0]} wins! 🏆` : `${opponentName.split(' ')[0]} wins! 🏆`}
          </Text>

          <TouchableOpacity
            style={[gos.btn, { backgroundColor: C.primary }]}
            onPress={() => nav.goBack()}
          >
            <Text style={gos.btnTxt}>Back to Games</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Main game screen ────────────────────────────────────────────────

  return (
    <SafeAreaView style={[st.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[st.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={[st.headerTitle, { color: C.text }]}>Would You Rather</Text>
          <Text style={[st.headerSub, { color: C.textSecondary }]}>Round {gs.round}/{TOTAL_ROUNDS}</Text>
        </View>
        {/* Score chips */}
        <View style={st.scoreChips}>
          <View style={[st.chip, { backgroundColor: C.primary + '20' }]}>
            <Text style={[st.chipTxt, { color: C.primary }]}>{myScore}</Text>
          </View>
          <Text style={[st.chipVs, { color: C.textTertiary }]}>-</Text>
          <View style={[st.chip, { backgroundColor: C.secondary + '20' }]}>
            <Text style={[st.chipTxt, { color: C.secondary }]}>{oppScore}</Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[st.progressBg, { backgroundColor: C.border }]}>
        <View style={[st.progressFill, { width: `${((gs.round - 1) / TOTAL_ROUNDS) * 100}%`, backgroundColor: catColor }]} />
      </View>

      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>

        {/* Category tag */}
        <View style={[st.catTag, { backgroundColor: catColor + '20' }]}>
          <Text style={st.catEmoji}>{catEmoji}</Text>
          <Text style={[st.catLabel, { color: catColor }]}>{currentQ.category.charAt(0).toUpperCase() + currentQ.category.slice(1)}</Text>
        </View>

        {/* Question */}
        <Text style={[st.question, { color: C.text }]}>Would you rather…</Text>

        {/* Option A */}
        <TouchableOpacity
          onPress={() => choose('A')}
          activeOpacity={0.85}
          disabled={myChoice !== null || gs.phase !== 'answering'}
        >
          <LinearGradient
            colors={myChoice === 'A' ? [catColor, catColor + 'CC'] : ['transparent', 'transparent']}
            style={[
              st.optionCard,
              {
                borderColor: myChoice === 'A' ? catColor : C.border,
                backgroundColor: myChoice === null ? C.surface : 'transparent',
              },
            ]}
          >
            <Text style={[st.optionLetter, { color: myChoice === 'A' ? '#fff' : catColor }]}>A</Text>
            <Text style={[st.optionText, { color: myChoice === 'A' ? '#fff' : C.text }]}>
              {currentQ.a}
            </Text>
            {gs.phase === 'revealed' && gs.answers?.[myUid] === 'A' && (
              <Text style={st.myBadge}>You ✓</Text>
            )}
            {gs.phase === 'revealed' && gs.answers?.[opponentUid] === 'A' && (
              <Text style={st.oppBadge}>{opponentName.split(' ')[0]} ✓</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={st.orRow}>
          <View style={[st.orLine, { backgroundColor: C.border }]} />
          <View style={[st.orCircle, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[st.orText, { color: C.textSecondary }]}>OR</Text>
          </View>
          <View style={[st.orLine, { backgroundColor: C.border }]} />
        </View>

        {/* Option B */}
        <TouchableOpacity
          onPress={() => choose('B')}
          activeOpacity={0.85}
          disabled={myChoice !== null || gs.phase !== 'answering'}
        >
          <LinearGradient
            colors={myChoice === 'B' ? ['#6C5CE7', '#A29BFE'] : ['transparent', 'transparent']}
            style={[
              st.optionCard,
              {
                borderColor: myChoice === 'B' ? '#6C5CE7' : C.border,
                backgroundColor: myChoice === null ? C.surface : 'transparent',
              },
            ]}
          >
            <Text style={[st.optionLetter, { color: myChoice === 'B' ? '#fff' : '#6C5CE7' }]}>B</Text>
            <Text style={[st.optionText, { color: myChoice === 'B' ? '#fff' : C.text }]}>
              {currentQ.b}
            </Text>
            {gs.phase === 'revealed' && gs.answers?.[myUid] === 'B' && (
              <Text style={st.myBadge}>You ✓</Text>
            )}
            {gs.phase === 'revealed' && gs.answers?.[opponentUid] === 'B' && (
              <Text style={st.oppBadge}>{opponentName.split(' ')[0]} ✓</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Status area */}
        <View style={st.statusArea}>
          {gs.phase === 'answering' && myChoice === null && (
            <Text style={[st.statusTxt, { color: C.textSecondary }]}>
              👆 Tap your choice
            </Text>
          )}
          {gs.phase === 'answering' && myChoice !== null && (
            <Text style={[st.statusTxt, { color: C.textSecondary }]}>
              ⏳ Waiting for {opponentName.split(' ')[0]}…
            </Text>
          )}

          {gs.phase === 'revealed' && (
            <Animated.View style={[st.resultBanner, {
              backgroundColor: matched ? C.success + '20' : C.primary + '10',
              opacity: revealOpacity,
              transform: [{ scale: revealScale }],
            }]}>
              <Text style={[st.resultEmoji]}>{matched ? '🤝' : '⚡'}</Text>
              <Text style={[st.resultText, { color: matched ? C.success : C.text }]}>
                {matched ? "You both agree! +1 point each" : "Different choices — interesting!"}
              </Text>
              {isHost.current && (
                <TouchableOpacity
                  style={[st.nextBtn, { backgroundColor: catColor }]}
                  onPress={nextQuestion}
                  activeOpacity={0.85}
                >
                  <Text style={st.nextBtnTxt}>
                    {gs.round >= TOTAL_ROUNDS ? 'See Results 🏁' : 'Next Question →'}
                  </Text>
                </TouchableOpacity>
              )}
              {!isHost.current && (
                <Text style={[st.waitingNext, { color: C.textSecondary }]}>
                  Waiting for {opponentName.split(' ')[0]} to continue…
                </Text>
              )}
            </Animated.View>
          )}
        </View>

        {/* Answer indicators (shows waiting dots) */}
        {gs.phase === 'answering' && (
          <View style={st.indicatorRow}>
            <View style={[st.indicator, { borderColor: C.border }]}>
              <Text style={[st.indicatorName, { color: C.textSecondary }]} numberOfLines={1}>
                {myName.split(' ')[0]}
              </Text>
              <View style={[
                st.indicatorDot,
                { backgroundColor: myChoice ? C.success : C.border },
              ]} />
            </View>
            <View style={[st.indicator, { borderColor: C.border }]}>
              <Text style={[st.indicatorName, { color: C.textSecondary }]} numberOfLines={1}>
                {opponentName.split(' ')[0]}
              </Text>
              <View style={[
                st.indicatorDot,
                { backgroundColor: gs.answers?.[opponentUid] ? C.success : C.border },
              ]} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Voice chat */}
      {roomId && (
        <GameChatVoice roomId={roomId} myUid={myUid} myName={myName} accentColor="#00B894" />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.h3, letterSpacing: -0.3 },
  headerSub: { ...typography.small, marginTop: 1 },
  scoreChips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  chipVs: { fontSize: 11 },
  progressBg: { height: 3 },
  progressFill: { height: 3, borderRadius: 2 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 120 },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  question: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' },
  optionCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    gap: 8,
    minHeight: 100,
    justifyContent: 'center',
  },
  optionLetter: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  optionText:   { fontSize: 17, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2 },
  myBadge:  { fontSize: 11, fontWeight: '700', color: '#fff', opacity: 0.9, marginTop: 4 },
  oppBadge: { fontSize: 11, fontWeight: '700', color: '#fff', opacity: 0.9, marginTop: 2 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: 1 },
  orCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  orText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusArea: { alignItems: 'center', minHeight: 100 },
  statusTxt: { ...typography.body, marginTop: spacing.sm },
  resultBanner: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultEmoji: { fontSize: 36 },
  resultText:  { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  nextBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  nextBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  waitingNext: { fontSize: 13, fontStyle: 'italic', marginTop: spacing.xs },
  indicatorRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  indicator: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  indicatorName: { fontSize: 12, fontWeight: '600', maxWidth: 80 },
  indicatorDot: { width: 10, height: 10, borderRadius: 5 },
});

// Game-over styles
const gos = StyleSheet.create({
  root: { flex: 1 },
  bgGrad: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -1, color: '#0F0F23', textAlign: 'center', marginTop: spacing.xl },
  compatCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  compatLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  compatPct: { fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  compatBarBg: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
  compatBarFill: { height: 8, borderRadius: 4 },
  compatDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreCard: {
    flex: 1, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: 2, ...shadows.sm,
  },
  scoreName: { fontSize: 12, fontWeight: '600' },
  scoreNum: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  scoreLabel: { fontSize: 11 },
  vs: { fontSize: 14, fontWeight: '700' },
  resultMsg: { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  btn: { height: 54, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
