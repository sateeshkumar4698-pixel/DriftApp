import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ref as rtdbRef, set as rtdbSet, update as rtdbUpdate, onValue } from 'firebase/database';
import { getDoc, doc } from 'firebase/firestore';
import { rtdb, db } from '../../config/firebase';
import { GameRoom } from '../../types';
import { GamesStackParamList } from '../../types';
import { useTheme, AppColors } from '../../utils/useTheme';
import { gameSounds } from '../../services/gameSounds';
import { useAuthStore } from '../../store/authStore';
import GameChatVoice from '../../components/GameChatVoice';

// ─── Board dimensions ──────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_W - 12, 400);
const CELL       = Math.floor(BOARD_SIZE / 15);
const BOARD_PX   = CELL * 15;
const PIECE_SIZE = Math.max(CELL - 8, 14);
const COIN_INNER = Math.round(PIECE_SIZE * 0.56);

// ─── Main path (52 cells, clockwise) ─────────────────────────────────────────
const MAIN_PATH: [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],
];

const SAFE_IDX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ─── Types ────────────────────────────────────────────────────────────────────
type PlayerColor = 'red' | 'green';
type Phase       = 'idle' | 'rolling' | 'rolled' | 'moving' | 'won';

interface PConfig {
  entry:   number;
  yard:    [number, number][];
  homeRun: [number, number][];
  color:   string;
  dark:    string;
  mid:     string;
  light:   string;
  label:   string;
  emoji:   string;
}

interface Piece {
  id:    string;
  color: PlayerColor;
  idx:   number;
  steps: number; // -1=yard  0-51=path  52-56=homeRun  57=done
}

interface GS {
  pieces:    Piece[];
  turn:      PlayerColor;
  dice:      number | null;
  phase:     Phase;
  winner:    PlayerColor | null;
  bonusRoll: boolean;
  msg:       string;
}

// ─── Player configs ────────────────────────────────────────────────────────────
const P: Record<PlayerColor, PConfig> = {
  red: {
    entry: 0,
    yard:    [[10,1],[10,3],[12,1],[12,3]],
    homeRun: [[7,1],[7,2],[7,3],[7,4],[7,5]],
    color: '#E53935', dark: '#B71C1C', mid: '#EF5350', light: '#FFEBEE',
    label: 'Red', emoji: '🔴',
  },
  green: {
    entry: 26,
    yard:    [[2,11],[2,13],[4,11],[4,13]],
    homeRun: [[7,13],[7,12],[7,11],[7,10],[7,9]],
    color: '#2E7D32', dark: '#1B5E20', mid: '#43A047', light: '#E8F5E9',
    label: 'Green', emoji: '🟢',
  },
};

// ─── Dice dot layout ──────────────────────────────────────────────────────────
const DOT_MAP: Record<number, [number, number][]> = {
  1: [[1,1]],
  2: [[0,2],[2,0]],
  3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]],
  5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
};

// ─── Game logic ───────────────────────────────────────────────────────────────
const rollDice = () => Math.floor(Math.random() * 6) + 1;

function makePieces(): Piece[] {
  const out: Piece[] = [];
  (['red','green'] as PlayerColor[]).forEach(c =>
    [0,1,2,3].forEach(i => out.push({ id:`${c}-${i}`, color:c, idx:i, steps:-1 }))
  );
  return out;
}

function coordOf(piece: Piece): [number,number] | null {
  const cfg = P[piece.color];
  if (piece.steps < 0)   return cfg.yard[piece.idx];
  if (piece.steps >= 57) return null;
  if (piece.steps >= 52) return cfg.homeRun[piece.steps - 52] ?? null;
  return MAIN_PATH[(cfg.entry + piece.steps) % 52];
}

function stepCoord(color: PlayerColor, steps: number): [number,number] | null {
  const cfg = P[color];
  if (steps < 0 || steps >= 57) return null;
  if (steps >= 52) return cfg.homeRun[steps - 52] ?? null;
  return MAIN_PATH[(cfg.entry + steps) % 52];
}

function eligiblePieces(pieces: Piece[], turn: PlayerColor, dice: number): Piece[] {
  return pieces.filter(p => {
    if (p.color !== turn || p.steps >= 57) return false;
    if (p.steps === -1) return dice === 6;
    return p.steps + dice <= 57;
  });
}

function applyMove(pieces: Piece[], moving: Piece, dice: number) {
  const newSteps = moving.steps === -1 ? 0 : moving.steps + dice;
  let next = pieces.map(p => p.id === moving.id ? { ...p, steps: newSteps } : p);
  let captured = false;
  if (newSteps >= 0 && newSteps < 52) {
    const cfg     = P[moving.color];
    const landIdx = (cfg.entry + newSteps) % 52;
    if (!SAFE_IDX.has(landIdx)) {
      const [lr, lc] = MAIN_PATH[landIdx];
      next = next.map(p => {
        if (p.color === moving.color || p.id === moving.id) return p;
        if (p.steps < 0 || p.steps >= 52) return p;
        const oc = P[p.color];
        const [or, oc2] = MAIN_PATH[(oc.entry + p.steps) % 52];
        if (or === lr && oc2 === lc) { captured = true; return { ...p, steps: -1 }; }
        return p;
      });
    }
  }
  return { pieces: next, captured };
}

function checkWin(pieces: Piece[], player: PlayerColor) {
  return pieces.filter(p => p.color === player).every(p => p.steps >= 57);
}

// ─── Board helpers ────────────────────────────────────────────────────────────
const SAFE_CELLS = (() => {
  const s = new Set<string>();
  SAFE_IDX.forEach(i => { const [r,c] = MAIN_PATH[i]; s.add(`${r},${c}`); });
  return s;
})();

function cellBg(r: number, c: number): string {
  if (SAFE_CELLS.has(`${r},${c}`))          return '#FFF59D';
  if (r>=9&&r<=14&&c>=0&&c<=5)              return '#FFCDD2';
  if (r>=0&&r<=5&&c>=0&&c<=5)              return '#BBDEFB';
  if (r>=0&&r<=5&&c>=9&&c<=14)             return '#C8E6C9';
  if (r>=9&&r<=14&&c>=9&&c<=14)            return '#FFF9C4';
  if (r===7&&c>=1&&c<=5)                    return '#FFCDD2';
  if (r===7&&c>=9&&c<=13)                   return '#C8E6C9';
  if (c===7&&r>=1&&r<=5)                    return '#BBDEFB';
  if (c===7&&r>=9&&r<=13)                   return '#FFF9C4';
  if (r>=6&&r<=8&&c>=6&&c<=8)              return '#EDE7F6';
  return '#FAFAFA';
}

// Absolute pixel position of a coin's top-left corner in the board
function cellXY(r: number, c: number) {
  return {
    x: c * CELL + (CELL - PIECE_SIZE) / 2,
    y: r * CELL + (CELL - PIECE_SIZE) / 2,
  };
}

function stackOffset(groupLen: number, idx: number) {
  const OFF = groupLen > 1 ? PIECE_SIZE * 0.27 : 0;
  let ox = 0, oy = 0;
  if (groupLen === 2) { ox = (idx === 0 ? -1 : 1) * OFF; }
  if (groupLen >= 3)  { ox = (idx%2===0?-1:1)*OFF; oy = (idx<2?-1:1)*OFF; }
  return { ox, oy };
}

// ─── Premium Dice ─────────────────────────────────────────────────────────────
// Visual improvements:
//  • Larger (90px) dark-gradient face with rounded corners
//  • Glowing colored dots per face value
//  • Animated glow ring that pulses during roll
//  • Number label underneath
//  • Landing impact ring (scale-out animation)
const DS    = 90;
const DPAD  = 10;
const CELLD_SIZE = (DS - DPAD * 2) / 3;
const DOTD  = Math.round(CELLD_SIZE * 0.60);

const ROT_X_REST = 0.37;

// Dot color per face value — each value gets its own color for personality
const DOT_COLORS: Record<number, string> = {
  1: '#FF4B6E',
  2: '#6C5CE7',
  3: '#00D2FF',
  4: '#00E676',
  5: '#FFD700',
  6: '#FF8C00',
};

interface DiceProps {
  value:    number | null;
  rollSc:   Animated.Value;
  rotY:     Animated.Value;
  rotX:     Animated.Value;
  faceFlip: Animated.Value;
  onRoll:   () => void;
  isRolling?: boolean;  // NEW — drives glow ring animation
}

function Dice3D({ value, rollSc, rotY, rotX, faceFlip, onRoll, isRolling }: DiceProps) {
  const dots     = value ? (DOT_MAP[value] ?? []) : [];
  const dotColor = value ? (DOT_COLORS[value] ?? '#FFFFFF') : '#666688';

  // Glow ring animation
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRolling) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [isRolling, glowAnim]);

  const rotYDeg = rotY.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotXDeg = rotX.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '-40deg'],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 0.8],
  });
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1], outputRange: [1, 1.35],
  });

  return (
    <TouchableOpacity onPress={onRoll} activeOpacity={0.75}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        {/* Glow ring behind the dice */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{
            width: DS + 20, height: DS + 20,
            borderRadius: (DS + 20) / 2,
            backgroundColor: dotColor,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }} />
        </View>

        {/* 3D dice body */}
        <Animated.View style={{
          width: DS, height: DS,
          transform: [
            { perspective: 400 },
            { rotateX: rotXDeg },
            { rotateY: rotYDeg },
            { scale:   rollSc  },
          ],
        }}>
          {/* Inner face: scaleX flip to swap dots */}
          <Animated.View style={[dSt.face, { transform: [{ scaleX: faceFlip }] }]}>
            {/* Dark gradient background rendered as solid color (LinearGradient needs no driver) */}
            <View style={dSt.faceInner}>
              <View style={dSt.grid}>
                {([0,1,2] as const).map(r => (
                  <View key={r} style={dSt.row}>
                    {([0,1,2] as const).map(c => {
                      const on = dots.some(([dr,dc]) => dr===r && dc===c);
                      return (
                        <View key={c} style={dSt.cell}>
                          {on ? (
                            <View style={[dSt.dot, {
                              backgroundColor: dotColor,
                              shadowColor: dotColor,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 1,
                              shadowRadius: 6,
                            }]} />
                          ) : (
                            <View style={dSt.empty} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Corner gloss highlight */}
              <View style={dSt.gloss} pointerEvents="none" />
              {/* Bottom-right shadow accent */}
              <View style={dSt.shadow} pointerEvents="none" />
            </View>
          </Animated.View>
        </Animated.View>

        {/* Number label below — shows settled value */}
        {value !== null && !isRolling && (
          <View style={[dSt.numBadge, { backgroundColor: dotColor + '25', borderColor: dotColor + '60' }]}>
            <Text style={[dSt.numText, { color: dotColor }]}>{value}</Text>
          </View>
        )}
        {isRolling && (
          <View style={[dSt.numBadge, { backgroundColor: '#ffffff10', borderColor: '#ffffff20' }]}>
            <Text style={[dSt.numText, { color: '#888' }]}>•••</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const dSt = StyleSheet.create({
  face: {
    width: DS, height: DS,
    borderRadius: 18,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  faceInner: {
    flex: 1,
    backgroundColor: '#1A1A3E',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#3A3A6A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  grid: { gap: 3 },
  row:  { flexDirection: 'row', gap: 3 },
  cell: { width: CELLD_SIZE, height: CELLD_SIZE, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOTD, height: DOTD, borderRadius: DOTD / 2,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  empty: { width: DOTD, height: DOTD },
  gloss: {
    position: 'absolute', top: 7, left: 8,
    width: DS * 0.32, height: DS * 0.14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-22deg' }],
  },
  shadow: {
    position: 'absolute', bottom: 6, right: 7,
    width: DS * 0.28, height: DS * 0.12,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    transform: [{ rotate: '-22deg' }],
  },
  numBadge: {
    paddingHorizontal: 14, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  numText: { fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});

// ─── 3D Coin ──────────────────────────────────────────────────────────────────
interface CoinProps {
  piece:      Piece;
  isEligible: boolean;
  pulseAnim:  Animated.Value;
  onPress:    () => void;
}

function Coin({ piece, isEligible, pulseAnim, onPress }: CoinProps) {
  const cfg    = P[piece.color];
  const inYard = piece.steps < 0;

  return (
    <TouchableOpacity
      activeOpacity={isEligible ? 0.6 : 1}
      onPress={onPress}
      style={{ width: PIECE_SIZE, height: PIECE_SIZE }}
    >
      {/* Native-driver scale animation only — no position props here */}
      <Animated.View style={[
        coinSt.outer,
        {
          width: PIECE_SIZE, height: PIECE_SIZE,
          borderRadius: PIECE_SIZE / 2,
          backgroundColor: inYard ? cfg.light : cfg.color,
          borderWidth: isEligible ? 2.5 : 1.5,
          borderColor: isEligible ? '#FFD700' : inYard ? cfg.color : 'rgba(255,255,255,0.5)',
          transform: [{ scale: isEligible ? pulseAnim : 1 }],
        },
      ]}>
        <View style={[
          coinSt.inner,
          {
            width: COIN_INNER, height: COIN_INNER,
            borderRadius: COIN_INNER / 2,
            backgroundColor: inYard ? cfg.mid : cfg.dark,
          },
        ]}>
          <Text style={[coinSt.num, { fontSize: Math.max(COIN_INNER * 0.44, 7) }]}>
            {piece.idx + 1}
          </Text>
        </View>
        <View style={coinSt.shine} />
        <View style={[coinSt.rim, { borderRadius: PIECE_SIZE / 2 }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const coinSt = StyleSheet.create({
  outer: {
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:0.45,shadowRadius:4 },
      android: { elevation: 7 },
    }),
  },
  inner: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  num: {
    color: '#FFFFFF', fontWeight: '900', textAlign: 'center',
    includeFontPadding: false, textAlignVertical: 'center',
  },
  shine: {
    position: 'absolute', top: '10%', left: '18%',
    width: PIECE_SIZE * 0.36, height: PIECE_SIZE * 0.18,
    borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.42)',
    transform: [{ rotate: '-15deg' }],
  },
  rim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
});

// ─── Player card ──────────────────────────────────────────────────────────────
function PlayerCard({ color, pieces, isActive }: {
  color: PlayerColor; pieces: Piece[]; isActive: boolean;
}) {
  const cfg  = P[color];
  const done = pieces.filter(p => p.steps >= 57).length;
  return (
    <View style={[pSt.card, { borderColor: isActive ? cfg.color : '#E5E7EB' }, isActive && { backgroundColor: cfg.light }]}>
      {isActive && <View style={[pSt.dot, { backgroundColor: cfg.color }]} />}
      <Text style={pSt.emoji}>{cfg.emoji}</Text>
      <Text style={[pSt.name, isActive && { color: cfg.color }]}>{cfg.label}</Text>
      <View style={pSt.pips}>
        {pieces.map((p, i) => (
          <View key={i} style={[
            pSt.pip,
            p.steps >= 57 && { backgroundColor: cfg.color, borderColor: cfg.color },
            p.steps >= 0 && p.steps < 57 && { borderColor: cfg.color, backgroundColor: cfg.light },
          ]} />
        ))}
      </View>
      <Text style={[pSt.score, { color: cfg.color }]}>{done}/4</Text>
    </View>
  );
}

const pSt = StyleSheet.create({
  card: {
    flex: 1, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6,
    borderRadius: 14, borderWidth: 2, backgroundColor: '#FFF', position: 'relative',
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.06,shadowRadius:4 },
      android: { elevation: 2 },
    }),
  },
  dot:   { position:'absolute', top:5, right:5, width:7, height:7, borderRadius:4 },
  emoji: { fontSize: 22, marginBottom: 2 },
  name:  { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 5 },
  pips:  { flexDirection: 'row', gap: 4, marginBottom: 3 },
  pip:   { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#D1D5DB' },
  score: { fontSize: 11, fontWeight: '900' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
type NavProp = NativeStackNavigationProp<GamesStackParamList, 'LudoGame'>;

const INIT_GS: GS = {
  pieces: makePieces(), turn: 'red', dice: null,
  phase: 'idle', winner: null, bonusRoll: false,
  msg: '🔴 Red — roll the dice!',
};

export default function LudoGame(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RouteProp<GamesStackParamList, 'LudoGame'>>();
  const roomId     = route.params?.roomId;
  const { C } = useTheme();
  const st = makeStyles(C);
  const { firebaseUser, userProfile } = useAuthStore();

  const [gs, setGs]          = useState<GS>(INIT_GS);
  const [displayDice, setDD] = useState<number | null>(null);

  // ── Multiplayer sync state ─────────────────────────────────────────────────
  const [myColor,   setMyColor]   = useState<PlayerColor | null>(null);
  const myColorRef = useRef<PlayerColor | null>(null);
  const isHostRef  = useRef(false);
  const suppressRemoteRef = useRef(false); // true while we're writing our own state

  // ── Piece animations — translateX/Y only (NOT left/top) ─────────────────────
  // Stores absolute board-pixel position; applied via transform, not layout props
  const pieceAnims = useRef<Record<string, { x: Animated.Value; y: Animated.Value }>>({});
  const movingId   = useRef<string | null>(null);

  function ensureAnim(piece: Piece) {
    if (!pieceAnims.current[piece.id]) {
      const coord = coordOf(piece);
      const pos   = coord ? cellXY(coord[0], coord[1]) : { x: -300, y: -300 };
      pieceAnims.current[piece.id] = {
        x: new Animated.Value(pos.x),
        y: new Animated.Value(pos.y),
      };
    }
  }

  function snapToCoord(piece: Piece) {
    ensureAnim(piece);
    const a = pieceAnims.current[piece.id];
    const coord = coordOf(piece);
    if (!coord) { a.x.setValue(-300); a.y.setValue(-300); return; }
    const { x, y } = cellXY(coord[0], coord[1]);
    a.x.setValue(x);
    a.y.setValue(y);
  }

  // Init on mount
  useEffect(() => {
    gs.pieces.forEach(ensureAnim);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Multiplayer: assign colors + init RTDB state (host only) ─────────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    let cancelled = false;

    getDoc(doc(db, 'gameRooms', roomId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const room = snap.data() as GameRoom;
      const players = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);

      // Assign colors: host = red, joiner = green
      const colorMap: Record<string, PlayerColor> = {};
      players.forEach((p, i) => { colorMap[p.uid] = i === 0 ? 'red' : 'green'; });

      const me = colorMap[firebaseUser.uid] ?? 'red';
      setMyColor(me);
      myColorRef.current = me;
      isHostRef.current  = room.hostUid === firebaseUser.uid;

      // Host initialises RTDB game state
      if (room.hostUid === firebaseUser.uid) {
        const initPieces = makePieces();
        const initState = {
          pieces:     initPieces,
          turnColor:  'red' as PlayerColor,
          dice:       null,
          phase:      'idle',
          winner:     null,
          bonusRoll:  false,
          msg:        '🔴 Red — roll the dice!',
          players:    colorMap,
          updatedBy:  firebaseUser.uid,
          updatedAt:  Date.now(),
        };
        rtdbSet(rtdbRef(rtdb, `gameRooms/${roomId}/ludo`), initState).catch(console.error);
        setGs({ ...INIT_GS, pieces: initPieces });
      }
    }).catch(console.error);

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Multiplayer: subscribe to remote state changes ───────────────────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;

    const r = rtdbRef(rtdb, `gameRooms/${roomId}/ludo`);
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as {
        pieces: Piece[]; turnColor: PlayerColor; dice: number | null;
        phase: Phase; winner: PlayerColor | null; bonusRoll: boolean;
        msg: string; updatedBy: string;
      };

      // Skip echo from our own writes
      if (data.updatedBy === firebaseUser.uid) return;

      suppressRemoteRef.current = true;
      setGs(prev => ({
        ...prev,
        pieces:    data.pieces,
        turn:      data.turnColor,
        dice:      data.dice,
        phase:     data.phase,
        winner:    data.winner,
        bonusRoll: data.bonusRoll,
        msg:       data.msg,
      }));
      if (data.dice !== null) setDD(data.dice); else setDD(null);
      suppressRemoteRef.current = false;
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, firebaseUser?.uid]);

  // Sync non-moving pieces when state changes
  useEffect(() => {
    gs.pieces.forEach(p => {
      if (p.id === movingId.current) return;
      snapToCoord(p);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.pieces]);

  // ── Dice animations (all useNativeDriver:true — transforms only) ──────────────
  const diceScale = useRef(new Animated.Value(1)).current;  // overall scale
  const diceRotY  = useRef(new Animated.Value(0)).current;  // 0→1 = one full 360° spin (continuous)
  const diceRotX  = useRef(new Animated.Value(ROT_X_REST)).current;  // persistent -15° tilt; 1 = max -40°
  const faceFlip  = useRef(new Animated.Value(1)).current;  // scaleX flip on each face change

  // ── UI animations ─────────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const winAnim   = useRef(new Animated.Value(0)).current;
  const msgFade   = useRef(new Animated.Value(1)).current;
  const turnScale = useRef(new Animated.Value(1)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;

  const pulseRef    = useRef<Animated.CompositeAnimation | null>(null);
  const autoRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollTimers  = useRef<ReturnType<typeof setTimeout>[]>([]);  // deceleration timeouts

  // Cancel all pending roll timers
  function clearRollTimers() {
    rollTimers.current.forEach(clearTimeout);
    rollTimers.current = [];
  }

  useEffect(() => {
    gameSounds.preload(['dice_roll','piece_move','capture','six_rolled','home','win','turn_change','error']);
    return () => { gameSounds.unloadAll(); };
  }, []);

  const flashMsg = useCallback(() => {
    msgFade.setValue(0.2);
    Animated.timing(msgFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [msgFade]);

  const bounceTurn = useCallback(() => {
    Animated.sequence([
      Animated.timing(turnScale, { toValue: 1.22, duration: 130, useNativeDriver: true }),
      Animated.spring (turnScale, { toValue: 1, friction: 5,  useNativeDriver: true }),
    ]).start();
  }, [turnScale]);

  const startPulse = useCallback(() => {
    pulseRef.current?.stop();
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.28, duration: 370, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 370, useNativeDriver: true }),
    ]));
    pulseRef.current = a;
    a.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseRef.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // ── Step-by-step piece movement ───────────────────────────────────────────────
  // Uses useNativeDriver:false on x/y because they're plain Animated.Values
  // used as translateX/translateY (layout-independent numeric values)
  function animateMove(piece: Piece, fromSteps: number, toSteps: number, cb: () => void) {
    ensureAnim(piece);
    const anim = pieceAnims.current[piece.id];
    movingId.current = piece.id;

    const clampTo  = Math.min(toSteps, 56);
    const steps: Animated.CompositeAnimation[] = [];
    let finalCoord: [number,number] | null = null;

    // For yard exit: single jump to entry cell
    if (fromSteps === -1) {
      const coord = stepCoord(piece.color, 0);
      if (coord) {
        finalCoord = coord;
        const { x, y } = cellXY(coord[0], coord[1]);
        steps.push(Animated.parallel([
          Animated.timing(anim.x, { toValue: x, duration: 200, useNativeDriver: false }),
          Animated.timing(anim.y, { toValue: y, duration: 200, useNativeDriver: false }),
        ]));
      }
    } else {
      for (let s = fromSteps + 1; s <= clampTo; s++) {
        const coord = stepCoord(piece.color, s);
        if (!coord) continue;
        finalCoord = coord;
        const { x, y } = cellXY(coord[0], coord[1]);
        steps.push(Animated.parallel([
          Animated.timing(anim.x, { toValue: x, duration: 115, useNativeDriver: false }),
          Animated.timing(anim.y, { toValue: y, duration: 115, useNativeDriver: false }),
        ]));
      }
    }

    if (steps.length === 0) { movingId.current = null; cb(); return; }

    Animated.sequence(steps).start(() => {
      if (finalCoord) {
        const { y: fy } = cellXY(finalCoord[0], finalCoord[1]);
        // Landing bounce — pure JS driver, no conflict
        Animated.sequence([
          Animated.timing(anim.y, { toValue: fy - 8, duration: 85, useNativeDriver: false }),
          Animated.spring (anim.y, { toValue: fy, friction: 6, tension: 220, useNativeDriver: false }),
        ]).start(() => { movingId.current = null; cb(); });
      } else {
        movingId.current = null;
        cb();
      }
    });
  }

  // ── Phase effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gs.phase !== 'rolled') { stopPulse(); return; }
    const elig = eligiblePieces(gs.pieces, gs.turn, gs.dice!);

    if (elig.length === 0) {
      gameSounds.fire('error');
      flashMsg();
      const t = setTimeout(() => {
        const next: PlayerColor = gs.turn === 'red' ? 'green' : 'red';
        gameSounds.fire('turn_change');
        bounceTurn();
        setGs(prev => ({
          ...prev, turn: next, dice: null, phase: 'idle', bonusRoll: false,
          msg: `${P[next].emoji} ${P[next].label} — roll the dice!`,
        }));
        setDD(null);
      }, 1400);
      return () => clearTimeout(t);
    }

    if (elig.length === 1) {
      flashMsg();
      autoRef.current = setTimeout(() => doMove(elig[0]), 480);
      return () => { if (autoRef.current) clearTimeout(autoRef.current); };
    }

    startPulse();
    flashMsg();
    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase, gs.dice, gs.turn]);

  useEffect(() => {
    if (gs.winner) {
      gameSounds.fire('win');
      Animated.spring(winAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    }
  }, [gs.winner, winAnim]);

  useEffect(() => { bounceTurn(); }, []);

  // ── Roll — physics deceleration: fast tumble → slow → settle ─────────────────
  //
  // Face changes use variable-delay setTimeout (not setInterval) so the gap
  // between changes slows down naturally — exactly like a real dice decelerating.
  //
  // Rotation uses Animated.sequence with distinct fast/slow/settle phases.
  // Face flip (scaleX: 1→0→1) fires on EVERY face change so you see the face
  // "flip over" to the new value — clearest at the slow phase.
  //
  // Tap the dice OR the Roll button — both call handleRoll.
  // ── Write local GS snapshot to RTDB (multiplayer) ────────────────────────────
  function syncToRTDB(patch: Partial<GS> & { turnColor?: PlayerColor }) {
    if (!roomId || !firebaseUser) return;
    rtdbUpdate(rtdbRef(rtdb, `gameRooms/${roomId}/ludo`), {
      ...patch,
      updatedBy: firebaseUser.uid,
      updatedAt: Date.now(),
    }).catch(console.error);
  }

  const handleRoll = useCallback(() => {
    if (gs.phase !== 'idle') return;
    // In multiplayer: only let the player whose color matches the current turn roll
    if (roomId && myColorRef.current && gs.turn !== myColorRef.current) return;

    const value = rollDice();
    gameSounds.fire('dice_roll');
    setGs(prev => ({ ...prev, phase: 'rolling' }));
    clearRollTimers();

    // ── Face-change schedule (ms gaps between each change) ─────────────────────
    // Starts fast, slows exponentially — mirrors real dice physics
    const gaps = [55,55,58,62,68,75,85,100,118,140,168,200,240];
    //            ←── fast scramble ──→  ←── deceleration ──→  ← settle →

    let elapsed = 0;
    gaps.forEach((gap, i) => {
      elapsed += gap;
      const t = setTimeout(() => {
        const face = Math.floor(Math.random() * 6) + 1;
        setDD(face);

        // Flip animation speed also slows with each change
        const flipMs = Math.min(30 + i * 8, 80);
        Animated.sequence([
          Animated.timing(faceFlip, { toValue: 0.05, duration: flipMs, useNativeDriver: true }),
          Animated.timing(faceFlip, { toValue: 1,    duration: flipMs, useNativeDriver: true }),
        ]).start();
      }, elapsed);
      rollTimers.current.push(t);
    });

    // Final settle: show true value with a confident "clack" flip
    const settleAt = elapsed + gaps[gaps.length - 1] + 30;
    const t = setTimeout(() => {
      setDD(value);
      if (value === 6) gameSounds.fire('six_rolled');

      // Dramatic slow-reveal flip
      Animated.sequence([
        Animated.timing(faceFlip, { toValue: 0,    duration: 110, useNativeDriver: true }),
        Animated.spring (faceFlip, { toValue: 1, friction: 5, tension: 260, useNativeDriver: true }),
      ]).start();

      // Snap tilt back to resting isometric angle
      Animated.parallel([
        Animated.spring(diceRotY, { toValue: 0,          friction: 6, tension: 140, useNativeDriver: true }),
        Animated.spring(diceRotX, { toValue: ROT_X_REST, friction: 6, tension: 140, useNativeDriver: true }),
      ]).start();

      // Landing scale bounce
      Animated.sequence([
        Animated.timing(diceScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring (diceScale, { toValue: 1,   friction: 4, tension: 260, useNativeDriver: true }),
      ]).start();

      const rollMsg = value === 6 ? '🎲 Six! 🎉 Move a coin!' : `🎲 Rolled ${value} — tap a coin`;
      setGs(prev => ({
        ...prev, dice: value, phase: 'rolled', msg: rollMsg,
      }));
      // Broadcast dice result to opponent
      syncToRTDB({ dice: value, phase: 'rolled', turnColor: gs.turn, msg: rollMsg });
      flashMsg();
    }, settleAt);
    rollTimers.current.push(t);

    // ── Rotation animation: continuous full 360° spins ───────────────────────────
    // rotY: 0→1 = one full 360° spin (interpolated in Dice3D to '0deg'→'360deg')
    // Animated.loop resets to startValue before each iteration → dice keeps spinning forward.
    // Fast phase 5×120ms = 600ms, slow phase 3×270ms = 810ms — total ~1.4s before settle.
    diceRotY.setValue(0);
    Animated.sequence([
      // ① Fast tumble — rapid full spins (like the dice just left your hand)
      Animated.loop(
        Animated.timing(diceRotY, { toValue: 1, duration: 120, useNativeDriver: true }),
        { iterations: 5 }
      ),
      // ② Deceleration — visibly slowing down
      Animated.loop(
        Animated.timing(diceRotY, { toValue: 1, duration: 270, useNativeDriver: true }),
        { iterations: 3 }
      ),
      // ③ Settle — gentle spring to face-forward rest
      Animated.spring(diceRotY, { toValue: 0, friction: 7, tension: 160, useNativeDriver: true }),
    ]).start();

    // X-axis: oscillate between resting tilt and high lean during tumble.
    // Different frequency from Y → chaotic, non-uniform tumble.
    // Always returns to ROT_X_REST (persistent depth-cue tilt), never flat 0.
    Animated.sequence([
      // Wild pitch during throw
      Animated.loop(
        Animated.sequence([
          Animated.timing(diceRotX, { toValue: 0.85,       duration: 105, useNativeDriver: true }),
          Animated.timing(diceRotX, { toValue: ROT_X_REST, duration: 105, useNativeDriver: true }),
        ]),
        { iterations: 6 }
      ),
      // Gentler rocking as it slows
      Animated.loop(
        Animated.sequence([
          Animated.timing(diceRotX, { toValue: 0.60,       duration: 200, useNativeDriver: true }),
          Animated.timing(diceRotX, { toValue: ROT_X_REST, duration: 200, useNativeDriver: true }),
        ]),
        { iterations: 2 }
      ),
      // Land at resting isometric tilt
      Animated.spring(diceRotX, { toValue: ROT_X_REST, friction: 7, tension: 160, useNativeDriver: true }),
    ]).start();

    // Initial throw: scale up sharply, then slowly drift back during rolling
    Animated.sequence([
      Animated.timing(diceScale, { toValue: 1.48, duration: 80,  useNativeDriver: true }),
      Animated.timing(diceScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
      // Landing bounce handled in the settleAt timeout above
    ]).start();

    // Roll button feedback
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring (btnScale, { toValue: 1,   friction: 5,  useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.phase, diceScale, diceRotY, diceRotX, faceFlip, btnScale, flashMsg]);

  // ── Move handler ──────────────────────────────────────────────────────────────
  const doMove = useCallback((piece: Piece) => {
    if ((gs.phase !== 'rolled' && gs.phase !== 'moving') || gs.dice === null) return;
    if (piece.color !== gs.turn) return;
    // In multiplayer: only the player whose color it is can move
    if (roomId && myColorRef.current && gs.turn !== myColorRef.current) return;

    const elig = eligiblePieces(gs.pieces, gs.turn, gs.dice);
    if (!elig.some(e => e.id === piece.id)) { gameSounds.fire('error'); return; }

    stopPulse();
    if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; }

    const dice      = gs.dice;
    const fromSteps = piece.steps;
    const toSteps   = fromSteps === -1 ? 0 : fromSteps + dice;
    const { pieces: newPieces, captured } = applyMove(gs.pieces, piece, dice);
    const movedPiece  = newPieces.find(p => p.id === piece.id)!;
    const reachedHome = movedPiece.steps >= 57;

    setGs(prev => ({ ...prev, phase: 'moving' }));

    if (captured)     gameSounds.fire('capture');
    else if (reachedHome) gameSounds.fire('home');
    else              gameSounds.fire('piece_move');

    animateMove(piece, fromSteps, toSteps, () => {
      if (captured) {
        newPieces
          .filter(p => p.color !== piece.color && p.steps === -1)
          .forEach(snapToCoord);
      }

      if (checkWin(newPieces, gs.turn)) {
        const winMsg = `${P[gs.turn].emoji} ${P[gs.turn].label} wins! 🏆`;
        setGs(prev => ({
          ...prev, pieces: newPieces, phase: 'won', winner: prev.turn,
          dice: null, msg: winMsg,
        }));
        syncToRTDB({ pieces: newPieces, phase: 'won', winner: gs.turn, turnColor: gs.turn, dice: null, msg: winMsg });
        setDD(null);
        return;
      }

      if (dice === 6 || captured) {
        const bonusMsg = captured ? '💥 Captured! Roll again 🎲' : '🎉 Six — roll again 🎲';
        setGs(prev => ({
          ...prev, pieces: newPieces, phase: 'idle', dice: null, bonusRoll: true,
          msg: bonusMsg,
        }));
        syncToRTDB({ pieces: newPieces, phase: 'idle', turnColor: gs.turn, dice: null, bonusRoll: true, msg: bonusMsg });
        setDD(null);
        flashMsg();
      } else {
        const next: PlayerColor = gs.turn === 'red' ? 'green' : 'red';
        const nextMsg = `${P[next].emoji} ${P[next].label} — roll the dice!`;
        gameSounds.fire('turn_change');
        bounceTurn();
        setGs(prev => ({
          ...prev, pieces: newPieces, turn: next,
          phase: 'idle', dice: null, bonusRoll: false,
          msg: nextMsg,
        }));
        syncToRTDB({ pieces: newPieces, phase: 'idle', turnColor: next, dice: null, bonusRoll: false, msg: nextMsg });
        setDD(null);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs, stopPulse, flashMsg, bounceTurn]);

  // ── Restart ───────────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    winAnim.setValue(0);
    setDD(null);
    const fresh = makePieces();
    pieceAnims.current = {};
    fresh.forEach(ensureAnim);
    setGs({ ...INIT_GS, pieces: fresh });
    bounceTurn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winAnim, bounceTurn]);

  // ─── Derived values ──────────────────────────────────────────────────────────
  const cfg        = P[gs.turn];
  // In multiplayer: only allow interaction when it's this player's turn
  const isMyTurn   = !roomId || !myColor || gs.turn === myColor;
  const canRoll    = gs.phase === 'idle' && !gs.winner && isMyTurn;

  const eligIds = (gs.phase === 'rolled' && gs.dice !== null)
    ? new Set(eligiblePieces(gs.pieces, gs.turn, gs.dice).map(p => p.id))
    : new Set<string>();

  const cellMap = new Map<string, Piece[]>();
  gs.pieces.forEach(p => {
    if (p.steps >= 57) return;
    const coord = coordOf(p);
    if (!coord) return;
    const key = `${coord[0]},${coord[1]}`;
    cellMap.set(key, [...(cellMap.get(key) ?? []), p]);
  });

  // ─── Board cells ──────────────────────────────────────────────────────────────
  const boardCells: React.ReactElement[] = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const bg    = cellBg(r, c);
      const safe  = SAFE_CELLS.has(`${r},${c}`);
      const redHR   = r === 7 && c >= 1 && c <= 5;
      const greenHR = r === 7 && c >= 9 && c <= 13;
      const blueHR  = c === 7 && r >= 1 && r <= 5;
      const yelHR   = c === 7 && r >= 9 && r <= 13;
      boardCells.push(
        <View
          key={`${r}-${c}`}
          style={[bSt.cell, { width:CELL, height:CELL, top:r*CELL, left:c*CELL, backgroundColor:bg }]}
        >
          {safe && <Text style={[bSt.star, { fontSize: CELL * 0.45 }]}>★</Text>}
          {(redHR || greenHR) && (
            <Text style={[bSt.arrow, { color: redHR ? '#E53935':'#2E7D32', fontSize: CELL*0.5 }]}>
              {redHR ? '→' : '←'}
            </Text>
          )}
          {(blueHR || yelHR) && (
            <Text style={[bSt.arrow, { color: blueHR ? '#1565C0':'#F57F17', fontSize: CELL*0.5 }]}>
              {blueHR ? '↓' : '↑'}
            </Text>
          )}
        </View>
      );
    }
  }

  // ─── Yard circles ─────────────────────────────────────────────────────────────
  const yardDeco: React.ReactElement[] = [];
  (['red','green'] as PlayerColor[]).forEach(color => {
    const cfg2 = P[color];
    cfg2.yard.forEach(([r, c], i) => {
      const sz = CELL * 1.55;
      yardDeco.push(
        <View key={`yd-${color}-${i}`} style={[
          bSt.yardCircle,
          {
            width: sz, height: sz, borderRadius: sz/2,
            top: r*CELL + (CELL-sz)/2, left: c*CELL + (CELL-sz)/2,
            borderColor: cfg2.color, backgroundColor: cfg2.light,
          },
        ]}>
          <View style={{
            width: sz*0.5, height: sz*0.5,
            borderRadius: sz*0.25,
            backgroundColor: cfg2.color, opacity: 0.2,
          }} />
        </View>
      );
    });
  });

  // ─── Coin elements ────────────────────────────────────────────────────────────
  // IMPORTANT: Animated.View for coins uses transform:[translateX, translateY]
  // NOT left/top as animated values — native driver doesn't support left/top.
  // The position Animated.View uses useNativeDriver:false (JS driver).
  // The scale Animated.View (pulseAnim) uses useNativeDriver:true (native driver).
  // They are on SEPARATE view nodes so there is no driver conflict.
  const coinEls: React.ReactElement[] = [];

  gs.pieces.forEach(piece => {
    if (piece.steps >= 57) return;
    ensureAnim(piece);
    const anim = pieceAnims.current[piece.id];
    if (!anim) return;

    const coord = coordOf(piece);
    if (!coord) return;
    const key      = `${coord[0]},${coord[1]}`;
    const group    = cellMap.get(key) ?? [];
    const gIdx     = group.findIndex(p => p.id === piece.id);
    const { ox, oy } = stackOffset(group.length, gIdx >= 0 ? gIdx : 0);
    const isElig   = eligIds.has(piece.id);

    coinEls.push(
      // ── JS-driver view: only translateX / translateY (position) ──────────────
      <Animated.View
        key={`coin-${piece.id}`}
        style={{
          position: 'absolute',
          // left/top are STATIC — animation is via transform below
          left: 0,
          top:  0,
          width:  PIECE_SIZE,
          height: PIECE_SIZE,
          transform: [
            { translateX: anim.x },   // JS animated value
            { translateY: anim.y },   // JS animated value
          ],
          zIndex: isElig ? 14 : 10,
        }}
      >
        {/* Static stacking offset — plain View, no driver conflict */}
        <View style={{
          position: 'absolute',
          left: ox,
          top:  oy,
          width:  PIECE_SIZE,
          height: PIECE_SIZE,
        }}>
          {/* Pulse ring — separate native-driver Animated.View */}
          {isElig && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width:  PIECE_SIZE + 14,
                height: PIECE_SIZE + 14,
                top:    -7,
                left:   -7,
                borderRadius: (PIECE_SIZE + 14) / 2,
                borderWidth: 2.5,
                borderColor: P[piece.color].color,
                backgroundColor: 'transparent',
                transform: [{ scale: pulseAnim }],  // native driver only
              }}
            />
          )}
          {/* Coin (also uses native driver for its scale) */}
          <Coin
            piece={piece}
            isEligible={isElig}
            pulseAnim={pulseAnim}
            onPress={() => doMove(piece)}
          />
        </View>
      </Animated.View>
    );
  });

  const winnerCfg = gs.winner ? P[gs.winner] : null;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={st.root} edges={['top','bottom']}>

      {roomId && (
        <View style={st.mpBanner}>
          <Text style={st.mpTxt}>🎮 Room · {roomId.slice(0,6).toUpperCase()}</Text>
        </View>
      )}

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={st.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={st.title}>Ludo</Text>
        <Animated.View style={[st.turnPill, { backgroundColor: cfg.color, transform:[{scale:turnScale}] }]}>
          <Text style={st.turnPillTxt}>{cfg.emoji} {cfg.label}'s turn</Text>
        </Animated.View>
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* Player cards */}
        <View style={[st.cards, { width: BOARD_PX }]}>
          <PlayerCard color="red"   pieces={gs.pieces.filter(p=>p.color==='red')}   isActive={gs.turn==='red'} />
          <View style={st.vsWrap}><Text style={st.vs}>VS</Text></View>
          <PlayerCard color="green" pieces={gs.pieces.filter(p=>p.color==='green')} isActive={gs.turn==='green'} />
        </View>

        {/* Board */}
        <View style={[st.boardWrap, { width: BOARD_PX }]}>
          <View style={[st.board, { width: BOARD_PX, height: BOARD_PX }]}>
            {boardCells}
            {yardDeco}
            {coinEls}
            {/* Centre star */}
            <View style={[st.centre, { width:CELL*3, height:CELL*3, top:CELL*6, left:CELL*6 }]}>
              <Text style={[st.centreStar, { fontSize: CELL * 1.3 }]}>★</Text>
            </View>
          </View>
        </View>

        {/* Multiplayer: waiting for opponent */}
        {roomId && !isMyTurn && gs.phase !== 'won' && (
          <View style={[st.waitBanner, { borderColor: cfg.color + '40' }]}>
            <Text style={st.waitEmoji}>⏳</Text>
            <Text style={[st.waitTxt, { color: cfg.color }]}>
              Waiting for {P[gs.turn].label}…
            </Text>
          </View>
        )}

        {/* Status message */}
        <Animated.View style={[st.msgBox, { borderLeftColor: cfg.color, opacity: msgFade }]}>
          <Text style={[st.msgTxt, { color: cfg.color }]}>{gs.msg}</Text>
        </Animated.View>

        {/* Dice + Roll button */}
        <View style={st.controls}>
          <Dice3D
            value={displayDice}
            rollSc={diceScale}
            rotY={diceRotY}
            rotX={diceRotX}
            faceFlip={faceFlip}
            onRoll={handleRoll}
            isRolling={gs.phase === 'rolling'}
          />

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[st.rollBtn, { backgroundColor: canRoll ? cfg.color : '#CBD5E1' }]}
              onPress={handleRoll}
              disabled={!canRoll}
              activeOpacity={0.82}
            >
              <Text style={st.rollEmoji}>🎲</Text>
              <Text style={st.rollTxt}>
                {gs.phase === 'rolling' ? 'Rolling…'
                 : gs.phase === 'moving' ? 'Moving…'
                 : gs.phase === 'rolled' ? 'Tap coin'
                 : 'Roll Dice'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {gs.bonusRoll && gs.phase === 'idle' && (
          <View style={[st.bonus, { backgroundColor: cfg.light, borderColor: cfg.color }]}>
            <Text style={[st.bonusTxt, { color: cfg.color }]}>🎉 Bonus roll!</Text>
          </View>
        )}

        {/* Rules */}
        <View style={[st.rulesBox, { width: BOARD_PX }]}>
          <Text style={st.rulesTitle}>📖 Quick Rules</Text>
          <Text style={st.rule}>• Roll 6 to bring a coin out of yard</Text>
          <Text style={st.rule}>• ★ Safe squares — can't be captured</Text>
          <Text style={st.rule}>• Land on enemy = capture → roll again</Text>
          <Text style={st.rule}>• Roll 6 → move then roll again</Text>
          <Text style={st.rule}>• Get all 4 coins home to win 🏆</Text>
        </View>

      </ScrollView>

      {gs.winner && winnerCfg && (
        <>
          <View style={st.backdrop} pointerEvents="none" />
          <Animated.View style={[st.winCard, {
            opacity: winAnim,
            transform: [{ scale: winAnim.interpolate({ inputRange:[0,1], outputRange:[0.7,1] }) }],
          }]}>
            <Text style={st.trophy}>🏆</Text>
            <Text style={[st.winTitle, { color: winnerCfg.color }]}>{winnerCfg.label} Wins!</Text>
            <Text style={st.winSub}>Brilliant game! 🎉</Text>
            <TouchableOpacity
              style={[st.winBtn, { backgroundColor: winnerCfg.color }]}
              onPress={handleRestart}
              activeOpacity={0.85}
            >
              <Text style={st.winBtnTxt}>🔄  Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.winOutline} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={st.winOutlineTxt}>← Back to Games</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      <GameChatVoice
        roomId={roomId}
        myUid={firebaseUser?.uid ?? ''}
        myName={userProfile?.name ?? 'Player'}
        accentColor="#6C5CE7"
      />
    </SafeAreaView>
  );
}

// ─── Board styles ──────────────────────────────────────────────────────────────
const bSt = StyleSheet.create({
  cell: {
    position: 'absolute', borderWidth: 0.4, borderColor: '#CFD8DC',
    alignItems: 'center', justifyContent: 'center',
  },
  star:  { color: '#F59E0B', fontWeight: '900' },
  arrow: { fontWeight: '700' },
  yardCircle: {
    position: 'absolute', borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.12,shadowRadius:3 },
      android: { elevation: 2 },
    }),
  },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────
function makeStyles(C: AppColors) {
  return StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#F0F4F8' },
  mpBanner: { backgroundColor: C.secondary, paddingVertical: 5, alignItems: 'center' },
  mpTxt:    { color: '#fff', fontSize: 12, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.07,shadowRadius:4 },
      android: { elevation: 3 },
    }),
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backTxt: { fontSize: 15, color: C.primary, fontWeight: '600' },
  title:   { fontSize: 20, fontWeight: '900', color: '#111827', flex: 1, textAlign: 'center' },
  turnPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.22,shadowRadius:4 },
      android: { elevation: 3 },
    }),
  },
  turnPillTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

  scroll: { alignItems: 'center', paddingVertical: 12, paddingBottom: 50 },

  cards:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  vsWrap: { width: 26, alignItems: 'center' },
  vs:     { fontSize: 11, fontWeight: '900', color: '#9CA3AF' },

  boardWrap: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 3, borderColor: '#78909C',
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:6},shadowOpacity:0.22,shadowRadius:12 },
      android: { elevation: 9 },
    }),
  },
  board:  { position: 'relative', backgroundColor: '#FAFAFA' },
  centre: {
    position: 'absolute', backgroundColor: '#F3E5F5',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2, borderRadius: 4,
    borderWidth: 2, borderColor: '#CE93D8',
  },
  centreStar: { color: '#9C27B0', fontWeight: '900' },

  waitBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 8, marginTop: 8,
    backgroundColor: '#ffffff10', borderRadius: 12,
    borderWidth: 1,
  },
  waitEmoji: { fontSize: 15 },
  waitTxt:   { fontSize: 13, fontWeight: '700' },

  msgBox: {
    marginTop: 12, marginBottom: 2,
    paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderLeftWidth: 5,
    minWidth: 230, alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:3 },
      android: { elevation: 1 },
    }),
  },
  msgTxt: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  controls: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 22,
    marginVertical: 14, paddingHorizontal: 16,
  },
  rollBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, paddingHorizontal: 24,
    borderRadius: 18, minWidth: 150,
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:4},shadowOpacity:0.24,shadowRadius:8 },
      android: { elevation: 7 },
    }),
  },
  rollEmoji: { fontSize: 24 },
  rollTxt:   { fontSize: 15, fontWeight: '800', color: '#fff' },

  bonus: {
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  bonusTxt: { fontSize: 13, fontWeight: '800' },

  rulesBox: {
    marginTop: 16, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:3 },
      android: { elevation: 1 },
    }),
  },
  rulesTitle: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 6 },
  rule:       { fontSize: 11, color: '#6B7280', lineHeight: 19 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 98 },
  winCard: {
    position: 'absolute', top: '16%', left: 20, right: 20,
    backgroundColor: '#fff', borderRadius: 26, padding: 30,
    alignItems: 'center', zIndex: 99,
    ...Platform.select({
      ios:     { shadowColor:'#000',shadowOffset:{width:0,height:14},shadowOpacity:0.3,shadowRadius:28 },
      android: { elevation: 26 },
    }),
  },
  trophy:       { fontSize: 60, marginBottom: 8 },
  winTitle:     { fontSize: 30, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  winSub:       { fontSize: 15, color: '#6B7280', marginBottom: 26 },
  winBtn:       { width: '100%', paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  winBtnTxt:    { fontSize: 16, fontWeight: '800', color: '#fff' },
  winOutline:   { width: '100%', paddingVertical: 13, borderRadius: 16, alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  winOutlineTxt:{ fontSize: 15, fontWeight: '700', color: '#374151' },
  });
}
