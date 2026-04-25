import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GamesStackParamList, GameInvite, GameRoomPlayer } from '../../types';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { useAuthStore } from '../../store/authStore';
import {
  subscribeToIncomingInvites,
  respondToGameInvite,
  joinGameRoom,
} from '../../utils/firestore-helpers';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'GamesList'>;

interface GameItem {
  id: 'ludo' | 'truth-dare' | 'uno' | 'chess' | 'bet';
  emoji: string;
  name: string;
  tagline: string;
  description: string;
  players: string;
  color: string;
  accentDark: string;
  tags: string[];
  available: true;
}

interface ComingSoonItem {
  id: string;
  emoji: string;
  name: string;
  color: string;
  available: false;
}

type AnyGame = GameItem | ComingSoonItem;

const LIVE_GAMES: GameItem[] = [
  {
    id:          'ludo',
    emoji:       '🎲',
    name:        'Ludo',
    tagline:     'Roll, move, capture!',
    description: 'Classic board game — 4 colored pieces, race to home. Beat your opponent before they beat you.',
    players:     '2 players',
    color:       '#6C5CE7',
    accentDark:  '#4C3BC7',
    tags:        ['Board Game', 'Strategy', 'Classic'],
    available:   true,
  },
  {
    id:          'truth-dare',
    emoji:       '🎯',
    name:        'Truth or Dare',
    tagline:     'How well do you know each other?',
    description: 'Confess truths, survive dares. 5 spice levels from Mild to 🔞 Extreme — choose wisely.',
    players:     '2–4 players',
    color:       '#FF4B6E',
    accentDark:  '#D4284A',
    tags:        ['Party', '18+ Mode', 'Ice Breaker'],
    available:   true,
  },
  {
    id:          'uno',
    emoji:       '🃏',
    name:        'UNO',
    tagline:     'Draw, skip, reverse — and shout UNO!',
    description: 'The classic card game fully playable on Drift. Special cards, Wild draws, and the pressure of being last.',
    players:     '2–4 players',
    color:       '#E17055',
    accentDark:  '#C0533A',
    tags:        ['Card Game', 'Party', 'Fast-paced'],
    available:   true,
  },
  {
    id:          'chess',
    emoji:       '♟️',
    name:        'Chess',
    tagline:     'The ultimate battle of minds.',
    description: 'Full chess with all rules — castling, en passant, check & checkmate. Pass-and-play on one device.',
    players:     '2 players',
    color:       '#2D3436',
    accentDark:  '#1A1A2E',
    tags:        ['Strategy', 'Classic', 'Brain Game'],
    available:   true,
  },
  {
    id:          'bet',
    emoji:       '🎰',
    name:        'Stake It',
    tagline:     'Set the stakes. Make it personal.',
    description: 'Truth or Dare with a twist — the GROUP sets the consequences, you bet Drift coins, and raise the stakes each round.',
    players:     '2–6 players',
    color:       '#FDCB6E',
    accentDark:  '#B7791F',
    tags:        ['Party', 'Betting', 'Custom Stakes'],
    available:   true,
  },
];

const COMING_SOON: ComingSoonItem[] = [
  { id: 'trivia',      emoji: '🧠', name: 'Trivia',      color: '#00B894', available: false },
  { id: 'drift-world', emoji: '🌍', name: 'Drift World', color: '#0984E3', available: false },
];

const GAME_DISPLAY: Record<string, { name: string; emoji: string }> = {
  ludo:         { name: 'Ludo',          emoji: '🎲' },
  'truth-dare': { name: 'Truth or Dare', emoji: '🎯' },
  uno:          { name: 'UNO',           emoji: '🃏' },
  chess:        { name: 'Chess',         emoji: '♟️' },
  bet:          { name: 'Stake It',      emoji: '🎰' },
};

export default function GamesScreen() {
  const navigation = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();

  const [invites, setInvites] = useState<GameInvite[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeToIncomingInvites(firebaseUser.uid, setInvites);
    return () => unsub();
  }, [firebaseUser]);

  function handleSolo(game: GameItem) {
    if (game.id === 'ludo')        navigation.navigate('LudoGame');
    else if (game.id === 'truth-dare') navigation.navigate('TruthOrDare');
    else if (game.id === 'uno')    navigation.navigate('UnoGame');
    else if (game.id === 'chess')  navigation.navigate('ChessGame');
    else if (game.id === 'bet')    navigation.navigate('BetGame');
  }

  function handleWithFriends(game: GameItem) {
    // Multiplayer lobby only supported for ludo & truth-dare (Firestore-backed rooms).
    // Uno, Chess, Bet are local pass-and-play — launch directly.
    if (game.id === 'uno')   { navigation.navigate('UnoGame'); return; }
    if (game.id === 'chess') { navigation.navigate('ChessGame'); return; }
    if (game.id === 'bet')   { navigation.navigate('BetGame'); return; }
    navigation.navigate('GameInvite', { gameId: game.id });
  }

  function handleComingSoon(game: ComingSoonItem) {
    Alert.alert('Coming Soon! 🚧', `${game.emoji} ${game.name} is under construction.\nCheck back soon for an update!`);
  }

  async function handleAcceptInvite(invite: GameInvite) {
    if (!firebaseUser || !userProfile) return;
    try {
      await respondToGameInvite(invite.id, 'accepted');
      const selfPlayer: GameRoomPlayer = {
        uid:      firebaseUser.uid,
        name:     userProfile.name,
        // only include photoURL if it exists — undefined crashes Firestore
        ...(userProfile.photoURL ? { photoURL: userProfile.photoURL } : {}),
        ready:    false,
        isHost:   false,
        joinedAt: Date.now(),
      };
      await joinGameRoom(invite.roomId, selfPlayer);
      navigation.navigate('GameLobby', { roomId: invite.roomId, gameId: invite.gameId });
    } catch {
      Alert.alert('Could not join', 'The room may no longer be available.');
    }
  }

  async function handleDeclineInvite(invite: GameInvite) {
    try {
      await respondToGameInvite(invite.id, 'declined');
    } catch {
      // non-fatal
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Games 🎮</Text>
          <Text style={styles.headerSub}>Play solo or challenge friends</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{LIVE_GAMES.length} live</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Incoming Invites ─────────────────────────────────────────────── */}
        {invites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>INCOMING INVITES</Text>
              <View style={styles.invitePingDot} />
            </View>
            {invites.map((invite) => {
              const info = GAME_DISPLAY[invite.gameId] ?? { name: invite.gameId, emoji: '🎮' };
              return (
                <View key={invite.id} style={styles.inviteCard}>
                  <View style={styles.inviteEmojiWrap}>
                    <Text style={styles.inviteEmoji}>{info.emoji}</Text>
                  </View>
                  <View style={styles.inviteInfo}>
                    <Text style={styles.inviteTitle}>{invite.fromName}</Text>
                    <Text style={styles.inviteSub}>wants to play {info.name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.inviteDecline}
                    onPress={() => handleDeclineInvite(invite)}
                  >
                    <Text style={styles.inviteDeclineText}>Pass</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inviteAccept}
                    onPress={() => handleAcceptInvite(invite)}
                  >
                    <Text style={styles.inviteAcceptText}>Join →</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Available Now ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AVAILABLE NOW</Text>
          {LIVE_GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onSolo={() => handleSolo(game)}
              onFriends={() => handleWithFriends(game)}
            />
          ))}
        </View>

        {/* ── Coming Soon ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMING SOON</Text>
          <View style={styles.comingSoonGrid}>
            {COMING_SOON.map((game) => (
              <TouchableOpacity
                key={game.id}
                style={[styles.comingSoonCard, { borderColor: game.color + '30' }]}
                onPress={() => handleComingSoon(game)}
                activeOpacity={0.7}
              >
                <View style={[styles.comingSoonIconWrap, { backgroundColor: game.color + '15' }]}>
                  <Text style={styles.comingSoonEmoji}>{game.emoji}</Text>
                </View>
                <Text style={styles.comingSoonName}>{game.name}</Text>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>Soon</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── GameCard Sub-component ───────────────────────────────────────────────────

interface GameCardProps {
  game: GameItem;
  onSolo: () => void;
  onFriends: () => void;
}

function GameCard({ game, onSolo, onFriends }: GameCardProps) {
  return (
    <View style={styles.gameCard}>
      {/* Colored hero area */}
      <View style={[styles.gameCardHero, { backgroundColor: game.color }]}>
        {/* Background pattern dots */}
        <View style={[styles.heroPatternDot, styles.heroPatternDot1]} />
        <View style={[styles.heroPatternDot, styles.heroPatternDot2]} />
        <View style={[styles.heroPatternDot, styles.heroPatternDot3]} />

        <View style={styles.gameCardHeroInner}>
          <Text style={styles.heroEmoji}>{game.emoji}</Text>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroName}>{game.name}</Text>
            <Text style={styles.heroTagline}>{game.tagline}</Text>
          </View>
          <View style={[styles.heroPlayersBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.heroPlayersText}>{game.players}</Text>
          </View>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.gameCardBody}>
        <Text style={styles.gameCardDesc}>{game.description}</Text>

        {/* Tags */}
        <View style={styles.tagsRow}>
          {game.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: game.color + '12', borderColor: game.color + '30' }]}>
              <Text style={[styles.tagText, { color: game.color }]}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.gameCardBtnRow}>
          <TouchableOpacity
            style={[styles.soloBtn, { borderColor: game.color }]}
            onPress={onSolo}
            activeOpacity={0.8}
          >
            <Text style={styles.soloBtnIcon}>👤</Text>
            <Text style={[styles.soloBtnText, { color: game.color }]}>Solo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.friendsBtn, { backgroundColor: game.color }]}
            onPress={onFriends}
            activeOpacity={0.85}
          >
            <Text style={styles.friendsBtnIcon}>👥</Text>
            <Text style={styles.friendsBtnText}>Play with Friends</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',
    padding:            spacing.lg,
    borderBottomWidth:  1,
    borderBottomColor:  colors.border,
  },
  headerTitle: {
    ...typography.heading,
    fontSize: 22,
    color: colors.text,
    fontWeight: '800',
  },
  headerSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  headerBadgeText: {
    ...typography.small,
    fontWeight: '700',
    color: colors.success,
  },

  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.small,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  invitePingDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },

  // ── Invites ────────────────────────────────────────────────────────────────
  inviteCard: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              spacing.sm,
    backgroundColor:  colors.primary + '08',
    borderRadius:     radius.lg,
    borderWidth:      1.5,
    borderColor:      colors.primary + '30',
    padding:          spacing.md,
    marginBottom:     spacing.sm,
  },
  inviteEmojiWrap: {
    width:            44,
    height:           44,
    borderRadius:     radius.md,
    backgroundColor:  colors.primary + '15',
    alignItems:       'center',
    justifyContent:   'center',
  },
  inviteEmoji:     { fontSize: 22 },
  inviteInfo:      { flex: 1 },
  inviteTitle:     { ...typography.body, fontWeight: '700', color: colors.text },
  inviteSub:       { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  inviteDecline: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    backgroundColor:   colors.surface,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  inviteDeclineText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  inviteAccept: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    backgroundColor:   colors.primary,
  },
  inviteAcceptText: { ...typography.small, color: '#fff', fontWeight: '700' },

  // ── Game Card ──────────────────────────────────────────────────────────────
  gameCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    marginBottom:    spacing.lg,
    overflow:        'hidden',
    ...shadows.card,
  },
  gameCardHero: {
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.md,
    overflow:          'hidden',
    position:          'relative',
  },
  heroPatternDot: {
    position:      'absolute',
    borderRadius:  radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroPatternDot1: { width: 80, height: 80,  top: -20, right: -20 },
  heroPatternDot2: { width: 50, height: 50,  top: 30,  right: 50  },
  heroPatternDot3: { width: 120, height: 120, bottom: -40, left: -30 },

  gameCardHeroInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    zIndex:        1,
  },
  heroEmoji: {
    fontSize:   52,
    lineHeight: 60,
  },
  heroTextBlock: { flex: 1 },
  heroName: {
    fontSize:    22,
    fontWeight:  '800',
    color:       '#fff',
    marginBottom: 2,
  },
  heroTagline: {
    fontSize:   13,
    color:      'rgba(255,255,255,0.8)',
    fontStyle:  'italic',
    fontWeight: '500',
  },
  heroPlayersBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      radius.full,
    alignSelf:         'flex-start',
  },
  heroPlayersText: {
    fontSize:   11,
    fontWeight: '700',
    color:      '#fff',
    letterSpacing: 0.5,
  },

  gameCardBody: {
    padding: spacing.md,
  },
  gameCardDesc: {
    ...typography.small,
    color:        colors.textSecondary,
    lineHeight:   19,
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginBottom:  spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    borderRadius:      radius.full,
    borderWidth:       1,
  },
  tagText: {
    fontSize:   11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  gameCardBtnRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  soloBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
    paddingVertical: spacing.sm,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    backgroundColor: colors.background,
  },
  soloBtnIcon: { fontSize: 14 },
  soloBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },
  friendsBtn: {
    flex:            2,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: spacing.sm,
    borderRadius:    radius.md,
  },
  friendsBtnIcon: { fontSize: 14 },
  friendsBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color:      '#fff',
  },

  // ── Coming Soon Grid ───────────────────────────────────────────────────────
  comingSoonGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  comingSoonCard: {
    width:           '47%',
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     1.5,
    padding:         spacing.md,
    alignItems:      'center',
    gap:             spacing.xs,
    opacity:         0.8,
  },
  comingSoonIconWrap: {
    width:          56,
    height:         56,
    borderRadius:   radius.lg,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.xs,
  },
  comingSoonEmoji: { fontSize: 30 },
  comingSoonName:  {
    ...typography.caption,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  soonBadge: {
    backgroundColor:  '#FDCB6E33',
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       '#FDCB6E60',
  },
  soonText: {
    ...typography.small,
    fontWeight: '700',
    color:      '#B7791F',
  },
});
