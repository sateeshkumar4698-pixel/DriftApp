import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList } from '../../types';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { gameSounds } from '../../services/gameSounds';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'BetGame'>;

// ─── Prompt Banks ─────────────────────────────────────────────────────────────

const PROMPTS: Record<string, { truths: string[]; dares: string[] }> = {
  mild: {
    truths: [
      'What is the most embarrassing thing that happened to you in school?',
      'Have you ever lied to get out of trouble? What was the lie?',
      'What\'s the weirdest food combination you secretly enjoy?',
      'Who was your first crush and did they ever find out?',
      'What\'s the most childish thing you still do?',
      'Have you ever cried at a movie? Which one?',
      'What\'s a habit you have that others would find gross?',
      'What\'s the longest you\'ve gone without showering?',
      'Have you ever pretended to be sick to skip something? What?',
      'What\'s something you\'re terrible at but still enjoy doing?',
      'What\'s the most embarrassing photo on your phone?',
      'Have you ever stalked someone\'s social media for over an hour?',
      'What\'s the strangest dream you remember?',
      'What\'s a song you know every word to but would be embarrassed to admit?',
      'Have you ever walked into a glass door or wall?',
    ],
    dares: [
      'Do your best impression of someone in the room.',
      'Speak in an accent for the next 3 rounds.',
      'Let the group give you a silly nickname for the rest of the game.',
      'Do 10 jumping jacks right now.',
      'Sing the chorus of any song out loud.',
      'Tell a terrible joke and commit to it.',
      'Do your best runway walk across the room.',
      'Show the last 3 photos in your camera roll.',
      'Call a family member and say "I just called to say I love you" then hang up.',
      'Let someone in the group post a story from your phone (they choose what).',
      'Do your best robot dance for 20 seconds.',
      'Talk in slow motion for the next 2 rounds.',
      'Attempt to lick your elbow.',
      'Make a funny face and hold it for 30 seconds.',
      'Send a voice note saying "oink oink" to the last person you texted.',
    ],
  },
  spicy: {
    truths: [
      'What\'s the most embarrassing text you\'ve ever sent to the wrong person?',
      'Have you ever had a crush on someone in this room? (yes/no only)',
      'What\'s the pettiest reason you\'ve ever ended or avoided a friendship?',
      'What\'s the most money you\'ve spent on something you regret?',
      'Have you ever ghosted someone? Who and why?',
      'What\'s a lie you told that went way too far?',
      'What\'s the biggest secret you\'ve kept from your parents?',
      'Have you ever pretended to like someone\'s gift when you hated it?',
      'Who in the room would you date if you had to pick one?',
      'What\'s the most embarrassing reason you\'ve rejected someone?',
      'Have you ever been jealous of someone here? About what?',
      'What\'s the worst date you\'ve ever been on?',
      'Have you ever read someone\'s messages without them knowing?',
      'What\'s the most unfair thing you\'ve done that you never got caught for?',
      'What opinion do you have that you\'re afraid to share publicly?',
    ],
    dares: [
      'Text your most recent ex "I miss your cooking" and show the reply.',
      'Let the group write a tweet from your account (they decide the content).',
      'Do your best impression of each person in the room — they rate it.',
      'Call a friend and convince them you\'re at the airport about to leave the country.',
      'Let the group go through your Spotify recently played for 30 seconds.',
      'Whisper something embarrassing to the person on your left.',
      'Reenact your most embarrassing moment.',
      'Post a throwback photo of yourself on Instagram Stories.',
      'Do a freestyle rap about the person to your right for 30 seconds.',
      'Let someone read your most recent Google search history out loud.',
      'Do push-ups — as many as you can. Everyone counts.',
      'Eat a spoonful of the spiciest condiment available.',
      'Call someone and sing happy birthday even if it\'s not their birthday.',
      'Let the group style your hair for the next round.',
      'Speak only in questions for the next 3 rounds.',
    ],
  },
  wild: {
    truths: [
      'What\'s the most morally questionable thing you\'ve done that you don\'t fully regret?',
      'What\'s a secret you\'ve never told your closest friend?',
      'If you could delete one memory, what would it be and why?',
      'Have you ever done something you\'re ashamed of to fit in? Describe it.',
      'What is something about yourself you\'re actively hiding from people around you?',
      'What\'s the worst thing you\'ve thought about a person in this room?',
      'Have you ever betrayed someone\'s trust and never told them? What happened?',
      'What\'s a situation where you were a coward when you should have been brave?',
      'What would your life look like if you had made the opposite choice in your biggest regret?',
      'Who do you envy most and why — be completely honest.',
      'What is something you wish you could apologize for but never have?',
      'What\'s the darkest thought you\'ve ever had about yourself?',
      'If everyone in this room could see one week of your life as a movie, what scene would you edit out?',
      'What\'s a personality trait you pretend to have but actually don\'t?',
      'What would devastate your self-image if the people closest to you knew?',
    ],
    dares: [
      'Let the group write a confession post on any of your social media right now.',
      'Hand your phone to someone to answer any message they choose as you — for real.',
      'Call the 5th contact in your phone and speak only in song lyrics for 1 minute.',
      'Let the group choose any profile photo and set it as your main photo for 24 hours.',
      'Read your most embarrassing journal entry or note saved on your phone out loud.',
      'Send a heartfelt voice note to someone you haven\'t talked to in a year.',
      'Swap clothes with the person across from you for the next round.',
      'The group gives you a challenge — you must attempt it no matter what (within reason).',
      'Let everyone in the group set your phone wallpaper to whatever they want.',
      'Do a full 60-second stand-up comedy routine — no pausing, no stopping.',
      'Walk up to a stranger (or send a text to someone outside the group) with a ridiculous compliment the group writes for you.',
      'Write a dramatic breakup text to your WiFi network and read it aloud.',
      'The group assigns you an embarrassing word you must work into every sentence for 5 rounds.',
      'Perform a dramatic 30-second death scene from any movie — the group votes if you pass.',
      'Let the group draft your next 3 Instagram captions, and you must post them.',
    ],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SpiceLevel = 'mild' | 'spicy' | 'wild';
type CardType   = 'truth' | 'dare' | 'wild';

interface Player {
  name:    string;
  coins:   number;
  dares:   number;
  truths:  number;
  refusals: number;
  emoji:   string;
}

interface Stakes {
  truthStake:    string;
  dareStake:     string;
  coinWager:     number;
  wildEnabled:   boolean;
  wildStake:     string;
  spiceLevel:    SpiceLevel;
}

interface GameState {
  players:      Player[];
  currentIndex: number;
  round:        number;
  stakes:       Stakes;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_EMOJIS = ['🦊', '🐯', '🦋', '🐬', '🦄', '🔥'];
const AVATAR_COLORS = ['#FF4B6E', '#6C5CE7', '#00B894', '#0984E3', '#E17055', '#FDCB6E'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function drawCard(stakes: Stakes, round: number): { type: CardType; prompt: string } {
  if (stakes.wildEnabled && round % 5 === 0 && round > 0) {
    return { type: 'wild', prompt: stakes.wildStake };
  }
  const isT = Math.random() < 0.5;
  const type: CardType = isT ? 'truth' : 'dare';
  const bank = PROMPTS[stakes.spiceLevel];
  return { type, prompt: randomFrom(isT ? bank.truths : bank.dares) };
}

const SPICE_OPTIONS: { level: SpiceLevel; emoji: string; label: string; color: string }[] = [
  { level: 'mild',  emoji: '🌿', label: 'Mild',  color: '#00B894' },
  { level: 'spicy', emoji: '🌶', label: 'Spicy', color: '#E17055' },
  { level: 'wild',  emoji: '🔥', label: 'Wild',  color: '#FF4B6E' },
];

// ─── Card Colors ─────────────────────────────────────────────────────────────

const CARD_CONFIG = {
  truth: { bg: '#2D3BCC', label: 'TRUTH 🎯', emoji: '🎯', text: '#fff' },
  dare:  { bg: '#FF4B6E', label: 'DARE 💪',  emoji: '💪', text: '#fff' },
  wild:  { bg: '#FDCB6E', label: '⚡ WILD STAKE', emoji: '⚡', text: '#1A1A2E' },
};

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (players: Player[], stakes: Stakes) => void }) {
  const [playerCount, setPlayerCount] = useState(3);
  const [names, setNames] = useState(['', '', '', '', '', '']);
  const [stakes, setStakes] = useState<Stakes>({
    truthStake:  '',
    dareStake:   '',
    coinWager:   100,
    wildEnabled: false,
    wildStake:   '',
    spiceLevel:  'mild',
  });

  function canStart() {
    const filled = names.slice(0, playerCount).every((n) => n.trim().length >= 2);
    return filled && stakes.truthStake.trim() && stakes.dareStake.trim();
  }

  function handleStart() {
    const players: Player[] = names.slice(0, playerCount).map((name, i) => ({
      name: name.trim(),
      coins: 500,
      dares: 0,
      truths: 0,
      refusals: 0,
      emoji: PLAYER_EMOJIS[i],
    }));
    onStart(players, stakes);
  }

  return (
    <ScrollView contentContainerStyle={setup.container} showsVerticalScrollIndicator={false}>
      {/* Title */}
      <View style={setup.heroBox}>
        <Text style={setup.heroEmoji}>🎰</Text>
        <Text style={setup.heroTitle}>Stake It</Text>
        <Text style={setup.heroSub}>Set the stakes. Make it personal.</Text>
      </View>

      {/* Player count */}
      <Text style={setup.label}>HOW MANY PLAYERS?</Text>
      <View style={setup.countRow}>
        {[2, 3, 4, 5, 6].map((n) => (
          <TouchableOpacity
            key={n}
            style={[setup.countBtn, playerCount === n && setup.countBtnActive]}
            onPress={() => setPlayerCount(n)}
          >
            <Text style={[setup.countBtnText, playerCount === n && setup.countBtnTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Player names */}
      <Text style={setup.label}>PLAYER NAMES</Text>
      {names.slice(0, playerCount).map((name, i) => (
        <View key={i} style={setup.nameRow}>
          <View style={[setup.nameEmoji, { backgroundColor: AVATAR_COLORS[i] + '30' }]}>
            <Text style={{ fontSize: 20 }}>{PLAYER_EMOJIS[i]}</Text>
          </View>
          <TextInput
            style={setup.nameInput}
            value={name}
            onChangeText={(v) => {
              const next = [...names];
              next[i] = v;
              setNames(next);
            }}
            placeholder={`Player ${i + 1} name`}
            placeholderTextColor={colors.textSecondary}
            maxLength={20}
          />
        </View>
      ))}

      {/* Stakes */}
      <Text style={[setup.label, { marginTop: spacing.lg }]}>WHAT HAPPENS IF YOU REFUSE?</Text>
      <Text style={setup.sublabel}>Truth consequence</Text>
      <TextInput
        style={setup.stakeInput}
        value={stakes.truthStake}
        onChangeText={(v) => setStakes({ ...stakes, truthStake: v })}
        placeholder="e.g. Share your most embarrassing photo"
        placeholderTextColor={colors.textSecondary}
        maxLength={100}
        multiline
      />

      <Text style={setup.sublabel}>Dare consequence</Text>
      <TextInput
        style={setup.stakeInput}
        value={stakes.dareStake}
        onChangeText={(v) => setStakes({ ...stakes, dareStake: v })}
        placeholder="e.g. Do 20 pushups in front of everyone"
        placeholderTextColor={colors.textSecondary}
        maxLength={100}
        multiline
      />

      {/* Coin wager */}
      <Text style={[setup.label, { marginTop: spacing.lg }]}>🪙 COIN WAGER PER ROUND</Text>
      <View style={setup.stepperRow}>
        <TouchableOpacity
          style={setup.stepBtn}
          onPress={() => setStakes({ ...stakes, coinWager: Math.max(0, stakes.coinWager - 25) })}
        >
          <Text style={setup.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={setup.stepValue}>
          <Text style={setup.stepValueText}>{stakes.coinWager === 0 ? 'No bet' : `${stakes.coinWager} 🪙`}</Text>
        </View>
        <TouchableOpacity
          style={setup.stepBtn}
          onPress={() => setStakes({ ...stakes, coinWager: Math.min(500, stakes.coinWager + 25) })}
        >
          <Text style={setup.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {stakes.coinWager === 0 && (
        <Text style={setup.hint}>0 = no coin bet, play for pride only</Text>
      )}

      {/* Spice */}
      <Text style={[setup.label, { marginTop: spacing.lg }]}>SPICE LEVEL</Text>
      <View style={setup.spiceRow}>
        {SPICE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.level}
            style={[setup.spiceBtn, stakes.spiceLevel === opt.level && { backgroundColor: opt.color + '20', borderColor: opt.color }]}
            onPress={() => setStakes({ ...stakes, spiceLevel: opt.level })}
          >
            <Text style={setup.spiceEmoji}>{opt.emoji}</Text>
            <Text style={[setup.spiceLabel, stakes.spiceLevel === opt.level && { color: opt.color }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Wild card toggle */}
      <View style={setup.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={setup.toggleLabel}>⚡ Wild Card Rounds</Text>
          <Text style={setup.toggleSub}>Every 5th round, a special group stake kicks in</Text>
        </View>
        <Switch
          value={stakes.wildEnabled}
          onValueChange={(v) => setStakes({ ...stakes, wildEnabled: v })}
          trackColor={{ false: colors.border, true: colors.warning }}
          thumbColor={stakes.wildEnabled ? '#fff' : '#fff'}
        />
      </View>
      {stakes.wildEnabled && (
        <TextInput
          style={setup.stakeInput}
          value={stakes.wildStake}
          onChangeText={(v) => setStakes({ ...stakes, wildStake: v })}
          placeholder="Wild consequence: e.g. The group picks any dare for you"
          placeholderTextColor={colors.textSecondary}
          maxLength={100}
          multiline
        />
      )}

      {/* Preview card */}
      {(stakes.truthStake || stakes.dareStake) ? (
        <View style={setup.previewCard}>
          <Text style={setup.previewTitle}>Stakes Preview</Text>
          {stakes.truthStake ? <Text style={setup.previewLine}>🎯 Refuse Truth → {stakes.truthStake}</Text> : null}
          {stakes.dareStake ? <Text style={setup.previewLine}>💪 Refuse Dare → {stakes.dareStake}</Text> : null}
          {stakes.coinWager > 0 ? <Text style={setup.previewLine}>🪙 {stakes.coinWager} coins per round</Text> : null}
        </View>
      ) : null}

      {/* Start button */}
      <TouchableOpacity
        style={[setup.startBtn, !canStart() && setup.startBtnDisabled]}
        onPress={handleStart}
        disabled={!canStart()}
        activeOpacity={0.85}
      >
        <Text style={setup.startBtnText}>Lock In Stakes & Deal 🎰</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Scoreboard Modal ──────────────────────────────────────────────────────────

function ScoreboardModal({
  visible,
  players,
  onClose,
}: {
  visible: boolean;
  players: Player[];
  onClose: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.coins - a.coins);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sb.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={sb.sheet}>
          <Text style={sb.title}>🏆 Scoreboard</Text>
          {sorted.map((p, i) => (
            <View key={p.name} style={sb.row}>
              <Text style={sb.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</Text>
              <Text style={sb.emoji}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={sb.name}>{p.name}</Text>
                <Text style={sb.stats}>{p.truths}T · {p.dares}D · {p.refusals} refused</Text>
              </View>
              <Text style={sb.coins}>{p.coins} 🪙</Text>
            </View>
          ))}
          <TouchableOpacity style={sb.closeBtn} onPress={onClose}>
            <Text style={sb.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Game Screen ──────────────────────────────────────────────────────────────

function GameScreen({
  game,
  setGame,
  onEnd,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
  onEnd: () => void;
}) {
  const [phase, setPhase] = useState<'pass' | 'reveal' | 'raised'>('pass');
  const [card, setCard]   = useState<{ type: CardType; prompt: string } | null>(null);
  const [shown, setShown] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [raiseAccepted, setRaiseAccepted] = useState(false);
  const [raisedThisRound, setRaisedThisRound] = useState(false);

  const flipAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const current = game.players[game.currentIndex];
  const cfg = card ? CARD_CONFIG[card.type] : CARD_CONFIG.truth;
  const wager = raisedThisRound && raiseAccepted ? game.stakes.coinWager * 2 : game.stakes.coinWager;

  function dealCard() {
    gameSounds.fire('spin');
    const c = drawCard(game.stakes, game.round);
    setCard(c);
    setShown(false);
    setRaisedThisRound(false);
    setRaiseAccepted(false);
    flipAnim.setValue(0);
    setTimeout(() => gameSounds.fire('reveal'), 200);
    setPhase('reveal');
  }

  function revealCard() {
    Animated.sequence([
      Animated.timing(flipAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(flipAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setShown(true), 180);
  }

  function raiseStakes() {
    if (raisedThisRound) return;
    setRaisedThisRound(true);
    // pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }

  function nextPlayer(outcome: 'completed' | 'refused') {
    const players = game.players.map((p, i) => {
      if (i !== game.currentIndex) return p;
      const isT = card?.type === 'truth';
      const isD = card?.type === 'dare';
      return {
        ...p,
        truths:   isT ? p.truths + 1   : p.truths,
        dares:    isD ? p.dares + 1    : p.dares,
        refusals: outcome === 'refused' ? p.refusals + 1 : p.refusals,
        coins: outcome === 'completed'
          ? p.coins + wager * (game.players.length - 1) // win from pot
          : p.coins - wager,                             // lose to pot
      };
    });
    setGame({
      ...game,
      players,
      currentIndex: (game.currentIndex + 1) % game.players.length,
      round: game.round + 1,
    });
    setPhase('pass');
    setCard(null);
  }

  function handleCompleted() {
    nextPlayer('completed');
  }

  function handleRefused() {
    const stake = card?.type === 'truth' ? game.stakes.truthStake
                : card?.type === 'dare'  ? game.stakes.dareStake
                : game.stakes.wildStake;
    Alert.alert(
      '😱 Refused!',
      `${current.name} refused!\n\n📌 Consequence:\n${stake}\n\n${wager > 0 ? `💸 −${wager} coins` : ''}`,
      [{ text: 'OK — consequence noted', onPress: () => nextPlayer('refused') }],
    );
  }

  // ── Pass screen ──

  if (phase === 'pass') {
    const next = game.players[(game.currentIndex) % game.players.length];
    return (
      <View style={game_s.passScreen}>
        <Text style={game_s.passEmoji}>{next.emoji}</Text>
        <Text style={game_s.passTitle}>Pass to</Text>
        <Text style={game_s.passName}>{next.name}</Text>
        <Text style={game_s.passCoins}>🪙 {next.coins} coins</Text>
        <TouchableOpacity style={game_s.passBtn} onPress={dealCard} activeOpacity={0.85}>
          <Text style={game_s.passBtnText}>I'm ready — Draw a Card 🃏</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Reveal screen ──

  const scaleX = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] });

  return (
    <View style={game_s.flex}>
      {/* Header */}
      <View style={game_s.header}>
        <TouchableOpacity onPress={onEnd} style={game_s.endBtn}>
          <Text style={game_s.endBtnText}>End</Text>
        </TouchableOpacity>
        <View style={game_s.headerCenter}>
          <Text style={game_s.headerName}>{current.emoji} {current.name}</Text>
          <Text style={game_s.headerRound}>Round {game.round + 1}</Text>
        </View>
        <TouchableOpacity onPress={() => setScoreVisible(true)} style={game_s.scoreBtn}>
          <Text style={game_s.scoreBtnText}>🏆</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={game_s.scroll} showsVerticalScrollIndicator={false}>
        {/* The Card */}
        <Animated.View style={[game_s.card, { backgroundColor: cfg.bg, transform: [{ scaleX }, { scale: pulseAnim }] }]}>
          {!shown ? (
            <TouchableOpacity style={game_s.cardInner} onPress={revealCard} activeOpacity={0.85}>
              <Text style={game_s.cardQuestion}>?</Text>
              <Text style={game_s.cardTap}>Tap to reveal</Text>
            </TouchableOpacity>
          ) : (
            <View style={game_s.cardInner}>
              <Text style={[game_s.cardType, { color: cfg.text }]}>{cfg.label}</Text>
              <Text style={[game_s.cardPrompt, { color: cfg.text }]}>{card?.prompt}</Text>
            </View>
          )}
        </Animated.View>

        {/* Stakes reminder */}
        {shown && card && (
          <View style={game_s.stakeReminder}>
            <Text style={game_s.stakeReminderLabel}>
              {card.type === 'wild' ? '⚡ Wild Consequence' : `If ${card.type === 'truth' ? 'refused/dishonest' : 'refused/failed'}:`}
            </Text>
            <Text style={game_s.stakeReminderText}>
              {card.type === 'truth' ? game.stakes.truthStake
               : card.type === 'dare' ? game.stakes.dareStake
               : game.stakes.wildStake}
            </Text>
          </View>
        )}

        {/* Wager */}
        {shown && game.stakes.coinWager > 0 && (
          <View style={game_s.wagerRow}>
            <Text style={game_s.wagerText}>🪙 Wager: {wager} coins {raisedThisRound && raiseAccepted ? '(RAISED 🔥)' : ''}</Text>
          </View>
        )}

        {/* Actions */}
        {shown && (
          <View style={game_s.actionBlock}>
            {/* Raise stakes */}
            {game.stakes.coinWager > 0 && !raisedThisRound && (
              <TouchableOpacity style={game_s.raiseBtn} onPress={raiseStakes} activeOpacity={0.85}>
                <Text style={game_s.raiseBtnText}>⚡ Raise Stakes (double wager)</Text>
              </TouchableOpacity>
            )}
            {raisedThisRound && !raiseAccepted && (
              <TouchableOpacity
                style={game_s.acceptRaiseBtn}
                onPress={() => setRaiseAccepted(true)}
                activeOpacity={0.85}
              >
                <Text style={game_s.acceptRaiseBtnText}>✅ Group accepted the raise</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={game_s.completedBtn} onPress={handleCompleted} activeOpacity={0.85}>
              <Text style={game_s.completedBtnText}>✅ Completed!</Text>
            </TouchableOpacity>
            <TouchableOpacity style={game_s.refuseBtn} onPress={handleRefused} activeOpacity={0.85}>
              <Text style={game_s.refuseBtnText}>😤 I Refuse</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ScoreboardModal
        visible={scoreVisible}
        players={game.players}
        onClose={() => setScoreVisible(false)}
      />
    </View>
  );
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────

function GameOverScreen({
  game,
  onPlayAgain,
  onBack,
}: {
  game: GameState;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const sorted = [...game.players].sort((a, b) => b.coins - a.coins);
  const winner = sorted[0];
  const mostDares   = [...game.players].sort((a, b) => b.dares - a.dares)[0];
  const mostRefused = [...game.players].sort((a, b) => b.refusals - a.refusals)[0];

  return (
    <ScrollView contentContainerStyle={over.container}>
      <Text style={over.confetti}>🎉🏆🎉</Text>
      <Text style={over.title}>Game Over!</Text>
      <Text style={over.winnerEmoji}>{winner.emoji}</Text>
      <Text style={over.winnerName}>{winner.name} wins!</Text>
      <Text style={over.winnerCoins}>🪙 {winner.coins} coins</Text>

      <View style={over.divider} />
      <Text style={over.sectionLabel}>FINAL STANDINGS</Text>
      {sorted.map((p, i) => (
        <View key={p.name} style={over.row}>
          <Text style={over.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</Text>
          <Text style={over.pEmoji}>{p.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={over.pName}>{p.name}</Text>
            <Text style={over.pStats}>{p.truths}T · {p.dares}D · {p.refusals} refused</Text>
          </View>
          <Text style={over.pCoins}>{p.coins} 🪙</Text>
        </View>
      ))}

      <View style={over.divider} />
      <Text style={over.sectionLabel}>FUN FACTS</Text>
      <Text style={over.fact}>🎯 Dare champion: {mostDares.name} ({mostDares.dares} dares)</Text>
      <Text style={over.fact}>😤 Most refusals: {mostRefused.name} ({mostRefused.refusals} times)</Text>
      <Text style={over.fact}>🔄 Total rounds: {game.round}</Text>

      <TouchableOpacity style={over.playAgainBtn} onPress={onPlayAgain} activeOpacity={0.85}>
        <Text style={over.playAgainBtnText}>🎰 Play Again (same players)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={over.backBtn} onPress={onBack} activeOpacity={0.85}>
        <Text style={over.backBtnText}>Back to Games</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BetGame() {
  const navigation = useNavigation<Nav>();
  const [screen, setScreen] = useState<'setup' | 'game' | 'over'>('setup');
  const [game, setGame] = useState<GameState | null>(null);

  function handleStart(players: Player[], stakes: Stakes) {
    setGame({ players, currentIndex: 0, round: 0, stakes });
    setScreen('game');
  }

  function handleEnd() {
    Alert.alert('End Game?', 'This will show the final results.', [
      { text: 'Keep Playing', style: 'cancel' },
      { text: 'End Game', style: 'destructive', onPress: () => setScreen('over') },
    ]);
  }

  function handlePlayAgain() {
    if (!game) return;
    // Reset coins and stats, keep player names/emojis and stakes
    setGame({
      ...game,
      players: game.players.map((p) => ({ ...p, coins: 500, dares: 0, truths: 0, refusals: 0 })),
      currentIndex: 0,
      round: 0,
    });
    setScreen('game');
  }

  return (
    <SafeAreaView style={styles.flex}>
      {screen === 'setup' && (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('GamesList')} style={styles.backBtn}>
              <Text style={styles.backText}>← Games</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Stake It 🎰</Text>
            <View style={{ width: 80 }} />
          </View>
          <SetupScreen onStart={handleStart} />
        </>
      )}

      {screen === 'game' && game && (
        <GameScreen game={game} setGame={setGame} onEnd={handleEnd} />
      )}

      {screen === 'over' && game && (
        <>
          <View style={styles.header}>
            <View style={{ width: 80 }} />
            <Text style={styles.headerTitle}>Results</Text>
            <View style={{ width: 80 }} />
          </View>
          <GameOverScreen
            game={game}
            onPlayAgain={handlePlayAgain}
            onBack={() => navigation.navigate('GamesList')}
          />
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {},
  backText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  headerTitle: { ...typography.heading, color: colors.text, fontWeight: '800' },
});

const setup = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.background },
  heroBox: { alignItems: 'center', marginBottom: spacing.xl, paddingVertical: spacing.lg },
  heroEmoji: { fontSize: 52, marginBottom: spacing.sm },
  heroTitle: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  heroSub:   { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },

  label: { ...typography.small, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1.2, marginBottom: spacing.sm },
  sublabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

  countRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  countBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center',
  },
  countBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  countBtnText: { ...typography.body, fontWeight: '700', color: colors.textSecondary },
  countBtnTextActive: { color: '#fff' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  nameEmoji: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    flex: 1, ...typography.body, color: colors.text,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },

  stakeInput: {
    ...typography.body, color: colors.text,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    minHeight: 60, textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  stepBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 22, color: colors.text, fontWeight: '700' },
  stepValue: {
    flex: 1, alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  stepValueText: { ...typography.body, fontWeight: '700', color: colors.text },

  spiceRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  spiceBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, gap: spacing.xs,
  },
  spiceEmoji: { fontSize: 22 },
  spiceLabel: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, marginTop: spacing.sm },
  toggleLabel: { ...typography.body, fontWeight: '700', color: colors.text },
  toggleSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  previewCard: {
    backgroundColor: colors.secondary + '10', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.secondary + '30',
    padding: spacing.md, marginTop: spacing.lg, gap: spacing.xs,
  },
  previewTitle: { ...typography.caption, fontWeight: '800', color: colors.secondary, marginBottom: spacing.xs },
  previewLine:  { ...typography.body, color: colors.text, lineHeight: 22 },

  startBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.card,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});

const sb = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  rank: { fontSize: 22, width: 36 },
  emoji: { fontSize: 24, width: 32 },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  stats: { ...typography.small, color: colors.textSecondary },
  coins: { ...typography.body, fontWeight: '700', color: colors.warning },
  closeBtn: {
    marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  closeBtnText: { ...typography.body, fontWeight: '700', color: colors.textSecondary },
});

const game_s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  passScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
    backgroundColor: '#1A1A2E',
  },
  passEmoji: { fontSize: 64, marginBottom: spacing.md },
  passTitle: { fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  passName:  { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: spacing.xs },
  passCoins: { fontSize: 18, color: colors.warning, marginBottom: spacing.xl, fontWeight: '700' },
  passBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    ...shadows.card,
  },
  passBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  endBtn: { paddingHorizontal: spacing.sm },
  endBtnText: { ...typography.caption, color: colors.error, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerName: { ...typography.body, fontWeight: '700', color: colors.text },
  headerRound: { ...typography.small, color: colors.textSecondary },
  scoreBtn: { paddingHorizontal: spacing.sm },
  scoreBtnText: { fontSize: 22 },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },

  card: {
    width: '100%', minHeight: 240, borderRadius: radius.lg,
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.modal,
  },
  cardInner: { alignItems: 'center', gap: spacing.md },
  cardQuestion: { fontSize: 80, color: 'rgba(255,255,255,0.7)', fontWeight: '900' },
  cardTap: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  cardType: { fontSize: 26, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  cardPrompt: { fontSize: 18, fontWeight: '600', textAlign: 'center', lineHeight: 26 },

  stakeReminder: {
    width: '100%', backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  stakeReminderLabel: { ...typography.small, fontWeight: '800', color: colors.textSecondary, marginBottom: 4 },
  stakeReminderText: { ...typography.body, color: colors.text, fontWeight: '600' },

  wagerRow: {
    backgroundColor: colors.warning + '25', borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  wagerText: { ...typography.body, fontWeight: '700', color: '#B7791F' },

  actionBlock: { width: '100%', gap: spacing.sm },
  raiseBtn: {
    backgroundColor: '#FDCB6E', borderRadius: radius.lg,
    paddingVertical: spacing.sm, alignItems: 'center',
    borderWidth: 2, borderColor: '#B7791F',
  },
  raiseBtnText: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  acceptRaiseBtn: {
    backgroundColor: colors.success + '20', borderRadius: radius.lg,
    paddingVertical: spacing.sm, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.success,
  },
  acceptRaiseBtnText: { ...typography.body, fontWeight: '700', color: colors.success },
  completedBtn: {
    backgroundColor: colors.success, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
    ...shadows.card,
  },
  completedBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  refuseBtn: {
    backgroundColor: colors.error + '15', borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.error,
  },
  refuseBtnText: { fontSize: 17, fontWeight: '800', color: colors.error },
});

const over = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center' },
  confetti: { fontSize: 36, marginBottom: spacing.sm },
  title:    { ...typography.heading, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  winnerEmoji: { fontSize: 64, marginBottom: spacing.xs },
  winnerName:  { fontSize: 28, fontWeight: '900', color: colors.warning },
  winnerCoins: { fontSize: 20, fontWeight: '700', color: colors.warning, marginBottom: spacing.lg },

  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  sectionLabel: { ...typography.small, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1.2, alignSelf: 'flex-start', marginBottom: spacing.sm },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, width: '100%' },
  rank: { fontSize: 22, width: 36 },
  pEmoji: { fontSize: 24, width: 32 },
  pName: { ...typography.body, fontWeight: '700', color: colors.text },
  pStats: { ...typography.small, color: colors.textSecondary },
  pCoins: { ...typography.body, fontWeight: '700', color: colors.warning },

  fact: { ...typography.body, color: colors.text, alignSelf: 'flex-start', marginBottom: spacing.xs },

  playAgainBtn: {
    width: '100%', backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl,
    ...shadows.card,
  },
  playAgainBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  backBtn: {
    width: '100%', borderRadius: radius.lg,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  backBtnText: { ...typography.body, fontWeight: '700', color: colors.textSecondary },
});
