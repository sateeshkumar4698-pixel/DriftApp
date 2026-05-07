import React, { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { makeStyles, PLAYER_COLORS, MAX_PLAYERS, MIN_PLAYERS, MAX_SKIPS, SPINNER_SIZE, SPINNER_CENTER, RING_RADIUS, BUBBLE_R, NEEDLE_W, NEEDLE_H } from './TruthOrDare.styles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList } from '../../types';
import { spacing } from '../../utils/theme';
import { useTheme } from '../../utils/useTheme';
import { gameSounds } from '../../services/gameSounds';
import { useAuthStore } from '../../store/authStore';
import GameChatVoice from '../../components/GameChatVoice';
import { ref as rtdbRef, set as rtdbSet, update as rtdbUpdate, onValue } from 'firebase/database';
import { getDoc, doc } from 'firebase/firestore';
import { rtdb, db } from '../../config/firebase';
import { GameRoom } from '../../types';

// ─── Navigation ───────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<GamesStackParamList, 'TruthOrDare'>;

// ─── Domain Types ─────────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'playing' | 'gameover';
type SpiceLevel = 'mild' | 'spicy' | 'wild' | 'adult' | 'extreme';
type CardType = 'truth' | 'dare';

interface Player {
  uid?: string;
  name: string;
  color: string;
  truths: number;
  dares: number;
  skips: number;
}

interface CardState {
  type: CardType;
  text: string;
  visible: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Question / Dare Arrays ───────────────────────────────────────────────────

const TRUTH_MILD: string[] = [
  "What's your most embarrassing childhood memory?",
  'Have you ever lied to get out of a plan?',
  "What's a secret talent you have?",
  "What's your weirdest food habit?",
  'Have you ever pretended to like a gift you hated?',
  "What's the last thing you Googled?",
  "What's your biggest pet peeve?",
  'Have you ever walked into the wrong restroom?',
  "What's a movie you pretend to have seen but haven't?",
  "What's your most used emoji?",
  'Have you ever blamed someone else for something you did?',
  "What's your most ridiculous fear?",
  "What's the most embarrassing song on your playlist?",
  'Have you ever sent a text to the wrong person?',
  "What's something you've never told your parents?",
  "What's your biggest guilty pleasure?",
  'Have you ever fallen asleep in public?',
  "What's the worst haircut you've ever had?",
  "What's your most irrational belief?",
  'Have you ever eaten food off the floor?',
];

const TRUTH_SPICY: string[] = [
  'Who in this room would you go on a date with?',
  "What's the most romantic thing someone has done for you?",
  "Have you ever had a crush on a friend's partner?",
  "What's your biggest insecurity?",
  "What's the most daring thing you've done to impress someone?",
  "Have you ever been ghosted? How did it feel?",
  "What's a dealbreaker for you in a relationship?",
  "Have you ever liked someone who didn't know?",
  "What's the weirdest place you've ever been on a date?",
  'Have you ever lied about your age?',
  "What's something you find attractive that others might find weird?",
  'Have you ever sent someone a message and immediately regretted it?',
  "What's your most cringe-worthy romantic moment?",
  'Have you ever had feelings for two people at once?',
  "What's the most embarrassing thing that happened on a date?",
  "What's a relationship red flag you've ignored?",
  "Have you ever stalked an ex's social media?",
  "What's the boldest move you've ever made on someone?",
  'Have you ever been in a situationship?',
  "What's something you want but are afraid to ask for?",
];

const TRUTH_WILD: string[] = [
  "What's the wildest thing you've done that no one knows about?",
  "Have you ever done something illegal? (minor stuff counts)",
  "What's the most trouble you've ever gotten into?",
  "What's the biggest lie you've ever told?",
  'Have you ever faked sick to avoid something important?',
  "What's the most impulsive decision you've ever made?",
  "Have you ever broken someone's trust? What happened?",
  "What's your most controversial opinion?",
  "Have you ever done something embarrassing to impress someone?",
  "What's the pettiest thing you've ever done?",
  "Have you ever read someone's private messages without permission?",
  "What's a secret you've kept for years?",
  "What's the most rebellious thing you've done?",
  'Have you ever been caught in a major lie?',
  "What's the worst thing you've ever said about someone behind their back?",
  'Have you ever pretended to be someone else online?',
  "What's the most dramatic thing you've done during a fight?",
  "Have you ever done something you're genuinely ashamed of?",
  "What's a habit you have that you're embarrassed about?",
  "What's the most reckless decision you've made that turned out fine?",
];

// 🍑 Adult — intimate & personal (18+)
const TRUTH_ADULT: string[] = [
  'What physical feature do you find most attractive in a person?',
  "What's the most intimate thing you've done with someone you just met?",
  "Describe your ideal romantic night — don't hold back.",
  'Have you ever been attracted to someone in this room?',
  "What's the most forward thing someone has done to you that you secretly loved?",
  "What's your biggest turn-on that you've never admitted out loud?",
  'Have you ever kissed someone just to see what it felt like?',
  "What's something physical about yourself you're secretly proud of?",
  "Have you ever had a dream about someone in this room? Be honest.",
  "What's the most romantic thing you genuinely want someone to do to you?",
  "What's your wildest relationship fantasy?",
  'Have you ever flirted your way out of trouble? What happened?',
  "What's the most risqué place you've ever kissed someone?",
  'Have you ever fallen for someone you absolutely should not have?',
  "What's something you've always wanted to try with a partner but never have?",
  "Describe your perfect physical type — as specifically as possible.",
  "Have you ever sent or received a photo you later regretted?",
  "What's the most intimate secret you're keeping right now?",
  'How many people have you kissed, and who was most memorable?',
  "What's a bedroom rule you absolutely have?",
];

// 💀 Extreme — maximum no-filter (18+ only, close friends)
const TRUTH_EXTREME: string[] = [
  "What's the most explicit thing you've ever said to someone in a message?",
  "Describe the most physically intense experience you've had with someone.",
  "What's your biggest sexual fantasy that you've never told anyone?",
  'Rate everyone in this room from most to least physically attractive — out loud.',
  "What's the most scandalous thing you've done sober?",
  "Have you ever hooked up with someone from this friend group?",
  "What's the craziest place you've been intimate with someone?",
  'Have you ever faked something in a romantic context? What and why?',
  "What's the most explicit photo or video you've ever saved on your phone?",
  "Have you ever been attracted to someone of a gender you don't usually date?",
  "What's the most embarrassing thing that's happened to you during intimacy?",
  "If you had to date someone in this room, who would be first choice and why?",
  "What's the one thing you'd do if you knew there were zero consequences?",
  "What's the raunchiest text you've ever sent? Read it out loud if it's still there.",
  "Have you ever been involved with two people at the same time? What happened?",
  "What's the number on your body count — be honest.",
  "What's the most inappropriate crush you've ever had?",
  "Have you ever walked in on someone? What did you see?",
  "What's the boldest thing you've done to get someone's attention physically?",
  "What's a secret about your love life that would shock everyone here?",
];

const DARE_MILD: string[] = [
  'Do your best impression of someone in the group for 30 seconds',
  'Speak only in questions for the next 2 minutes',
  "Text your mom or dad 'I love you, you're my hero'",
  'Do 10 jumping jacks right now',
  'Speak in a British accent for the next 3 rounds',
  'Let someone in the group post anything they want on your story for 10 seconds',
  'Sing the chorus of your favorite song right now',
  'Do your best robot dance',
  "Call someone random from your contacts and say 'I need to tell you something important' then hang up",
  'Tell everyone your screen time from this week',
  'Do your best catwalk across the room',
  'Make a silly face and hold it for 20 seconds while everyone looks at you',
  'Let the group look through your camera roll for 15 seconds',
  'Talk like a news anchor for the next 2 minutes',
  'Draw a portrait of the person next to you in 60 seconds',
  'Try to lick your elbow for 10 seconds straight',
  'Do your best slow-motion action hero walk across the room',
  "Say 'woof' every time someone says your name for the next round",
  'Do a dramatic reading of the last text message you sent',
  'Hold a plank for 30 seconds — no cheating!',
];

const DARE_SPICY: string[] = [
  "Text your crush 'Hey, thinking of you 😊' right now",
  'Tell the group your honest first impression of the person to your left',
  'Show everyone the last 5 photos in your camera roll',
  "Call someone you haven't talked to in 6+ months and act like nothing changed",
  'Let the group go through your last 10 Instagram DMs',
  'Share the last voice note you recorded',
  "Post a photo on your story with the caption 'Living my best life' — photo chosen by the group",
  'Tell someone in the group one thing you genuinely admire about them (cannot be superficial)',
  'Serenade someone in the group with a love song of your choice',
  "Send a voice note to the last person you texted saying 'Miss you'",
  'Let the group change your profile photo for the next hour',
  "Confess something to the group that you've been too shy to say",
  "Text your ex 'Hey stranger 👋' (you can unsend after 30 seconds)",
  'Do your best flirty intro as if meeting someone for the first time',
  'Speak only in flirtatious tones for the next round',
  'Share your most recent search history — top 5 results',
  'Let the group pick a new nickname for you and use it all night',
  'Tell the person across from you what you really thought when you first met them',
  "Send a gif to your best friend with the caption 'This is us' — chosen by the group",
  'Do your most convincing impression of someone famous falling in love',
];

const DARE_WILD: string[] = [
  'Call a random contact and sing them Happy Birthday convincingly',
  'Post a crying selfie on your story with no caption',
  'Let the group write a tweet from your account and post it for 5 minutes',
  'Change your profile name to something the group decides for 30 minutes',
  'Do a freestyle rap about the person to your right — minimum 4 lines',
  "Send a voice note to someone you haven't talked to in a year saying 'I was just thinking about you...'",
  'Let someone in the group send ONE text from your phone to anyone they choose',
  'Post a 15-second video on your story doing something embarrassing',
  'Confess your most irrational fear in full dramatic detail',
  'Pretend to propose to the person to your left (full commitment, get on one knee)',
  "Call the last person who called you and tell them you 'have some news'",
  'Let the group roast you for 2 full minutes — you cannot defend yourself',
  'Do your most dramatic movie villain monologue',
  "Text your boss or teacher: 'Quick question — do you believe in ghosts?'",
  'Show the group your most embarrassing contact name in your phone',
  "Post a selfie with the caption 'Glowing up' — the group chooses the photo",
  'Do your best impression of each person in the group back-to-back',
  "Send a voice note to the group chat of people NOT here saying 'big announcement tomorrow'",
  "Let the group set your dating app bio for the next 24 hours",
  'Do a dramatic one-person re-enactment of your most embarrassing moment',
];

// 🍑 Adult Dares (18+ — intimate but tasteful)
const DARE_ADULT: string[] = [
  'Give a 30-second shoulder massage to the person of your choice',
  'Whisper something genuinely flirtatious into the ear of the person to your right',
  'Stare into the eyes of the person across from you without blinking for 30 seconds',
  'Do your most seductive walk across the room',
  'Demonstrate your best "bedroom eyes" and hold it for 10 seconds',
  'Give the person to your left a genuine, slow compliment about their appearance',
  'Sit on the lap of whoever you find most attractive in the group for 10 seconds',
  'Describe in detail what you find physically attractive about each person in the group',
  'Do a slow dance by yourself for 30 seconds as if someone is watching you',
  'Text someone outside the group "I keep thinking about you lately" — no context',
  'Let someone else apply lipstick or chapstick for you without a mirror',
  'Demonstrate what your "good morning" face looks like — really commit to it',
  'Do your best impression of someone seducing another person — pick anyone famous',
  'Let the group style your hair however they want for the rest of the game',
  'Describe your perfect kiss — where, how, with who (no names, just vibes)',
  'Feed the person next to you something to eat without using your hands',
  'Do a dramatic slow-motion wink at every person in the group, one by one',
  'Let someone hold your hand for the next full round without letting go',
  'Describe the most attractive person you have ever seen in vivid detail',
  'Do your most dramatic "falling in love at first sight" acting for 30 seconds',
];

// 💀 Extreme Dares (18+ — maximum boldness, close friends only)
const DARE_EXTREME: string[] = [
  'Kiss the back of the hand of whoever you find most attractive in the group',
  'Let someone write a message to your ex from your phone and send it — no preview',
  'Describe your last intimate experience without naming the person — full detail',
  'Do your most convincing strip-tease impression for 30 seconds (clothes stay on)',
  'Let the group look through your entire Tinder/Bumble/Hinge match list',
  'Send a flirty voice note to your most recent match on a dating app',
  'Sit in the lap of the person who dared you and stay there for 2 full minutes',
  'Describe in explicit detail what your ideal physical partner looks like head to toe',
  'Let someone smell your neck and describe what they think',
  'Do your best impression of what you look like when you wake up next to someone',
  'Read out the most flirtatious text you have ever sent — the whole thing',
  'Let the group rank your dating profile photos from worst to best',
  'Text someone "I miss you" with no context and show the group their reply',
  'Act out a first date scene with the person to your right — 1 minute, full commitment',
  'Tell the group the most physically bold thing you have ever done with someone',
  "Show the group the most scandalous photo you'd be okay with them seeing",
  'Do your most realistic impression of someone you have been physically attracted to',
  'Let the group take a risqué photo of you (PG-13 only) and keep it in their phone for 24 hours',
  'Describe your first time doing anything romantically significant — full story',
  'Let someone in the group pick a dare of their own choosing — and you must do it',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPool(type: CardType, level: SpiceLevel): string[] {
  if (type === 'truth') {
    if (level === 'mild')    return TRUTH_MILD;
    if (level === 'spicy')   return TRUTH_SPICY;
    if (level === 'wild')    return TRUTH_WILD;
    if (level === 'adult')   return TRUTH_ADULT;
    return TRUTH_EXTREME;
  } else {
    if (level === 'mild')    return DARE_MILD;
    if (level === 'spicy')   return DARE_SPICY;
    if (level === 'wild')    return DARE_WILD;
    if (level === 'adult')   return DARE_ADULT;
    return DARE_EXTREME;
  }
}

function pickRandom(pool: string[], exclude?: string): string {
  const filtered = pool.length > 1 && exclude ? pool.filter((q) => q !== exclude) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function spiceDotCount(level: SpiceLevel): number {
  const map: Record<SpiceLevel, number> = { mild: 1, spicy: 2, wild: 3, adult: 4, extreme: 5 };
  return map[level];
}

// ─── Spice Level Config ───────────────────────────────────────────────────────

interface SpiceOption {
  level: SpiceLevel;
  emoji: string;
  label: string;
  description: string;
  color: string;
  ageGate?: boolean;  // shows age-confirmation warning
}

const SPICE_OPTIONS: SpiceOption[] = [
  { level: 'mild',    emoji: '🟢', label: 'Mild',    description: 'Safe & fun for all',    color: '#00B894' },
  { level: 'spicy',   emoji: '🌶️', label: 'Spicy',   description: 'Revealing & flirty',    color: '#FF7675' },
  { level: 'wild',    emoji: '🔥', label: 'Wild',    description: 'No filter zone',         color: '#FF4B6E' },
  { level: 'adult',   emoji: '🍑', label: 'Adult+',  description: 'Intimate & bold (18+)',  color: '#A855F7', ageGate: true },
  { level: 'extreme', emoji: '💀', label: 'Extreme', description: 'Absolutely unhinged 🔞', color: '#7C3AED', ageGate: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  emoji: string;
  value: number | string;
  label: string;
  color: string;
  styles: ReturnType<typeof makeStyles>;
}

function StatCard({ emoji, value, label, color, styles }: StatCardProps): React.JSX.Element {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TruthOrDareScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<GamesStackParamList, 'TruthOrDare'>>();
  const roomId = route.params?.roomId;
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { firebaseUser, userProfile } = useAuthStore();

  // ── Phase & Setup State ──
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>('mild');

  // ── Game State ──
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [skipsLeft, setSkipsLeft] = useState<number>(MAX_SKIPS);
  const [totalTruths, setTotalTruths] = useState<number>(0);
  const [totalDares, setTotalDares] = useState<number>(0);
  const [card, setCard] = useState<CardState>({ type: 'truth', text: '', visible: false });

  // ── Animation ──
  const cardAnim = useRef(new Animated.Value(0)).current;
  const slideOutAnim = useRef(new Animated.Value(0)).current;

  // ── Bottle Spinner ──
  const [spinDone, setSpinDone] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const totalDegsRef = useRef(0);

  // ── Multiplayer state ──
  const isHostRef = useRef(false);
  const suppressRemoteRef = useRef(false);

  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    let cancelled = false;

    getDoc(doc(db, 'gameRooms', roomId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const room = snap.data() as GameRoom;
      const roomPlayers = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);

      isHostRef.current = room.hostUid === firebaseUser.uid;

      if (room.hostUid === firebaseUser.uid) {
        const initialPlayers: Player[] = roomPlayers.map((p, i) => ({
          uid: p.uid,
          name: p.name,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          truths: 0,
          dares: 0,
          skips: 0,
        }));
        
        const initState = {
          phase: 'setup',
          spiceLevel: 'mild',
          players: initialPlayers,
          currentPlayerIndex: 0,
          round: 1,
          skipsLeft: MAX_SKIPS,
          totalTruths: 0,
          totalDares: 0,
          card: { type: 'truth', text: '', visible: false },
          updatedBy: firebaseUser.uid,
          updatedAt: Date.now(),
        };
        rtdbSet(rtdbRef(rtdb, `gameRooms/${roomId}/tod`), initState).catch(console.error);
        setPlayers(initialPlayers);
      }
    });

    return () => { cancelled = true; };
  }, [roomId, firebaseUser?.uid]);

  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const r = rtdbRef(rtdb, `gameRooms/${roomId}/tod`);
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      if (data.updatedBy === firebaseUser.uid) return;

      suppressRemoteRef.current = true;
      if (data.phase) setPhase(data.phase);
      if (data.spiceLevel) setSpiceLevel(data.spiceLevel);
      if (data.players) setPlayers(data.players);
      if (data.currentPlayerIndex !== undefined) {
        const remoteIdx = data.currentPlayerIndex;
        const n = (data.players ?? players).length;
        setCurrentPlayerIndex(remoteIdx);
        // Non-host mirrors the host's spinner animation to the same player
        if (data.phase === 'playing') {
          triggerRemoteSpin(remoteIdx, n);
        }
      }
      if (data.round) setRound(data.round);
      if (data.skipsLeft !== undefined) setSkipsLeft(data.skipsLeft);
      if (data.totalTruths !== undefined) setTotalTruths(data.totalTruths);
      if (data.totalDares !== undefined) setTotalDares(data.totalDares);
      
      if (data.card) {
        setCard((prev) => {
          if (data.card.visible && !prev.visible) {
            cardAnim.setValue(0);
            Animated.spring(cardAnim, {
              toValue: 1,
              friction: 6,
              tension: 80,
              useNativeDriver: true,
            }).start();
          }
          return data.card;
        });
      }
      suppressRemoteRef.current = false;
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, firebaseUser?.uid]);

  function syncToRTDB(patch: any) {
    if (!roomId || !firebaseUser) return;
    rtdbUpdate(rtdbRef(rtdb, `gameRooms/${roomId}/tod`), {
      ...patch,
      updatedBy: firebaseUser.uid,
      updatedAt: Date.now(),
    }).catch(console.error);
  }

  // ─── Bottle Spinner Logic ──────────────────────────────────────────────────

  const doSpin = useCallback((targetIdx: number, numPlayers: number, onLand?: () => void) => {
    if (numPlayers === 0) return;
    const targetAngle = (targetIdx / numPlayers) * 360;
    const currentMod = totalDegsRef.current % 360;
    let diff = (targetAngle - currentMod + 360) % 360;
    // Guarantee at least a half-revolution of visible movement before landing
    if (diff < 60) diff += 360;
    // Random 4-8 full extra spins so each spin looks genuinely different
    const extraSpins = (Math.floor(Math.random() * 5) + 4) * 360;
    const newTotal = totalDegsRef.current + diff + extraSpins;
    spinAnim.stopAnimation();
    // Random duration 2000–3200ms — avoids identical-feeling spins
    const duration = 2000 + Math.random() * 1200;
    Animated.timing(spinAnim, {
      toValue: newTotal,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        totalDegsRef.current = newTotal;
        setSpinDone(true);
        onLand?.();
      }
    });
  }, [spinAnim]);

  // ── Spin trigger: increments whenever we want a new random spin ───────────────
  const [spinTrigger, setSpinTrigger] = useState(0);
  // Target index for the CURRENT spin — kept in a ref so the onLand callback
  // captures the same value that was passed to doSpin.
  const spinTargetRef = useRef(0);

  // Auto-spin on each trigger change
  useEffect(() => {
    if (phase !== 'playing' || players.length === 0 || spinTrigger === 0) return;
    setSpinDone(false);
    const randomIdx = spinTargetRef.current;
    doSpin(randomIdx, players.length, () => {
      setCurrentPlayerIndex(randomIdx);
      // Multiplayer: host broadcasts the chosen player after spin lands
      if (roomId && isHostRef.current) {
        rtdbUpdate(rtdbRef(rtdb, `gameRooms/${roomId}/tod`), {
          currentPlayerIndex: randomIdx,
          updatedBy: firebaseUser?.uid ?? '',
          updatedAt: Date.now(),
        }).catch(console.error);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTrigger, phase, players.length]);

  /** Spin to a specific player index (call this for non-host to mirror host). */
  const triggerRemoteSpin = useCallback((idx: number, numPlayers: number) => {
    setSpinDone(false);
    doSpin(idx, numPlayers);
  }, [doSpin]);

  // ─── Setup Handlers ────────────────────────────────────────────────────────

  const updatePlayerName = useCallback((index: number, name: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }, []);

  const addPlayer = useCallback(() => {
    if (playerNames.length < MAX_PLAYERS) {
      setPlayerNames((prev) => [...prev, '']);
    }
  }, [playerNames.length]);

  const removePlayer = useCallback((index: number) => {
    if (playerNames.length > MIN_PLAYERS) {
      setPlayerNames((prev) => prev.filter((_, i) => i !== index));
    }
  }, [playerNames.length]);

  const handleSpiceSelect = useCallback((opt: SpiceOption) => {
    if (roomId && !isHostRef.current) return;
    if (opt.ageGate) {
      Alert.alert(
        `${opt.emoji} ${opt.label} Mode`,
        `This mode contains mature, explicit content intended for adults (18+) in a private setting.\n\nOnly choose this if everyone in the group is comfortable with bold, adult-themed questions and dares.\n\nAre you sure?`,
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Yes, I\'m 18+',
            style: 'destructive',
            onPress: () => {
              setSpiceLevel(opt.level);
              if (roomId) syncToRTDB({ spiceLevel: opt.level });
            },
          },
        ],
      );
    } else {
      setSpiceLevel(opt.level);
      if (roomId) syncToRTDB({ spiceLevel: opt.level });
    }
  }, [roomId]);

  const canStart = roomId ? true : playerNames.every((n) => n.trim().length > 0);

  const startGame = useCallback(() => {
    if (roomId && !isHostRef.current) return;
    let initialPlayers = players;
    if (!roomId) {
      initialPlayers = playerNames.map((name, i) => ({
        name: name.trim(),
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        truths: 0,
        dares: 0,
        skips: 0,
      }));
      setPlayers(initialPlayers);
    }
    // Pick the first player randomly rather than always starting at index 0
    const firstIdx = Math.floor(Math.random() * Math.max(initialPlayers.length, 1));
    spinTargetRef.current = firstIdx;

    setCurrentPlayerIndex(firstIdx);
    setRound(1);
    setSkipsLeft(MAX_SKIPS);
    setTotalTruths(0);
    setTotalDares(0);
    setCard({ type: 'truth', text: '', visible: false });
    cardAnim.setValue(0);
    setPhase('playing');
    // Kick off the first spin
    setSpinTrigger((t) => t + 1);

    if (roomId) {
      syncToRTDB({
        phase: 'playing',
        players: initialPlayers,
        currentPlayerIndex: firstIdx,
        round: 1,
        skipsLeft: MAX_SKIPS,
        totalTruths: 0,
        totalDares: 0,
        card: { type: 'truth', text: '', visible: false },
        spiceLevel,
      });
    }
  }, [roomId, players, playerNames, cardAnim, spiceLevel]);

  // ─── Game Handlers ─────────────────────────────────────────────────────────

  const revealCard = useCallback((type: CardType) => {
    if (roomId && players[currentPlayerIndex]?.uid !== firebaseUser?.uid) return;
    const pool = getPool(type, spiceLevel);
    const text = pickRandom(pool, card.visible && card.type === type ? card.text : undefined);

    gameSounds.fire('spin');
    setTimeout(() => gameSounds.fire(type === 'truth' ? 'truth' : 'dare'), 400);

    const newCard = { type, text, visible: true };
    setCard(newCard);
    cardAnim.setValue(0);

    Animated.spring(cardAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    
    if (roomId) syncToRTDB({ card: newCard });
  }, [roomId, players, currentPlayerIndex, firebaseUser?.uid, spiceLevel, card, cardAnim]);

  const advanceToNextPlayer = useCallback((wasSkip: boolean) => {
    const nextPlayers = [...players];
    const current = { ...nextPlayers[currentPlayerIndex] };
    
    if (!wasSkip) {
      if (card.type === 'truth') current.truths += 1;
      else current.dares += 1;
    } else {
      current.skips += 1;
    }
    nextPlayers[currentPlayerIndex] = current;
    
    const nextTruths = !wasSkip && card.type === 'truth' ? totalTruths + 1 : totalTruths;
    const nextDares  = !wasSkip && card.type === 'dare'  ? totalDares  + 1 : totalDares;

    // Pick next player randomly — don't go sequentially
    const nextIndex  = Math.floor(Math.random() * Math.max(nextPlayers.length, 1));
    // Increment round counter every time we cycle through all players at least once
    const totalPlayed = nextTruths + nextDares;
    const nextRound   = totalPlayed > 0 && totalPlayed % nextPlayers.length === 0
      ? round + 1
      : round;

    setPlayers(nextPlayers);
    if (!wasSkip) {
      if (card.type === 'truth') setTotalTruths(nextTruths);
      else setTotalDares(nextDares);
    }

    Animated.timing(slideOutAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      slideOutAnim.setValue(0);
      cardAnim.setValue(0);
      const newCard = { type: 'truth' as CardType, text: '', visible: false };
      setCard(newCard);
      if (nextRound !== round) setRound(nextRound);

      if (roomId) {
        // Sync everything except currentPlayerIndex — host will broadcast that
        // AFTER the spin lands (via triggerRandomSpin → onLand → RTDB update).
        syncToRTDB({
          players: nextPlayers,
          round: nextRound,
          totalTruths: nextTruths,
          totalDares: nextDares,
          card: newCard,
        });
        if (isHostRef.current) {
          spinTargetRef.current = nextIndex;
          setSpinTrigger((t) => t + 1);
        }
      } else {
        // Solo: spin immediately
        spinTargetRef.current = nextIndex;
        setSpinTrigger((t) => t + 1);
      }
    });
  }, [currentPlayerIndex, players, card.type, totalTruths, totalDares, round, roomId, cardAnim, slideOutAnim]);

  const handleDone = useCallback(() => {
    if (roomId && players[currentPlayerIndex]?.uid !== firebaseUser?.uid) return;
    gameSounds.fire('button_tap');
    advanceToNextPlayer(false);
  }, [roomId, players, currentPlayerIndex, firebaseUser?.uid, advanceToNextPlayer]);

  const handleSkip = useCallback(() => {
    if (roomId && players[currentPlayerIndex]?.uid !== firebaseUser?.uid) return;
    if (skipsLeft <= 0) { gameSounds.fire('error'); return; }
    gameSounds.fire('turn_change');
    setSkipsLeft((s) => s - 1);
    if (roomId) syncToRTDB({ skipsLeft: skipsLeft - 1 });
    advanceToNextPlayer(true);
  }, [roomId, players, currentPlayerIndex, firebaseUser?.uid, skipsLeft, advanceToNextPlayer]);

  const endGame = useCallback(() => {
    if (roomId && !isHostRef.current) return;
    setPhase('gameover');
    if (roomId) syncToRTDB({ phase: 'gameover' });
  }, [roomId]);

  const playAgain = useCallback(() => {
    if (roomId && !isHostRef.current) return;
    setPhase('setup');
    if (!roomId) setPlayerNames(players.map((p) => p.name));
    if (roomId) syncToRTDB({ phase: 'setup' });
  }, [roomId, players]);

  // ─── Derived animation values ───────────────────────────────────────────────

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });
  const cardOpacity = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const slideOutX = slideOutAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH],
  });
  const bottleRotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  // ─── Leaderboard ────────────────────────────────────────────────────────────

  interface LeaderEntry { name: string; count: number; color: string }
  const mostTruths: LeaderEntry = players.reduce<LeaderEntry>(
    (best, p) => (p.truths > best.count ? { name: p.name, count: p.truths, color: p.color } : best),
    { name: '—', count: 0, color: C.textSecondary },
  );
  const mostDares: LeaderEntry = players.reduce<LeaderEntry>(
    (best, p) => (p.dares > best.count ? { name: p.name, count: p.dares, color: p.color } : best),
    { name: '—', count: 0, color: C.textSecondary },
  );

  // ─── Phase: Setup ──────────────────────────────────────────────────────────

  if (phase === 'setup') {
    // Split spice options into two rows: [mild, spicy, wild] + [adult, extreme]
    const row1 = SPICE_OPTIONS.slice(0, 3);
    const row2 = SPICE_OPTIONS.slice(3);

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor={C.background} />
        {roomId && (
          <View style={styles.roomBanner}>
            <Text style={styles.roomBannerText}>
              🎮 Multiplayer mode (room: {roomId.slice(0, 6).toUpperCase()})
            </Text>
          </View>
        )}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.setupScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.setupHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.backBtnText}>←</Text>
              </TouchableOpacity>
              <View style={styles.setupTitleBlock}>
                <Text style={styles.setupTitle}>Truth or Dare 🎯</Text>
                <Text style={styles.setupSubtitle}>How well do you know each other?</Text>
              </View>
            </View>

            {/* Players */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Players</Text>
              {roomId ? (
                players.map((p, i) => (
                  <View key={i} style={styles.playerRow}>
                    <View style={[styles.playerDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.playerInput, { color: C.text }]}>{p.name}</Text>
                  </View>
                ))
              ) : (
                <>
                  {playerNames.map((name, i) => (
                    <View key={i} style={styles.playerRow}>
                      <View style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }]} />
                      <TextInput
                        style={styles.playerInput}
                        placeholder={`Player ${i + 1} name`}
                        placeholderTextColor={C.textSecondary}
                        value={name}
                        onChangeText={(v) => updatePlayerName(i, v)}
                        maxLength={20}
                        returnKeyType="done"
                      />
                      {playerNames.length > MIN_PLAYERS && (
                        <TouchableOpacity onPress={() => removePlayer(i)} style={styles.removeBtn}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {playerNames.length < MAX_PLAYERS && (
                    <TouchableOpacity onPress={addPlayer} style={styles.addPlayerBtn}>
                      <Text style={styles.addPlayerText}>+ Add Player</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Spice Level */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Spice Level</Text>

              {/* Row 1: Mild / Spicy / Wild */}
              <View style={styles.spiceRow}>
                {row1.map((opt) => {
                  const selected = spiceLevel === opt.level;
                  return (
                    <TouchableOpacity
                      key={opt.level}
                      onPress={() => handleSpiceSelect(opt)}
                      style={[
                        styles.spicePill,
                        selected && { backgroundColor: opt.color, borderColor: opt.color },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.spicePillEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.spicePillLabel, selected && styles.spicePillLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.spicePillDesc, selected && styles.spicePillDescSelected]}>
                        {opt.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Row 2: Adult+ / Extreme */}
              <View style={[styles.spiceRow, { marginTop: spacing.sm }]}>
                {row2.map((opt) => {
                  const selected = spiceLevel === opt.level;
                  return (
                    <TouchableOpacity
                      key={opt.level}
                      onPress={() => handleSpiceSelect(opt)}
                      style={[
                        styles.spicePillWide,
                        selected && { backgroundColor: opt.color, borderColor: opt.color },
                        !selected && styles.spicePillAgeGate,
                      ]}
                      activeOpacity={0.75}
                    >
                      <View style={styles.spicePillWideInner}>
                        <Text style={styles.spicePillEmoji}>{opt.emoji}</Text>
                        <View>
                          <Text style={[styles.spicePillLabel, selected && styles.spicePillLabelSelected]}>
                            {opt.label}
                          </Text>
                          <Text style={[styles.spicePillDesc, selected && styles.spicePillDescSelected]}>
                            {opt.description}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.ageBadge, selected && styles.ageBadgeSelected]}>
                        <Text style={[styles.ageBadgeText, selected && styles.ageBadgeTextSelected]}>18+</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Start */}
            {roomId && !isHostRef.current ? (
              <View style={[styles.startBtn, styles.startBtnDisabled]}>
                <Text style={styles.startBtnText}>
                  Waiting for host to start...
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={startGame}
                disabled={!canStart}
                style={[
                  styles.startBtn,
                  !canStart && styles.startBtnDisabled,
                  canStart && { backgroundColor: SPICE_OPTIONS.find((s) => s.level === spiceLevel)?.color ?? C.primary },
                ]}
                activeOpacity={0.85}
              >
                <Text style={styles.startBtnText}>
                  {SPICE_OPTIONS.find((s) => s.level === spiceLevel)?.emoji} Start Game →
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── Phase: Playing ────────────────────────────────────────────────────────

  if (phase === 'playing') {
    // Guard: players may not be synced yet in multiplayer
    if (!players.length || !players[currentPlayerIndex]) {
      return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.textSecondary, fontSize: 16 }}>Loading game…</Text>
          </View>
        </SafeAreaView>
      );
    }

    const currentPlayer = players[currentPlayerIndex];
    const spiceConfig = SPICE_OPTIONS.find((s) => s.level === spiceLevel)!;

    // Card colors vary by type AND spice level for more personality
    const isAdultPlus = spiceLevel === 'adult' || spiceLevel === 'extreme';
    const cardBg        = card.type === 'truth'
      ? (isAdultPlus ? '#F5F0FF' : '#EEF2FF')
      : (isAdultPlus ? '#FFF0FA' : '#FFF0F3');
    const cardAccent    = card.type === 'truth'
      ? (isAdultPlus ? spiceConfig.color : C.secondary)
      : (isAdultPlus ? spiceConfig.color : C.primary);
    const cardEmoji     = card.type === 'truth' ? '🤔' : '💥';
    const dotCount      = spiceDotCount(spiceLevel);

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor={C.background} />

        {/* Thin spice accent stripe at the very top */}
        <View style={[styles.spiceStripe, { backgroundColor: spiceConfig.color }]} />

        <View style={styles.playingContainer}>

          {/* Top Bar */}
          <View style={styles.playingTopBar}>
            <View>
              <Text style={styles.roundLabel}>Round {round}</Text>
              <View style={styles.skipCounter}>
                {[...Array(MAX_SKIPS)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.skipDot,
                      i < skipsLeft ? styles.skipDotActive : styles.skipDotUsed,
                    ]}
                  />
                ))}
                <Text style={styles.skipCounterText}> {skipsLeft} skips left</Text>
              </View>
            </View>

            {/* Spice badge */}
            <View style={[styles.spiceBadge, { backgroundColor: spiceConfig.color + '20', borderColor: spiceConfig.color + '50' }]}>
              <Text style={styles.spiceBadgeEmoji}>{spiceConfig.emoji}</Text>
              <Text style={[styles.spiceBadgeLabel, { color: spiceConfig.color }]}>{spiceConfig.label}</Text>
            </View>

            <TouchableOpacity onPress={endGame} style={styles.endBtn} activeOpacity={0.75}>
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          </View>

          {/* Current Player */}
          <View style={[styles.playerBanner, { backgroundColor: currentPlayer.color + '18', borderColor: currentPlayer.color + '40' }]}>
            <View style={[styles.playerBannerDot, { backgroundColor: currentPlayer.color }]} />
            <View style={styles.playerBannerInfo}>
              <Text style={[styles.playerBannerName, { color: currentPlayer.color }]}>
                {currentPlayer.name}
              </Text>
              <Text style={styles.playerBannerSub}>It's your turn!</Text>
            </View>
            <View style={styles.playerBannerStats}>
              <Text style={styles.playerBannerStatText}>🤔 {currentPlayer.truths}</Text>
              <Text style={styles.playerBannerStatText}>💥 {currentPlayer.dares}</Text>
            </View>
          </View>

          {/* Bottle Spinner / Action Buttons — shown when no card is visible */}
          {!card.visible && (
            <View style={styles.spinnerArea}>
              {/* ── While spinning: show the bottle wheel ── */}
              {!spinDone ? (
                <>
                  <View style={styles.spinnerContainer}>
                    {/* Player bubbles arranged in a ring */}
                    {players.map((p, i) => {
                      const angle = (i / players.length) * 2 * Math.PI;
                      const bx = SPINNER_CENTER + RING_RADIUS * Math.cos(angle) - BUBBLE_R;
                      const by = SPINNER_CENTER + RING_RADIUS * Math.sin(angle) - BUBBLE_R;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.spinnerBubble,
                            {
                              left: bx,
                              top: by,
                              backgroundColor: p.color + '66',
                              borderColor: p.color + '44',
                            },
                          ]}
                        >
                          <Text style={styles.spinnerBubbleText}>
                            {p.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      );
                    })}

                    {/* Rotating needle */}
                    <Animated.View
                      style={[
                        styles.bottleWrapper,
                        { transform: [{ rotate: bottleRotation }] },
                      ]}
                    >
                      <View style={styles.bottleTail} />
                      <View style={[styles.bottleHead, { backgroundColor: spiceConfig.color }]} />
                      <View style={[styles.bottleArrowhead, { borderLeftColor: spiceConfig.color }]} />
                    </Animated.View>

                    {/* Center pivot */}
                    <View style={[styles.spinnerPivot, { borderColor: spiceConfig.color }]} />
                  </View>

                  <Text style={[styles.spinnerStatus, { color: spiceConfig.color }]}>
                    Spinning...
                  </Text>
                </>
              ) : (
                /* ── After spin lands: compact winner + Truth/Dare buttons ── */
                <>
                  {/* Winner chip */}
                  <View style={[styles.spinnerWinnerChip, { backgroundColor: currentPlayer.color + '18', borderColor: currentPlayer.color + '55' }]}>
                    <View style={[styles.spinnerWinnerAvatar, { backgroundColor: currentPlayer.color }]}>
                      <Text style={styles.spinnerWinnerAvatarText}>
                        {currentPlayer.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.spinnerWinnerInfo}>
                      <Text style={[styles.spinnerWinnerName, { color: currentPlayer.color }]}>
                        {currentPlayer.name}
                      </Text>
                      <Text style={styles.spinnerWinnerSub}>The bottle chose you! 🎯</Text>
                    </View>
                  </View>

                  <Text style={[styles.spinnerStatus, { color: C.textSecondary, marginTop: spacing.lg }]}>
                    Pick your challenge:
                  </Text>

                  {/* Truth / Dare buttons */}
                  <View style={styles.actionBtnRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isAdultPlus ? spiceConfig.color + 'CC' : C.secondary }]}
                      onPress={() => revealCard('truth')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnEmoji}>🤔</Text>
                      <Text style={styles.actionBtnLabel}>Truth</Text>
                      <Text style={styles.actionBtnSub}>Answer honestly</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isAdultPlus ? spiceConfig.color : C.primary }]}
                      onPress={() => revealCard('dare')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnEmoji}>💥</Text>
                      <Text style={styles.actionBtnLabel}>Dare</Text>
                      <Text style={styles.actionBtnSub}>Do it or skip it</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Card */}
          {card.visible && (
            <Animated.View
              style={[
                styles.cardWrapper,
                {
                  opacity: slideOutAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                  transform: [
                    { translateX: slideOutX },
                    { translateY: cardTranslateY },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.card,
                  { backgroundColor: cardBg, borderColor: cardAccent + '40' },
                  { opacity: cardOpacity },
                ]}
              >
                {/* Accent bar at top of card */}
                <View style={[styles.cardAccentBar, { backgroundColor: cardAccent }]} />

                {/* Card Header */}
                <View style={[styles.cardHeaderRow, { backgroundColor: cardAccent + '14' }]}>
                  <Text style={styles.cardHeaderEmoji}>{cardEmoji}</Text>
                  <Text style={[styles.cardHeaderType, { color: cardAccent }]}>
                    {card.type === 'truth' ? 'TRUTH' : 'DARE'}
                  </Text>
                  <View style={styles.spiceIndicator}>
                    {[...Array(dotCount)].map((_, i) => (
                      <View key={i} style={[styles.spiceDot, { backgroundColor: spiceConfig.color }]} />
                    ))}
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                  <Text style={[styles.cardText, { color: C.text }]}>{card.text}</Text>
                </View>

                {/* Card Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.cardActionBtn, { backgroundColor: cardAccent }]}
                    onPress={handleDone}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.doneText}>✓ Done — Next Player</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.skipBtn, skipsLeft === 0 && styles.skipBtnDisabled]}
                    onPress={handleSkip}
                    disabled={skipsLeft === 0}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.skipText, skipsLeft === 0 && styles.skipTextDisabled]}>
                      ⏭ Skip ({skipsLeft} left)
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Animated.View>
          )}

          {/* Mini Scoreboard */}
          <View style={styles.miniScoreboard}>
            {players.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.miniPlayerChip,
                  i === currentPlayerIndex && { borderColor: p.color, backgroundColor: p.color + '14' },
                ]}
              >
                <View style={[styles.miniPlayerDot, { backgroundColor: p.color }]} />
                <Text style={styles.miniPlayerName} numberOfLines={1}>{p.name}</Text>
                {i === currentPlayerIndex && <Text style={[styles.miniPlayerActive, { color: p.color }]}>▶</Text>}
              </View>
            ))}
          </View>
        </View>
        <GameChatVoice
          roomId={roomId}
          myUid={firebaseUser?.uid ?? ''}
          myName={userProfile?.name ?? 'Player'}
          accentColor="#FF4B6E"
        />
      </SafeAreaView>
    );
  }

  // ─── Phase: Game Over ──────────────────────────────────────────────────────

  const totalSkips = players.reduce((sum, p) => sum + p.skips, 0);
  const totalRounds = round - 1 > 0 ? round - 1 : 1;
  const spiceConfig = SPICE_OPTIONS.find((s) => s.level === spiceLevel)!;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <ScrollView contentContainerStyle={styles.gameoverScroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.gameoverTitle}>Game Over! 🎉</Text>
        <Text style={styles.gameoverSubtitle}>Here's how it went down</Text>

        {/* Spice badge */}
        <View style={[styles.gameoverSpiceBadge, { backgroundColor: spiceConfig.color + '18', borderColor: spiceConfig.color + '40' }]}>
          <Text style={styles.gameoverSpiceEmoji}>{spiceConfig.emoji}</Text>
          <Text style={[styles.gameoverSpiceLabel, { color: spiceConfig.color }]}>
            {spiceConfig.label} Mode
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard emoji="🔄" value={totalRounds} label="Rounds"  color={C.secondary} styles={styles} />
          <StatCard emoji="🤔" value={totalTruths} label="Truths"  color={C.secondary} styles={styles} />
          <StatCard emoji="💥" value={totalDares}  label="Dares"   color={C.primary} styles={styles} />
          <StatCard emoji="⏭" value={totalSkips}  label="Skips"   color={C.warning} styles={styles} />
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboardCard}>
          <Text style={styles.leaderboardTitle}>🏆 Leaderboard</Text>
          {players
            .slice()
            .sort((a, b) => (b.truths + b.dares) - (a.truths + a.dares))
            .map((p, i) => (
              <View key={i} style={[styles.leaderRow, i === 0 && styles.leaderRowFirst]}>
                <Text style={styles.leaderRank}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </Text>
                <View style={[styles.leaderNameDot, { backgroundColor: p.color }]} />
                <Text style={styles.leaderName}>{p.name}</Text>
                <View style={styles.leaderStats}>
                  <Text style={styles.leaderStatItem}>🤔 {p.truths}</Text>
                  <Text style={styles.leaderStatItem}>💥 {p.dares}</Text>
                  <Text style={[styles.leaderStatItem, { color: C.textSecondary }]}>⏭ {p.skips}</Text>
                </View>
                <Text style={[styles.leaderTotal, { color: p.color }]}>{p.truths + p.dares}</Text>
              </View>
            ))}
        </View>

        {/* Highlights */}
        <View style={styles.highlightsCard}>
          <Text style={styles.highlightsTitle}>✨ Highlights</Text>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>Most Truths</Text>
            <Text style={[styles.highlightValue, { color: mostTruths.color }]}>
              {mostTruths.name} ({mostTruths.count})
            </Text>
          </View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>Most Dares</Text>
            <Text style={[styles.highlightValue, { color: mostDares.color }]}>
              {mostDares.name} ({mostDares.count})
            </Text>
          </View>
          <View style={[styles.highlightRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.highlightLabel}>Spice Level</Text>
            <Text style={[styles.highlightValue, { color: spiceConfig.color }]}>
              {spiceConfig.emoji} {spiceConfig.label}
            </Text>
          </View>
        </View>

        {/* CTA Buttons */}
        <TouchableOpacity
          style={[styles.playAgainBtn, { backgroundColor: spiceConfig.color }]}
          onPress={playAgain}
          activeOpacity={0.85}
        >
          <Text style={styles.playAgainText}>🔄 Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backToGamesBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Text style={styles.backToGamesText}>← Back to Games</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

