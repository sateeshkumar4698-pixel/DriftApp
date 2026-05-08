import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList, GameInvite, GameRoomPlayer } from '../../types';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { useAuthStore } from '../../store/authStore';
import {
  subscribeToIncomingInvites,
  respondToGameInvite,
  joinGameRoom,
  subscribeToActiveRoomCount,
  getGameRoomByCode,
} from '../../utils/firestore-helpers';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'GamesList'>;

interface GameItem {
  id: 'ludo' | 'truth-dare' | 'uno' | 'chess' | 'bet' | 'wyr' | 'nhie';
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  players: string;
  color: string;
  accentDark: string;
  tags: string[];
  available: true;
  hotBadge?: boolean;
}

interface ComingSoonItem {
  id: string;
  emoji: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  name: string;
  color: string;
  available: false;
}

type AnyGame = GameItem | ComingSoonItem;

const LIVE_GAMES: GameItem[] = [
  {
    id: 'ludo', emoji: '🎲', name: 'Ludo', tagline: 'Roll, move, capture!',
    description: 'Classic board game — 4 colored pieces, race to home. Beat your opponent before they beat you.',
    players: '2 players', color: '#6C5CE7', accentDark: '#4C3BC7',
    tags: ['Board Game', 'Strategy', 'Classic'], available: true,
  },
  {
    id: 'truth-dare', emoji: '🎯', name: 'Truth or Dare', tagline: 'How well do you know each other?',
    description: 'Confess truths, survive dares. 5 spice levels from Mild to 🔞 Extreme — choose wisely.',
    players: '2–8 players', color: '#FF4B6E', accentDark: '#D4284A',
    tags: ['Party', '18+ Mode', 'Ice Breaker'], available: true, hotBadge: true,
  },
  {
    id: 'nhie', emoji: '🙈', name: 'Never Have I Ever', tagline: 'Find out who\'s done the most.',
    description: 'Read a card, raise your hand if you\'ve done it. 5 spice levels, 100+ cards per level. Find out who\'s the most experienced.',
    players: '2–8 players', color: '#A855F7', accentDark: '#7C3AED',
    tags: ['Party', '18+ Mode', 'Social'], available: true, hotBadge: true,
  },
  {
    id: 'uno', emoji: '🃏', name: 'UNO', tagline: 'Draw, skip, reverse — and shout UNO!',
    description: 'The classic card game fully playable on Drift. Special cards, Wild draws, and the pressure of being last.',
    players: '2–4 players', color: '#E17055', accentDark: '#C0533A',
    tags: ['Card Game', 'Party', 'Fast-paced'], available: true,
  },
  {
    id: 'chess', emoji: '♟️', name: 'Chess', tagline: 'The ultimate battle of minds.',
    description: 'Full chess with all rules — castling, en passant, check & checkmate. Pass-and-play on one device.',
    players: '2 players', color: '#2D3436', accentDark: '#1A1A2E',
    tags: ['Strategy', 'Classic', 'Brain Game'], available: true,
  },
  {
    id: 'bet', emoji: '🎰', name: 'Stake It', tagline: 'Set the stakes. Make it personal.',
    description: 'Truth or Dare with a twist — the GROUP sets the consequences, you bet Drift coins, and raise the stakes each round.',
    players: '2–6 players', color: '#FDCB6E', accentDark: '#B7791F',
    tags: ['Party', 'Betting', 'Custom Stakes'], available: true,
  },
  {
    id: 'wyr', emoji: '🤔', name: 'Would You Rather', tagline: 'Reveal your true self.',
    description: 'Both pick secretly, then reveal. 10 rounds of binary choices — lifestyle, power, deep dilemmas — with compatibility score at the end.',
    players: '2 players', color: '#00B894', accentDark: '#00856A',
    tags: ['Social', 'Personality', 'Conversation'], available: true,
  },
];

const COMING_SOON: ComingSoonItem[] = [
  { id: 'drift-world', emoji: '🌍', icon: 'earth-outline', name: 'Drift World', color: '#0984E3', available: false },
];

const GAME_DISPLAY: Record<string, { name: string; emoji: string }> = {
  ludo: { name: 'Ludo', emoji: '🎲' },
  'truth-dare': { name: 'Truth or Dare', emoji: '🎯' },
  nhie: { name: 'Never Have I Ever', emoji: '🙈' },
  uno: { name: 'UNO', emoji: '🃏' },
  chess: { name: 'Chess', emoji: '♟️' },
  bet: { name: 'Stake It', emoji: '🎰' },
  wyr: { name: 'Would You Rather', emoji: '🤔' },
};

const GAME_COLOR: Record<string, string> = {
  ludo: '#6C5CE7', 'truth-dare': '#FF4B6E', nhie: '#A855F7', uno: '#E17055', chess: '#4A4A6A', bet: '#FDCB6E', wyr: '#00B894',
};

export default function GamesScreen() {
  const navigation = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);

  const [invites, setInvites]             = useState<GameInvite[]>([]);
  const [liveRoomCount, setLiveRoomCount] = useState(0);
  const [perGameCounts, setPerGameCounts] = useState<Record<string, number>>({});

  // ── Join by Code modal ────────────────────────────────────────────────────────
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode]           = useState('');
  const [joining, setJoining]             = useState(false);
  const joinInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubInvites = subscribeToIncomingInvites(firebaseUser.uid, setInvites);
    const unsubRooms   = subscribeToActiveRoomCount(setLiveRoomCount);

    // Per-game active player counts
    const q = query(
      collection(db, 'gameRooms'),
      where('status', 'in', ['waiting', 'playing']),
    );
    const unsubPerGame = onSnapshot(q, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const gameId = d.data().gameId as string;
        if (gameId) counts[gameId] = (counts[gameId] ?? 0) + 1;
      });
      setPerGameCounts(counts);
    });

    return () => { unsubInvites(); unsubRooms(); unsubPerGame(); };
  }, [firebaseUser]);

  function handleSolo(game: GameItem) {
    if (game.id === 'ludo')            navigation.navigate('LudoGame');
    else if (game.id === 'truth-dare') navigation.navigate('TruthOrDare');
    else if (game.id === 'nhie')       navigation.navigate('NeverHaveIEver');
    else if (game.id === 'uno')        navigation.navigate('UnoGame');
    else if (game.id === 'chess')      navigation.navigate('ChessGame');
    else if (game.id === 'bet')        navigation.navigate('BetGame');
    else if (game.id === 'wyr')        navigation.navigate('WouldYouRather');
  }

  function handleWithFriends(game: GameItem) {
    if (game.id === 'uno')   { navigation.navigate('UnoGame');   return; }
    if (game.id === 'chess') { navigation.navigate('ChessGame'); return; }
    if (game.id === 'bet')   { navigation.navigate('BetGame');   return; }
    // Party games with invite/lobby flow
    if (game.id === 'ludo' || game.id === 'truth-dare' || game.id === 'wyr') {
      navigation.navigate('GameInvite', { gameId: game.id as 'ludo' | 'truth-dare' | 'wyr' });
      return;
    }
    // NHIE — solo multi-device play (pass-and-play style)
    if (game.id === 'nhie') {
      navigation.navigate('NeverHaveIEver');
      return;
    }
    navigation.navigate('GameInvite', { gameId: game.id as 'ludo' | 'truth-dare' | 'wyr' });
  }

  function handleComingSoon(game: ComingSoonItem) {
    Alert.alert('Coming Soon! 🚧', `${game.emoji} ${game.name} is under construction.\nCheck back soon!`);
  }

  async function handleAcceptInvite(invite: GameInvite) {
    if (!firebaseUser || !userProfile) return;
    try {
      await respondToGameInvite(invite.id, 'accepted');
      const selfPlayer: GameRoomPlayer = {
        uid: firebaseUser.uid, name: userProfile.name,
        ...(userProfile.photoURL ? { photoURL: userProfile.photoURL } : {}),
        ready: false, isHost: false, joinedAt: Date.now(),
      };
      await joinGameRoom(invite.roomId, selfPlayer);
      navigation.navigate('GameLobby', { roomId: invite.roomId, gameId: invite.gameId });
    } catch {
      Alert.alert('Could not join', 'The room may no longer be available.');
    }
  }

  async function handleDeclineInvite(invite: GameInvite) {
    try { await respondToGameInvite(invite.id, 'declined'); } catch { /* non-fatal */ }
  }

  async function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character room code.');
      return;
    }
    if (!firebaseUser || !userProfile) return;
    setJoining(true);
    try {
      const room = await getGameRoomByCode(code);
      if (!room) {
        Alert.alert('Room Not Found', 'No active room with that code. It may have expired or already started.');
        return;
      }
      const playerCount = Object.keys(room.players).length;
      if (playerCount >= room.maxPlayers) {
        Alert.alert('Room Full', `This room is full (${playerCount}/${room.maxPlayers} players).`);
        return;
      }
      if (room.players[firebaseUser.uid]) {
        // Already in this room — just navigate
        setShowJoinModal(false);
        navigation.navigate('GameLobby', { roomId: room.id, gameId: room.gameId });
        return;
      }
      const player: GameRoomPlayer = {
        uid:      firebaseUser.uid,
        name:     userProfile.name,
        ...(userProfile.photoURL ? { photoURL: userProfile.photoURL } : {}),
        ready:    false,
        isHost:   false,
        joinedAt: Date.now(),
      };
      await joinGameRoom(room.id, player);
      setShowJoinModal(false);
      setJoinCode('');
      navigation.navigate('GameLobby', { roomId: room.id, gameId: room.gameId });
    } catch {
      Alert.alert('Error', 'Could not join the room. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.root}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}
      <SafeAreaView style={styles.flex}>

        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : [C.background, C.surface]}
          style={styles.header}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Games 🎮</Text>
            <Text style={styles.headerSub}>Play solo or challenge friends</Text>
          </View>
          <TouchableOpacity
            style={styles.joinCodeBtn}
            onPress={() => { setShowJoinModal(true); setTimeout(() => joinInputRef.current?.focus(), 300); }}
            activeOpacity={0.8}
          >
            <Ionicons name="enter-outline" size={16} color={C.primary} />
            <Text style={styles.joinCodeBtnText}>Join by Code</Text>
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Incoming Invites */}
          {invites.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary }} />
                <Text style={styles.sectionLabel}>INCOMING INVITES</Text>
              </View>
              {invites.map((invite) => {
                const info = GAME_DISPLAY[invite.gameId] ?? { name: invite.gameId, emoji: '🎮' };
                const color = GAME_COLOR[invite.gameId] ?? C.primary;
                return (
                  <View key={invite.id} style={styles.inviteCard}>
                    <LinearGradient colors={[color, color + '88']} style={styles.inviteStripe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                    <View style={[styles.inviteEmojiWrap, { backgroundColor: color + '20' }]}>
                      <Text style={styles.inviteEmoji}>{info.emoji}</Text>
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteTitle}>{invite.fromName}</Text>
                      <Text style={styles.inviteSub}>wants to play {info.name}</Text>
                    </View>
                    <TouchableOpacity style={styles.inviteDecline} onPress={() => handleDeclineInvite(invite)}>
                      <Text style={styles.inviteDeclineText}>Pass</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleAcceptInvite(invite)} activeOpacity={0.85}>
                      <LinearGradient colors={[color, color + 'DD']} style={styles.inviteAccept} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.inviteAcceptText}>Join →</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Available Now */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>AVAILABLE NOW</Text>
            </View>
            {LIVE_GAMES.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                C={C}
                isDark={isDark}
                activeRooms={perGameCounts[game.id] ?? 0}
                onSolo={() => handleSolo(game)}
                onFriends={() => handleWithFriends(game)}
              />
            ))}
          </View>

          {/* Coming Soon */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COMING SOON</Text>
            <View style={styles.comingSoonGrid}>
              {COMING_SOON.map((game) => (
                <TouchableOpacity
                  key={game.id}
                  style={[styles.comingSoonCard, { borderColor: game.color + '40' }]}
                  onPress={() => handleComingSoon(game)}
                  activeOpacity={0.7}
                >
                  <LinearGradient colors={[game.color + '25', game.color + '10']} style={styles.comingSoonIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name={game.icon} size={28} color={game.color} />
                  </LinearGradient>
                  <Text style={styles.comingSoonName}>{game.name}</Text>
                  <View style={styles.soonBadge}>
                    <Ionicons name="hourglass-outline" size={10} color="#B7791F" />
                    <Text style={styles.soonText}>Soon</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>

        {/* ── Join by Code Modal ── */}
        <Modal
          visible={showJoinModal}
          transparent
          animationType="slide"
          onRequestClose={() => { setShowJoinModal(false); setJoinCode(''); }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => { Keyboard.dismiss(); setShowJoinModal(false); setJoinCode(''); }}
          />
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#1A1A2E' : C.background }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🕹️ Join by Room Code</Text>
            <Text style={styles.modalSub}>
              Enter the 6-character code shared by your friend.
            </Text>

            <TextInput
              ref={joinInputRef}
              style={[styles.codeInput, { borderColor: joinCode.length === 6 ? C.primary : C.border, color: C.text }]}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="characters"
              maxLength={6}
              keyboardType="default"
              returnKeyType="go"
              onSubmitEditing={handleJoinByCode}
            />

            <TouchableOpacity
              style={[styles.joinSubmitBtn, (joining || joinCode.length !== 6) && styles.joinSubmitBtnOff]}
              onPress={handleJoinByCode}
              disabled={joining || joinCode.length !== 6}
              activeOpacity={0.85}
            >
              {joining
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.joinSubmitText}>Join Room →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setShowJoinModal(false); setJoinCode(''); }} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

// ─── GameCard ─────────────────────────────────────────────────────────────────

interface GameCardProps {
  game: GameItem;
  C: AppColors;
  isDark: boolean;
  activeRooms: number;
  onSolo: () => void;
  onFriends: () => void;
}

function GameCard({ game, C, isDark, activeRooms, onSolo, onFriends }: GameCardProps) {
  const styles = makeStyles(C);
  return (
    <View style={styles.gameCard}>
      {/* Gradient hero */}
      <LinearGradient colors={[game.color, game.accentDark]} style={styles.gameCardHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[styles.heroPatternDot, styles.heroPatternDot1]} />
        <View style={[styles.heroPatternDot, styles.heroPatternDot2]} />
        <View style={[styles.heroPatternDot, styles.heroPatternDot3]} />

        {/* HOT badge */}
        {game.hotBadge && (
          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>HOT 🔥</Text>
          </View>
        )}

        <View style={styles.gameCardHeroInner}>
          <Text style={styles.heroEmoji}>{game.emoji}</Text>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroName}>{game.name}</Text>
            <Text style={styles.heroTagline}>{game.tagline}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={styles.heroPlayersBadge}>
              <Ionicons name="people-outline" size={12} color="#fff" />
              <Text style={styles.heroPlayersText}>{game.players}</Text>
            </View>
            {activeRooms > 0 && (
              <View style={styles.heroLiveBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroLiveText}>{activeRooms} active</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Card body */}
      <View style={styles.gameCardBody}>
        <Text style={styles.gameCardDesc}>{game.description}</Text>
        <View style={styles.tagsRow}>
          {game.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: game.color + '15', borderColor: game.color + '35' }]}>
              <Text style={[styles.tagText, { color: game.color }]}>{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.gameCardBtnRow}>
          <TouchableOpacity style={[styles.soloBtn, { borderColor: game.color + '60' }]} onPress={onSolo} activeOpacity={0.8}>
            <Ionicons name="person-outline" size={15} color={game.color} />
            <Text style={[styles.soloBtnText, { color: game.color }]}>Solo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 2, borderRadius: radius.md, overflow: 'hidden' }} onPress={onFriends} activeOpacity={0.85}>
            <LinearGradient colors={[game.color, game.accentDark]} style={styles.friendsBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="people-outline" size={15} color="#fff" />
              <Text style={styles.friendsBtnText}>Play with Friends</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: '#ffffff10',
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
    headerSub:   { ...typography.small, color: C.textSecondary, marginTop: 2 },

    joinCodeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1.5, borderColor: C.primary + '60',
      backgroundColor: C.primary + '12',
    },
    joinCodeBtnText: { ...typography.small, fontWeight: '700', color: C.primary },

    // ── Join by Code modal ────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalSheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.xl, paddingBottom: spacing.xxl,
      alignItems: 'center',
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
      marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: spacing.xs },
    modalSub:   { ...typography.caption, color: C.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
    codeInput: {
      width: '100%',
      fontSize: 32, fontWeight: '800', letterSpacing: 10,
      textAlign: 'center',
      color: C.text,
      backgroundColor: C.surface,
      borderWidth: 2, borderRadius: radius.lg,
      paddingVertical: spacing.md,
      marginBottom: spacing.xl,
    },
    joinSubmitBtn: {
      width: '100%', paddingVertical: spacing.md,
      borderRadius: radius.lg, backgroundColor: C.primary,
      alignItems: 'center', marginBottom: spacing.sm,
      ...shadows.card,
    },
    joinSubmitBtnOff: { opacity: 0.45 },
    joinSubmitText: { ...typography.body, fontWeight: '800', color: '#fff' },
    modalCancel: { padding: spacing.md },
    modalCancelText: { ...typography.body, color: C.textSecondary },

    scroll: { padding: spacing.lg, paddingBottom: 100 },

    section:    { marginBottom: spacing.xl },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
    sectionLabel: { ...typography.small, fontWeight: '800', color: C.textSecondary, letterSpacing: 1.2 },

    // ── Invite card ────────────────────────────────────────────────────────────
    inviteCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: C.surface, borderRadius: radius.lg,
      borderWidth: 1, borderColor: C.border, overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    inviteStripe:  { width: 4, alignSelf: 'stretch' },
    inviteEmojiWrap: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
    inviteEmoji:   { fontSize: 22 },
    inviteInfo:    { flex: 1, paddingVertical: spacing.sm },
    inviteTitle:   { ...typography.body, fontWeight: '700', color: C.text },
    inviteSub:     { ...typography.small, color: C.textSecondary, marginTop: 2 },
    inviteDecline: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, marginRight: 2 },
    inviteDeclineText: { ...typography.small, color: C.textSecondary, fontWeight: '600' },
    inviteAccept:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginRight: spacing.sm },
    inviteAcceptText: { ...typography.small, color: '#fff', fontWeight: '700' },

    // ── Game card ──────────────────────────────────────────────────────────────
    gameCard: {
      backgroundColor: C.surface, borderRadius: radius.lg,
      borderWidth: 1, borderColor: C.border, marginBottom: spacing.lg,
      overflow: 'hidden', ...shadows.card,
    },
    gameCardHero:      { paddingVertical: spacing.lg + 4, paddingHorizontal: spacing.md, overflow: 'hidden', position: 'relative' },
    heroPatternDot:    { position: 'absolute', borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.08)' },
    heroPatternDot1:   { width: 80, height: 80, top: -20, right: -20 },
    heroPatternDot2:   { width: 50, height: 50, top: 30, right: 50 },
    heroPatternDot3:   { width: 120, height: 120, bottom: -40, left: -30 },
    gameCardHeroInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, zIndex: 1 },
    heroEmoji:         { fontSize: 52, lineHeight: 60 },
    heroTextBlock:     { flex: 1 },
    heroName:          { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
    heroTagline:       { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', fontWeight: '500' },
    heroPlayersBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, alignSelf: 'flex-end' },
    heroPlayersText:   { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
    heroLiveBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,230,118,0.30)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, alignSelf: 'flex-end', borderWidth: 1, borderColor: 'rgba(0,230,118,0.5)' },
    heroLiveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676' },
    heroLiveText:      { fontSize: 11, fontWeight: '700', color: '#00E676', letterSpacing: 0.3 },

    hotBadge: {
      position: 'absolute', top: spacing.sm, right: spacing.sm,
      backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: spacing.sm,
      paddingVertical: 3, borderRadius: radius.full, zIndex: 2,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    },
    hotBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

    gameCardBody:  { padding: spacing.md },
    gameCardDesc:  { ...typography.small, color: C.textSecondary, lineHeight: 19, marginBottom: spacing.sm },
    tagsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    tag:           { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
    tagText:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

    gameCardBtnRow: { flexDirection: 'row', gap: spacing.sm },
    soloBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, backgroundColor: C.background,
    },
    soloBtnText:    { ...typography.caption, fontWeight: '700' },
    friendsBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
    friendsBtnText: { ...typography.caption, fontWeight: '700', color: '#fff' },

    // ── Coming soon ────────────────────────────────────────────────────────────
    comingSoonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    comingSoonCard: {
      width: '47%', backgroundColor: C.surface, borderRadius: radius.lg,
      borderWidth: 1.5, padding: spacing.md, alignItems: 'center', gap: spacing.xs, opacity: 0.85,
    },
    comingSoonIconWrap: { width: 58, height: 58, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
    comingSoonEmoji:    { fontSize: 30 },
    comingSoonName:     { ...typography.caption, fontWeight: '700', color: C.text, textAlign: 'center' },
    soonBadge:          { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FDCB6E22', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: '#FDCB6E50' },
    soonText:           { ...typography.small, fontWeight: '700', color: '#B7791F' },
  });
}
