import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  TextInput,
  Alert,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList } from '../../types';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { gameSounds } from '../../services/gameSounds';

// ─── Types ────────────────────────────────────────────────────────────────────

type UnoNavProp = NativeStackNavigationProp<GamesStackParamList, 'UnoGame'>;

type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'
  | 'wild' | 'wild4';

interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

type GamePhase = 'setup' | 'pass-device' | 'playing' | 'color-pick' | 'game-over';
type Direction = 1 | -1;

interface Player {
  name: string;
  hand: Card[];
  calledUno: boolean;
}

interface GameState {
  players: Player[];
  deck: Card[];
  discard: Card[];
  currentPlayer: number;
  direction: Direction;
  currentColor: CardColor;
  phase: GamePhase;
  winner: number | null;
  pendingWildCard: Card | null;
  message: string;
}

// ─── Card Colors ──────────────────────────────────────────────────────────────

const CARD_BG: Record<CardColor, string> = {
  red:    '#E74C3C',
  yellow: '#F1C40F',
  green:  '#27AE60',
  blue:   '#2980B9',
  wild:   '#7C3AED',
};

const CARD_LABEL_COLOR: Record<CardColor, string> = {
  red:    '#fff',
  yellow: '#1a1a1a',
  green:  '#fff',
  blue:   '#fff',
  wild:   '#fff',
};

const COLOR_DISPLAY: Record<CardColor, string> = {
  red:    '🔴 Red',
  yellow: '🟡 Yellow',
  green:  '🟢 Green',
  blue:   '🔵 Blue',
  wild:   '🌈 Wild',
};

const VALUE_SYMBOL: Record<CardValue, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  skip:    '⊘',
  reverse: '↺',
  draw2:   '+2',
  wild:    '🌈',
  wild4:   '🌈+4',
};

// ─── Deck Factory ─────────────────────────────────────────────────────────────

let cardIdCounter = 0;
function makeCard(color: CardColor, value: CardValue): Card {
  return { id: `c${++cardIdCounter}`, color, value };
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  const cardColors: Exclude<CardColor, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];
  const numbers: CardValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const specials: CardValue[] = ['skip', 'reverse', 'draw2'];

  for (const color of cardColors) {
    // One 0 per color
    deck.push(makeCard(color, '0'));
    // Two of 1-9 and specials per color
    for (const val of [...numbers.slice(1), ...specials]) {
      deck.push(makeCard(color, val));
      deck.push(makeCard(color, val));
    }
  }
  // 4 Wilds + 4 Wild Draw Fours
  for (let i = 0; i < 4; i++) {
    deck.push(makeCard('wild', 'wild'));
    deck.push(makeCard('wild', 'wild4'));
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Game Logic ───────────────────────────────────────────────────────────────

function canPlay(card: Card, topDiscard: Card, currentColor: CardColor): boolean {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topDiscard.value) return true;
  return false;
}

function hasPlayableCard(hand: Card[], topDiscard: Card, currentColor: CardColor): boolean {
  return hand.some(c => canPlay(c, topDiscard, currentColor));
}

function nextPlayerIndex(current: number, direction: Direction, playerCount: number): number {
  return ((current + direction) + playerCount) % playerCount;
}

// ─── Screen Dimensions ────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = 72;
const CARD_H = 108;
const DISCARD_W = 96;
const DISCARD_H = 144;

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface UnoCardProps {
  card: Card;
  playable?: boolean;
  onPress?: () => void;
  size?: 'normal' | 'large' | 'mini';
  faceDown?: boolean;
}

function UnoCard({ card, playable = true, onPress, size = 'normal', faceDown = false }: UnoCardProps) {
  const isLarge = size === 'large';
  const isMini = size === 'mini';
  const w = isLarge ? DISCARD_W : isMini ? 44 : CARD_W;
  const h = isLarge ? DISCARD_H : isMini ? 66 : CARD_H;
  const ovalW = isLarge ? 60 : isMini ? 28 : 44;
  const ovalH = isLarge ? 96 : isMini ? 44 : 70;
  const symbolSize = isLarge ? 28 : isMini ? 13 : 22;
  const cornerSize = isLarge ? 13 : isMini ? 9 : 11;

  if (faceDown) {
    return (
      <View style={[
        styles.card,
        { width: w, height: h, backgroundColor: '#1a1a2e', borderRadius: radius.md },
        shadows.card,
      ]}>
        <View style={[styles.cardFaceDown, { borderRadius: radius.sm }]} />
      </View>
    );
  }

  const bg = card.color === 'wild' ? '#7C3AED' : CARD_BG[card.color];
  const labelColor = CARD_LABEL_COLOR[card.color];
  const symbol = VALUE_SYMBOL[card.value];
  const isWild = card.color === 'wild';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress || !playable}
      activeOpacity={0.8}
      style={[
        styles.card,
        {
          width: w,
          height: h,
          backgroundColor: bg,
          borderRadius: radius.md,
          borderWidth: playable && onPress ? 3 : 1.5,
          borderColor: playable && onPress ? '#FFD700' : 'rgba(255,255,255,0.3)',
          opacity: onPress && !playable ? 0.45 : 1,
        },
        shadows.card,
        playable && onPress ? styles.cardGlow : null,
      ]}
    >
      {/* Wild stripes */}
      {isWild && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius.md, overflow: 'hidden', flexDirection: 'row' }]}>
          {['#E74C3C', '#F1C40F', '#27AE60', '#2980B9'].map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c, opacity: 0.6 }} />
          ))}
        </View>
      )}

      {/* Top-left corner */}
      <Text style={[styles.cardCornerText, { fontSize: cornerSize, color: labelColor, top: 4, left: 5 }]}>
        {symbol}
      </Text>

      {/* Center oval */}
      <View style={[
        styles.cardOval,
        {
          width: ovalW,
          height: ovalH,
          borderRadius: ovalW / 2,
          transform: [{ rotate: '25deg' }],
        },
      ]}>
        <Text style={[styles.cardSymbol, { fontSize: symbolSize, color: bg }]}>
          {symbol}
        </Text>
      </View>

      {/* Bottom-right corner (rotated) */}
      <Text style={[
        styles.cardCornerText,
        { fontSize: cornerSize, color: labelColor, bottom: 4, right: 5, transform: [{ rotate: '180deg' }] },
      ]}>
        {symbol}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UnoGame() {
  const navigation = useNavigation<UnoNavProp>();
  const { C } = useTheme();
  const styles = makeStyles(C);

  // ── Setup State ──
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3', 'Player 4']);

  // ── Game State ──
  const [gameState, setGameState] = useState<GameState | null>(null);

  // ── Pass-device reveal ──
  const [handRevealed, setHandRevealed] = useState(false);

  // ── Animation ──
  const confettiAnim = useRef(new Animated.Value(0)).current;

  // ─── Initialize Game ────────────────────────────────────────────────────────

  const dealCards = useCallback(() => {
    let deck = shuffle(buildDeck());
    const players: Player[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const hand = deck.slice(0, 7);
      deck = deck.slice(7);
      players.push({ name: playerNames[i] || `Player ${i + 1}`, hand, calledUno: false });
    }

    // Flip first discard card — must not be a wild
    let topCard: Card;
    let discardRest = [...deck];
    do {
      topCard = discardRest.shift()!;
      if (topCard.color === 'wild') {
        discardRest.push(topCard);
        discardRest = shuffle(discardRest);
      }
    } while (topCard.color === 'wild');

    setGameState({
      players,
      deck: discardRest,
      discard: [topCard],
      currentPlayer: 0,
      direction: 1,
      currentColor: topCard.color as CardColor,
      phase: 'pass-device',
      winner: null,
      pendingWildCard: null,
      message: '',
    });
    setHandRevealed(false);
  }, [numPlayers, playerNames]);

  // ─── Draw a Card ────────────────────────────────────────────────────────────

  const drawCards = useCallback((state: GameState, count: number): { newState: GameState; drawn: Card[] } => {
    let deck = [...state.deck];
    let discard = [...state.discard];

    if (deck.length < count) {
      // Reshuffle discard (keep top)
      const top = discard[discard.length - 1];
      const reshuffled = shuffle(discard.slice(0, discard.length - 1));
      deck = [...deck, ...reshuffled];
      discard = [top];
    }

    const drawn = deck.slice(0, count);
    return {
      newState: { ...state, deck: deck.slice(count), discard },
      drawn,
    };
  }, []);

  // ─── Play a Card ────────────────────────────────────────────────────────────

  const playCard = useCallback((cardIndex: number) => {
    if (!gameState) return;
    const state = { ...gameState };
    const player = { ...state.players[state.currentPlayer] };
    const card = player.hand[cardIndex];

    if (!canPlay(card, state.discard[state.discard.length - 1], state.currentColor)) {
      gameSounds.fire('error'); return;
    }

    // Remove card from hand
    const newHand = player.hand.filter((_, i) => i !== cardIndex);
    player.hand = newHand;

    // Check UNO penalty: if dropping to 1 card and didn't call UNO
    // (penalty applied when next player notices — simplified: auto-check)
    if (newHand.length === 1 && !player.calledUno) {
      // Will flag — handled via UI
    }
    player.calledUno = false; // reset after playing

    // Update discard
    const newDiscard = [...state.discard, card];
    const newPlayers = state.players.map((p, i) => (i === state.currentPlayer ? player : p));

    // Sound based on card type
    if (card.value === 'wild' || card.value === 'wild4') gameSounds.fire('wild');
    else if (card.value === 'skip')    gameSounds.fire('skip');
    else if (card.value === 'reverse') gameSounds.fire('reverse');
    else if (card.value === 'draw2')   gameSounds.fire('card_draw');
    else                               gameSounds.fire('card_play');

    // Check win
    if (newHand.length === 0) {
      gameSounds.fire('win');
      Animated.spring(confettiAnim, { toValue: 1, useNativeDriver: true }).start();
      setGameState({
        ...state,
        players: newPlayers,
        discard: newDiscard,
        phase: 'game-over',
        winner: state.currentPlayer,
        currentColor: card.color === 'wild' ? state.currentColor : card.color as CardColor,
      });
      return;
    }

    // UNO! sound when down to 1 card
    if (newHand.length === 1) gameSounds.fire('uno_call');

    // Apply card effects
    let direction = state.direction;
    let nextPlayer = state.currentPlayer;
    let newDeck = [...state.deck];
    let newDiscardFinal = newDiscard;
    let nextCurrentColor: CardColor = card.color === 'wild' ? state.currentColor : card.color as CardColor;

    if (card.value === 'reverse') {
      direction = (direction * -1) as Direction;
      if (numPlayers === 2) {
        // In 2-player, reverse acts as skip
        nextPlayer = state.currentPlayer; // same player goes again (after next calc below it'll be correct)
      }
    }

    // For non-reverse: advance to next player
    const advancedNext = nextPlayerIndex(state.currentPlayer, direction, numPlayers);

    if (card.value === 'skip') {
      nextPlayer = nextPlayerIndex(advancedNext, direction, numPlayers);
    } else if (card.value === 'draw2') {
      // Next player draws 2 and skips
      const { newState, drawn } = drawCards(
        { ...state, deck: newDeck, discard: newDiscardFinal, players: newPlayers },
        2,
      );
      const targetHand = [...newPlayers[advancedNext].hand, ...drawn];
      const updatedPlayers = newPlayers.map((p, i) =>
        i === advancedNext ? { ...p, hand: targetHand } : p,
      );
      nextPlayer = nextPlayerIndex(advancedNext, direction, numPlayers);
      newDeck = newState.deck;
      newDiscardFinal = newState.discard;

      setGameState({
        ...state,
        players: updatedPlayers,
        deck: newDeck,
        discard: newDiscardFinal,
        currentPlayer: nextPlayer,
        direction,
        currentColor: nextCurrentColor,
        phase: 'pass-device',
        winner: null,
        pendingWildCard: null,
        message: `${newPlayers[advancedNext].name} draws 2 and skips!`,
      });
      setHandRevealed(false);
      return;
    } else if (card.value === 'wild') {
      nextPlayer = advancedNext;
      setGameState({
        ...state,
        players: newPlayers,
        discard: newDiscardFinal,
        currentPlayer: nextPlayer,
        direction,
        currentColor: state.currentColor,
        phase: 'color-pick',
        pendingWildCard: card,
        message: '',
      });
      return;
    } else if (card.value === 'wild4') {
      // Wild4: next draws 4 and skips, current player picks color
      setGameState({
        ...state,
        players: newPlayers,
        discard: newDiscardFinal,
        currentPlayer: advancedNext,
        direction,
        currentColor: state.currentColor,
        phase: 'color-pick',
        pendingWildCard: card,
        message: '',
      });
      return;
    } else if (card.value === 'reverse') {
      if (numPlayers === 2) {
        // Acts as skip: original player goes again
        nextPlayer = state.currentPlayer;
      } else {
        nextPlayer = advancedNext;
      }
    } else {
      nextPlayer = advancedNext;
    }

    setGameState({
      ...state,
      players: newPlayers,
      discard: newDiscardFinal,
      deck: newDeck,
      currentPlayer: nextPlayer,
      direction,
      currentColor: nextCurrentColor,
      phase: 'pass-device',
      winner: null,
      pendingWildCard: null,
      message: '',
    });
    setHandRevealed(false);
  }, [gameState, numPlayers, drawCards, confettiAnim]);

  // ─── Pick Color (after Wild) ─────────────────────────────────────────────────

  const pickColor = useCallback((color: Exclude<CardColor, 'wild'>) => {
    if (!gameState) return;
    const state = { ...gameState };
    const card = state.pendingWildCard!;

    if (card.value === 'wild4') {
      // Current player in state is the "next" player who must draw 4
      const targetIdx = state.currentPlayer;
      const { newState, drawn } = drawCards(state, 4);
      const updatedPlayers = newState.players.map((p, i) =>
        i === targetIdx ? { ...p, hand: [...p.hand, ...drawn] } : p,
      );
      const skippedNext = nextPlayerIndex(targetIdx, state.direction, numPlayers);

      setGameState({
        ...newState,
        players: updatedPlayers,
        currentPlayer: skippedNext,
        currentColor: color,
        phase: 'pass-device',
        pendingWildCard: null,
        message: `${state.players[targetIdx].name} draws 4 and skips!`,
      });
    } else {
      // Regular wild
      setGameState({
        ...state,
        currentColor: color,
        phase: 'pass-device',
        pendingWildCard: null,
        message: '',
      });
    }
    setHandRevealed(false);
  }, [gameState, drawCards, numPlayers]);

  // ─── Draw Card (player action) ───────────────────────────────────────────────

  const handleDrawCard = useCallback(() => {
    if (!gameState) return;
    gameSounds.fire('card_draw');
    const state = { ...gameState };
    const { newState, drawn } = drawCards(state, 1);
    const drawnCard = drawn[0];
    const player = { ...newState.players[state.currentPlayer] };
    player.hand = [...player.hand, drawnCard];
    const updatedPlayers = newState.players.map((p, i) =>
      i === state.currentPlayer ? player : p,
    );

    // Check if drawn card is playable — if yes, player CAN play it immediately
    // For simplicity: after drawing, turn passes
    const nextPlayer = nextPlayerIndex(state.currentPlayer, state.direction, numPlayers);
    setGameState({
      ...newState,
      players: updatedPlayers,
      currentPlayer: nextPlayer,
      phase: 'pass-device',
      message: `${state.players[state.currentPlayer].name} drew a card.`,
    });
    setHandRevealed(false);
  }, [gameState, drawCards, numPlayers]);

  // ─── UNO Call ────────────────────────────────────────────────────────────────

  const callUno = useCallback(() => {
    if (!gameState) return;
    const updatedPlayers = gameState.players.map((p, i) =>
      i === gameState.currentPlayer ? { ...p, calledUno: true } : p,
    );
    setGameState({ ...gameState, players: updatedPlayers });
  }, [gameState]);

  // ─── Reset ───────────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    setGameState(null);
    confettiAnim.setValue(0);
  }, [confettiAnim]);

  // ─── Render: Setup ───────────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <View style={styles.setupContainer}>
        <StatusBar barStyle="light-content" />
        {/* Background decoration */}
        <View style={styles.setupBgCards}>
          {['#E74C3C', '#2980B9', '#27AE60', '#F1C40F', '#7C3AED'].map((c, i) => (
            <View
              key={i}
              style={[
                styles.setupBgCard,
                {
                  backgroundColor: c,
                  transform: [{ rotate: `${-30 + i * 15}deg` }],
                  top: 40 + i * 12,
                  left: SCREEN_W * 0.5 - 40 + i * 10,
                },
              ]}
            />
          ))}
        </View>

        <SafeAreaView style={styles.setupInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.setupTitle}>🃏 UNO</Text>
          <Text style={styles.setupSubtitle}>Pass & Play</Text>

          <View style={styles.setupCard}>
            <Text style={styles.setupLabel}>How many players?</Text>
            <View style={styles.playerCountRow}>
              {([2, 3, 4] as const).map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setNumPlayers(n)}
                  style={[styles.playerCountBtn, numPlayers === n && styles.playerCountBtnActive]}
                >
                  <Text style={[styles.playerCountBtnText, numPlayers === n && styles.playerCountBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.setupLabel, { marginTop: spacing.lg }]}>Player Names</Text>
            {Array.from({ length: numPlayers }).map((_, i) => (
              <View key={i} style={styles.nameInputRow}>
                <Text style={styles.nameInputLabel}>
                  {['🔴', '🔵', '🟢', '🟡'][i]}
                </Text>
                <TextInput
                  style={styles.nameInput}
                  value={playerNames[i]}
                  onChangeText={text => {
                    const next = [...playerNames];
                    next[i] = text;
                    setPlayerNames(next);
                  }}
                  placeholder={`Player ${i + 1}`}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  maxLength={16}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.dealBtn} onPress={dealCards} activeOpacity={0.85}>
              <Text style={styles.dealBtnText}>Deal Cards 🃏</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const state = gameState;
  const topDiscard = state.discard[state.discard.length - 1];
  const currentPlayer = state.players[state.currentPlayer];

  // ─── Render: Pass-Device Overlay ─────────────────────────────────────────────

  if (state.phase === 'pass-device' || state.phase === 'playing') {
    if (!handRevealed) {
      return (
        <Modal visible animationType="fade" transparent={false}>
          <View style={styles.passOverlay}>
            <View style={styles.passCard}>
              <Text style={styles.passEmoji}>📱</Text>
              <Text style={styles.passTitle}>Pass to</Text>
              <Text style={styles.passPlayerName}>{currentPlayer.name}</Text>
              {state.message ? (
                <Text style={styles.passMessage}>{state.message}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.passRevealBtn}
                onPress={() => {
                  setHandRevealed(true);
                  setGameState(s => s ? { ...s, phase: 'playing' } : s);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.passRevealBtnText}>Reveal My Hand 👀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }
  }

  // ─── Render: Color Picker ────────────────────────────────────────────────────

  if (state.phase === 'color-pick') {
    return (
      <Modal visible animationType="slide" transparent>
        <View style={styles.colorPickOverlay}>
          <View style={styles.colorPickSheet}>
            <Text style={styles.colorPickTitle}>Choose a Color</Text>
            <Text style={styles.colorPickSub}>
              {state.pendingWildCard?.value === 'wild4' ? '🌈+4 Wild Draw Four!' : '🌈 Wild Card!'}
            </Text>
            <View style={styles.colorPickGrid}>
              {(['red', 'yellow', 'green', 'blue'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorPickBtn, { backgroundColor: CARD_BG[c] }]}
                  onPress={() => pickColor(c)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.colorPickBtnText}>{COLOR_DISPLAY[c]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ─── Render: Game Over ───────────────────────────────────────────────────────

  if (state.phase === 'game-over') {
    const winner = state.players[state.winner!];
    const confetti = ['🎉', '🎊', '🌟', '✨', '🏆', '🎈', '💥', '🃏'];
    return (
      <View style={styles.gameOverContainer}>
        <SafeAreaView style={styles.gameOverInner}>
          <View style={styles.gameOverConfetti}>
            {confetti.map((e, i) => (
              <Text key={i} style={[styles.confettiEmoji, { top: 20 + (i % 3) * 30, left: 20 + i * 38 }]}>
                {e}
              </Text>
            ))}
          </View>

          <Text style={styles.gameOverEmoji}>🏆</Text>
          <Text style={styles.gameOverTitle}>Winner!</Text>
          <Text style={styles.gameOverWinner}>{winner.name}</Text>

          <View style={styles.scoreBoard}>
            <Text style={styles.scoreBoardTitle}>Remaining Cards</Text>
            {state.players.map((p, i) => (
              <View key={i} style={styles.scoreRow}>
                <Text style={styles.scorePlayerName}>
                  {['🔴', '🔵', '🟢', '🟡'][i]} {p.name}
                </Text>
                <View style={[
                  styles.scoreChip,
                  { backgroundColor: p.hand.length === 0 ? C.success : C.error },
                ]}>
                  <Text style={styles.scoreChipText}>
                    {p.hand.length === 0 ? '🏆 Winner!' : `${p.hand.length} cards`}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.gameOverBtns}>
            <TouchableOpacity style={styles.playAgainBtn} onPress={dealCards} activeOpacity={0.85}>
              <Text style={styles.playAgainBtnText}>Play Again 🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backToGamesBtn} onPress={resetGame} activeOpacity={0.85}>
              <Text style={styles.backToGamesBtnText}>Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backToGamesBtn, { marginLeft: spacing.sm }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.backToGamesBtnText}>Games</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Render: Main Playing Screen ─────────────────────────────────────────────

  const topCard = topDiscard;
  const hand = currentPlayer.hand;
  const playable = hand.map(c => canPlay(c, topCard, state.currentColor));
  const anyPlayable = playable.some(Boolean);
  const showUnoBtn = hand.length === 2;

  return (
    <View style={styles.playContainer}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Header Bar ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            Alert.alert('Quit Game?', 'Your progress will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Quit', style: 'destructive', onPress: resetGame },
            ]);
          }}>
            <Text style={styles.headerBack}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🃏 UNO</Text>
            <View style={styles.currentColorPill}>
              <Text style={styles.currentColorPillText}>
                {COLOR_DISPLAY[state.currentColor]}
              </Text>
            </View>
          </View>

          {/* Direction indicator */}
          <View style={styles.directionBadge}>
            <Text style={styles.directionText}>
              {state.direction === 1 ? '↻' : '↺'}
            </Text>
          </View>
        </View>

        {/* ── Player Turn Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.playerChipsRow}
          contentContainerStyle={{ paddingHorizontal: spacing.md }}
        >
          {state.players.map((p, i) => (
            <View
              key={i}
              style={[
                styles.playerChip,
                i === state.currentPlayer && styles.playerChipActive,
              ]}
            >
              <Text style={styles.playerChipEmoji}>{['🔴', '🔵', '🟢', '🟡'][i]}</Text>
              <Text style={[
                styles.playerChipName,
                i === state.currentPlayer && styles.playerChipNameActive,
              ]}>
                {p.name}
              </Text>
              <View style={[
                styles.playerChipCount,
                p.hand.length === 1 ? styles.playerChipCountUno : null,
              ]}>
                <Text style={styles.playerChipCountText}>{p.hand.length}</Text>
              </View>
              {p.hand.length === 1 && (
                <Text style={styles.unoTag}>UNO!</Text>
              )}
            </View>
          ))}
        </ScrollView>

        {/* ── Center Play Area ── */}
        <View style={styles.centerArea}>
          {/* Draw Pile */}
          <TouchableOpacity
            style={styles.drawPileWrapper}
            onPress={handleDrawCard}
            disabled={anyPlayable}
            activeOpacity={0.8}
          >
            <View style={[styles.drawPile, { opacity: anyPlayable ? 0.5 : 1 }]}>
              {[2, 1, 0].map(offset => (
                <View
                  key={offset}
                  style={[
                    styles.deckStackCard,
                    { bottom: offset * 3, right: -offset * 3 },
                  ]}
                />
              ))}
              <Text style={styles.drawPileLabel}>DRAW</Text>
              <Text style={styles.drawPileCount}>{state.deck.length}</Text>
            </View>
            {!anyPlayable && (
              <View style={styles.drawPileGlow} />
            )}
          </TouchableOpacity>

          {/* Discard Pile */}
          <View style={styles.discardWrapper}>
            <UnoCard card={topCard} size="large" />
            <Text style={styles.discardLabel}>DISCARD</Text>
          </View>
        </View>

        {/* ── Action Buttons Row ── */}
        <View style={styles.actionRow}>
          {showUnoBtn && (
            <TouchableOpacity
              style={[
                styles.unoCallBtn,
                currentPlayer.calledUno && styles.unoCallBtnActive,
              ]}
              onPress={callUno}
              activeOpacity={0.85}
            >
              <Text style={styles.unoCallBtnText}>
                {currentPlayer.calledUno ? '✅ UNO Called!' : '🔔 Call UNO!'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Player's Hand ── */}
        <View style={styles.handSection}>
          <Text style={styles.handLabel}>{currentPlayer.name}'s Hand ({hand.length} cards)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handScroll}
          >
            {hand.map((card, i) => (
              <View key={card.id} style={styles.handCardWrapper}>
                <UnoCard
                  card={card}
                  playable={playable[i]}
                  onPress={() => playCard(i)}
                />
              </View>
            ))}
          </ScrollView>

          {!anyPlayable && (
            <TouchableOpacity style={styles.drawHintBtn} onPress={handleDrawCard} activeOpacity={0.85}>
              <Text style={styles.drawHintText}>No playable cards — Tap to Draw ⬆️</Text>
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>

      {/* ─── Color picker modal (rendered on top when needed) ─── */}
      <Modal
        visible={(state.phase as string) === 'color-pick'}
        animationType="slide"
        transparent
      >
        <View style={styles.colorPickOverlay}>
          <View style={styles.colorPickSheet}>
            <Text style={styles.colorPickTitle}>Choose a Color</Text>
            <Text style={styles.colorPickSub}>
              {state.pendingWildCard?.value === 'wild4' ? '🌈+4 Wild Draw Four!' : '🌈 Wild Card!'}
            </Text>
            <View style={styles.colorPickGrid}>
              {(['red', 'yellow', 'green', 'blue'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorPickBtn, { backgroundColor: CARD_BG[c] }]}
                  onPress={() => pickColor(c)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.colorPickBtnText}>{COLOR_DISPLAY[c]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({

  // ── Card Component ──

  card: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cardFaceDown: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardOval: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSymbol: {
    fontWeight: '900',
    textAlign: 'center',
  },
  cardCornerText: {
    position: 'absolute',
    fontWeight: '900',
  },
  cardGlow: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 12,
  },

  // ── Setup Screen ──

  setupContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  setupBgCards: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    overflow: 'hidden',
  },
  setupBgCard: {
    position: 'absolute',
    width: CARD_W * 1.2,
    height: CARD_H * 1.2,
    borderRadius: radius.md,
    opacity: 0.35,
  },
  setupInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
  },
  setupTitle: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 4,
    textShadowColor: C.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  setupSubtitle: {
    ...typography.heading,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: spacing.xl,
    letterSpacing: 2,
  },
  setupCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  setupLabel: {
    ...typography.body,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.sm,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  playerCountRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  playerCountBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  playerCountBtnActive: {
    borderColor: C.primary,
    backgroundColor: C.primary,
  },
  playerCountBtnText: {
    fontSize: 26,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
  },
  playerCountBtnTextActive: {
    color: '#fff',
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nameInputLabel: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  nameInput: {
    flex: 1,
    ...typography.body,
    color: '#fff',
    paddingVertical: spacing.sm,
  },
  dealBtn: {
    backgroundColor: C.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.modal,
  },
  dealBtnText: {
    ...typography.heading,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ── Pass Device Overlay ──

  passOverlay: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  passCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...shadows.modal,
  },
  passEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  passTitle: {
    ...typography.heading,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: spacing.xs,
  },
  passPlayerName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  passMessage: {
    ...typography.body,
    color: C.warning,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  passRevealBtn: {
    backgroundColor: C.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    ...shadows.card,
  },
  passRevealBtnText: {
    ...typography.heading,
    color: '#fff',
    fontWeight: '800',
  },

  // ── Color Picker ──

  colorPickOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  colorPickSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    ...shadows.modal,
  },
  colorPickTitle: {
    ...typography.title,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  colorPickSub: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  colorPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorPickBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadows.card,
  },
  colorPickBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Game Over ──

  gameOverContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  gameOverInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  gameOverConfetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  confettiEmoji: {
    position: 'absolute',
    fontSize: 28,
  },
  gameOverEmoji: {
    fontSize: 80,
    marginBottom: spacing.sm,
  },
  gameOverTitle: {
    ...typography.title,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  gameOverWinner: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFD700',
    marginBottom: spacing.xl,
    textAlign: 'center',
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  scoreBoard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreBoardTitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  scorePlayerName: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  scoreChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scoreChipText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
  },
  gameOverBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playAgainBtn: {
    backgroundColor: C.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadows.card,
  },
  playAgainBtnText: {
    ...typography.heading,
    color: '#fff',
    fontWeight: '800',
  },
  backToGamesBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  backToGamesBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },

  // ── Playing Screen ──

  playContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBack: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
    padding: spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.heading,
    color: '#fff',
    fontWeight: '900',
  },
  currentColorPill: {
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  currentColorPillText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
  },
  directionBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '900',
  },

  // Player chips
  playerChipsRow: {
    maxHeight: 60,
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  playerChipActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  playerChipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  playerChipName: {
    ...typography.small,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    marginRight: 4,
  },
  playerChipNameActive: {
    color: '#fff',
  },
  playerChipCount: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  playerChipCountUno: {
    backgroundColor: C.error,
  },
  playerChipCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
  },
  unoTag: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '900',
    color: '#FFD700',
  },

  // Center play area
  centerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  drawPileWrapper: {
    position: 'relative',
  },
  drawPile: {
    width: DISCARD_W,
    height: DISCARD_H,
    backgroundColor: '#1a1a3e',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...shadows.card,
  },
  deckStackCard: {
    position: 'absolute',
    width: DISCARD_W,
    height: DISCARD_H,
    borderRadius: radius.md,
    backgroundColor: '#16163a',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  drawPileLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '800',
    letterSpacing: 1,
    zIndex: 1,
  },
  drawPileCount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    zIndex: 1,
  },
  drawPileGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radius.md + 4,
    borderWidth: 3,
    borderColor: '#FFD700',
    opacity: 0.7,
  },
  discardWrapper: {
    alignItems: 'center',
  },
  discardLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  unoCallBtn: {
    backgroundColor: 'rgba(255, 75, 110, 0.2)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: C.primary,
  },
  unoCallBtnActive: {
    backgroundColor: C.success,
    borderColor: C.success,
  },
  unoCallBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '800',
  },

  // Hand
  handSection: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  handLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  handScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  handCardWrapper: {
    marginHorizontal: 3,
  },
  drawHintBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  drawHintText: {
    ...typography.caption,
    color: '#FFD700',
    fontWeight: '700',
  },
  });
}
