import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../store/authStore';
import {
  subscribeToGameRoom,
  setPlayerReady,
  startGameRoom,
  leaveGameRoom,
} from '../../utils/firestore-helpers';
import {
  fetchVoiceToken,
  createVoiceClient,
  VoiceClient,
} from '../../services/voiceService';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { GameRoom, GamesStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'GameLobby'>;
type Rt  = RouteProp<GamesStackParamList, 'GameLobby'>;

const GAME_NAME: Record<string, string> = {
  ludo:         'Ludo',
  'truth-dare': 'Truth or Dare',
  uno:          'UNO',
  chess:        'Chess',
  bet:          'Stake It',
};

export default function GameLobbyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { roomId, gameId } = route.params;
  const { firebaseUser } = useAuthStore();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [busy, setBusy] = useState(false);

  // Voice
  const [voiceState, setVoiceState] = useState<'idle' | 'joining' | 'joined' | 'leaving'>('idle');
  const [muted, setMuted] = useState(false);
  const voiceRef = useRef<VoiceClient | null>(null);

  // Track whether we've navigated into the game already (avoid double-navigate)
  const hasNavigatedToGame = useRef(false);

  useEffect(() => {
    const unsub = subscribeToGameRoom(roomId, setRoom);
    return () => unsub();
  }, [roomId]);

  // When status flips to 'playing', everyone auto-navigates into the game
  useEffect(() => {
    if (!room || hasNavigatedToGame.current) return;
    if (room.status === 'playing') {
      hasNavigatedToGame.current = true;
      if (gameId === 'ludo') {
        navigation.replace('LudoGame', { roomId });
      } else {
        navigation.replace('TruthOrDare', { roomId });
      }
    }
  }, [room, gameId, navigation, roomId]);

  // Clean up voice on unmount
  useEffect(() => {
    return () => {
      voiceRef.current?.leave().catch(() => {});
      voiceRef.current = null;
    };
  }, []);

  if (!firebaseUser) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.muted}>Sign in required.</Text>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.muted, { marginTop: spacing.md }]}>Loading room…</Text>
      </SafeAreaView>
    );
  }

  const me = room.players[firebaseUser.uid];
  const isHost = room.hostUid === firebaseUser.uid;
  const playerList = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const allReady = playerList.length >= 2 && playerList.every((p) => p.ready);

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function toggleReady() {
    if (!me || busy) return;
    setBusy(true);
    try {
      await setPlayerReady(roomId, firebaseUser!.uid, !me.ready);
    } catch {
      Alert.alert('Error', 'Could not update ready status.');
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (busy) return;
    setBusy(true);
    try {
      await startGameRoom(roomId);
      // Navigation happens in the useEffect once Firestore emits the update.
    } catch {
      Alert.alert('Error', 'Could not start the game.');
    } finally {
      setBusy(false);
    }
  }

  async function leaveRoom() {
    try {
      await voiceRef.current?.leave().catch(() => {});
      voiceRef.current = null;
      await leaveGameRoom(roomId, firebaseUser!.uid);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not leave the room.');
    }
  }

  // ─── Voice ──────────────────────────────────────────────────────────────────

  async function joinVoice() {
    if (voiceState !== 'idle') return;
    setVoiceState('joining');
    try {
      const token = await fetchVoiceToken(roomId);
      const client = createVoiceClient();
      client.on('joined',   () => setVoiceState('joined'));
      client.on('left',     () => setVoiceState('idle'));
      client.on('error',    (e) => console.warn('[voice] error', e));
      await client.join(token.token, token.roomUrl);
      voiceRef.current = client;
    } catch (err) {
      console.error(err);
      Alert.alert('Voice unavailable', 'Could not join voice. Check your backend or try a dev build.');
      setVoiceState('idle');
    }
  }

  async function toggleMute() {
    if (!voiceRef.current) return;
    try {
      const nowMuted = await voiceRef.current.toggleMute();
      setMuted(nowMuted);
    } catch {
      // ignore
    }
  }

  async function leaveVoice() {
    if (!voiceRef.current) return;
    setVoiceState('leaving');
    try {
      await voiceRef.current.leave();
    } finally {
      voiceRef.current = null;
      setVoiceState('idle');
      setMuted(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leaveRoom}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{GAME_NAME[gameId] ?? 'Game'} Lobby</Text>
        <TouchableOpacity onPress={leaveRoom}>
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeLabel}>Room</Text>
          <Text style={styles.roomBadgeCode}>{roomId.slice(0, 6).toUpperCase()}</Text>
        </View>

        <Text style={styles.sectionLabel}>PLAYERS ({playerList.length}/{room.maxPlayers})</Text>
        {playerList.map((p) => (
          <View key={p.uid} style={styles.playerRow}>
            <Avatar name={p.name} photoURL={p.photoURL} size={44} />
            <View style={styles.playerInfo}>
              <View style={styles.playerNameRow}>
                <Text style={styles.playerName}>{p.name}</Text>
                {p.isHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>HOST</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.playerStatus,
                { color: p.ready ? colors.success : colors.textSecondary },
              ]}>
                {p.ready ? '✓ Ready' : 'Not ready'}
              </Text>
            </View>
          </View>
        ))}

        {/* Voice controls */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>VOICE CHAT</Text>
        <View style={styles.voiceCard}>
          {voiceState === 'idle' && (
            <TouchableOpacity style={styles.voiceJoinBtn} onPress={joinVoice}>
              <Text style={styles.voiceJoinText}>🎙️  Join Voice</Text>
            </TouchableOpacity>
          )}
          {voiceState === 'joining' && (
            <View style={styles.voiceRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.voiceHint}>Connecting to voice…</Text>
            </View>
          )}
          {voiceState === 'joined' && (
            <View style={styles.voiceRow}>
              <TouchableOpacity
                style={[styles.voiceBtn, muted && styles.voiceBtnMuted]}
                onPress={toggleMute}
              >
                <Text style={styles.voiceBtnText}>{muted ? '🔇 Unmute' : '🎙️  Mute'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceLeaveBtn} onPress={leaveVoice}>
                <Text style={styles.voiceLeaveText}>Leave Voice</Text>
              </TouchableOpacity>
            </View>
          )}
          {voiceState === 'leaving' && (
            <View style={styles.voiceRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.voiceHint}>Leaving voice…</Text>
            </View>
          )}
        </View>

        {/* Ready / Start */}
        <View style={{ marginTop: spacing.xl }}>
          {me && (
            <TouchableOpacity
              style={[
                styles.readyBtn,
                me.ready ? styles.readyBtnOn : styles.readyBtnOff,
              ]}
              onPress={toggleReady}
              disabled={busy}
            >
              <Text style={styles.readyBtnText}>
                {me.ready ? '✓ Ready — tap to unready' : 'Tap to Ready up'}
              </Text>
            </TouchableOpacity>
          )}

          {isHost && (
            <TouchableOpacity
              style={[
                styles.startBtn,
                (!allReady || busy) && styles.startBtnDisabled,
              ]}
              onPress={startGame}
              disabled={!allReady || busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.startBtnText}>
                  {allReady ? '🚀 Start Game' : 'Waiting for all players to ready up'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {!isHost && (
            <Text style={styles.waitHint}>
              Waiting for the host to start the game…
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  muted:    { ...typography.body, color: colors.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backIcon:    { fontSize: 22, color: colors.text, width: 60 },
  headerTitle: { ...typography.heading, color: colors.text },
  leaveText:   { ...typography.caption, color: colors.error, fontWeight: '600', width: 60, textAlign: 'right' },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  roomBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.primary}10`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  roomBadgeLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600', letterSpacing: 1 },
  roomBadgeCode:  { ...typography.body, color: colors.primary, fontWeight: '700', letterSpacing: 2 },

  sectionLabel: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  playerInfo: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerName: { ...typography.body, fontWeight: '600', color: colors.text },
  hostBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full,
  },
  hostBadgeText: { ...typography.small, color: '#fff', fontWeight: '700', fontSize: 10 },
  playerStatus: { ...typography.small, marginTop: 2 },

  voiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voiceHint: { ...typography.caption, color: colors.textSecondary },
  voiceJoinBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  voiceJoinText: { ...typography.body, color: '#fff', fontWeight: '700' },
  voiceBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  voiceBtnMuted: { backgroundColor: colors.textSecondary },
  voiceBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
  voiceLeaveBtn: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  voiceLeaveText: { ...typography.caption, color: colors.error, fontWeight: '600' },

  readyBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  readyBtnOn:  { backgroundColor: colors.success },
  readyBtnOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  readyBtnText: { ...typography.body, fontWeight: '700', color: colors.text },

  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },

  waitHint: {
    ...typography.caption, color: colors.textSecondary,
    textAlign: 'center', marginTop: spacing.md,
  },
});
