import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import { spacing, typography, radius } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { GameRoom, GamesStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'GameLobby'>;
type Rt  = RouteProp<GamesStackParamList, 'GameLobby'>;

const GAME_NAME: Record<string, string> = {
  ludo: 'Ludo', 'truth-dare': 'Truth or Dare', uno: 'UNO', chess: 'Chess', bet: 'Stake It',
};

const GAME_COLOR: Record<string, string> = {
  ludo: '#6C5CE7', 'truth-dare': '#FF4B6E', uno: '#E17055', chess: '#4A4A6A', bet: '#FDCB6E',
};

export default function GameLobbyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { roomId, gameId } = route.params;
  const { firebaseUser } = useAuthStore();
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'joining' | 'joined' | 'leaving'>('idle');
  const [muted, setMuted] = useState(false);
  const voiceRef = useRef<VoiceClient | null>(null);
  const hasNavigatedToGame = useRef(false);

  const gameColor = GAME_COLOR[gameId] ?? C.primary;

  useEffect(() => {
    const unsub = subscribeToGameRoom(roomId, setRoom);
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (!room || hasNavigatedToGame.current) return;
    if (room.status === 'playing') {
      hasNavigatedToGame.current = true;
      if (gameId === 'ludo') navigation.replace('LudoGame', { roomId });
      else                   navigation.replace('TruthOrDare', { roomId });
    }
  }, [room, gameId, navigation, roomId]);

  useEffect(() => {
    return () => { voiceRef.current?.leave().catch(() => {}); voiceRef.current = null; };
  }, []);

  if (!firebaseUser) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.centered}>
          <Text style={styles.muted}>Sign in required.</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.root}>
        {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F']} style={StyleSheet.absoluteFill} />}
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={gameColor} size="large" />
          <Text style={[styles.muted, { marginTop: spacing.md }]}>Loading room…</Text>
        </SafeAreaView>
      </View>
    );
  }

  const me         = room.players[firebaseUser.uid];
  const isHost     = room.hostUid === firebaseUser.uid;
  const playerList = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const allReady   = playerList.length >= 2 && playerList.every((p) => p.ready);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function toggleReady() {
    if (!me || busy) return;
    setBusy(true);
    try { await setPlayerReady(roomId, firebaseUser!.uid, !me.ready); }
    catch { Alert.alert('Error', 'Could not update ready status.'); }
    finally { setBusy(false); }
  }

  async function startGame() {
    if (busy) return;
    setBusy(true);
    try { await startGameRoom(roomId); }
    catch { Alert.alert('Error', 'Could not start the game.'); }
    finally { setBusy(false); }
  }

  async function leaveRoom() {
    try {
      await voiceRef.current?.leave().catch(() => {});
      voiceRef.current = null;
      await leaveGameRoom(roomId, firebaseUser!.uid);
      navigation.goBack();
    } catch { Alert.alert('Error', 'Could not leave the room.'); }
  }

  // ── Voice ────────────────────────────────────────────────────────────────────

  async function joinVoice() {
    if (voiceState !== 'idle') return;
    setVoiceState('joining');
    try {
      const token = await fetchVoiceToken(roomId);
      const client = createVoiceClient();
      client.on('joined', () => setVoiceState('joined'));
      client.on('left',   () => setVoiceState('idle'));
      client.on('error',  (e) => console.warn('[voice] error', e));
      await client.join(token.token, token.roomUrl);
      voiceRef.current = client;
    } catch {
      Alert.alert('Voice unavailable', 'Could not join voice. Check your backend or try a dev build.');
      setVoiceState('idle');
    }
  }

  async function toggleMute() {
    if (!voiceRef.current) return;
    try { setMuted(await voiceRef.current.toggleMute()); } catch { /* ignore */ }
  }

  async function leaveVoice() {
    if (!voiceRef.current) return;
    setVoiceState('leaving');
    try { await voiceRef.current.leave(); }
    finally { voiceRef.current = null; setVoiceState('idle'); setMuted(false); }
  }

  return (
    <View style={styles.root}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}
      <SafeAreaView style={styles.flex} edges={['top']}>

        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744'] : [C.background, C.surface]}
          style={styles.header}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity onPress={leaveRoom} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{GAME_NAME[gameId] ?? 'Game'} Lobby</Text>
          <TouchableOpacity onPress={leaveRoom} style={styles.leaveBtn}>
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Room Code Badge */}
          <LinearGradient colors={[gameColor + '25', gameColor + '10']} style={styles.roomBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={[styles.roomColorDot, { backgroundColor: gameColor }]} />
            <Text style={styles.roomBadgeLabel}>Room</Text>
            <Text style={[styles.roomBadgeCode, { color: gameColor }]}>{roomId.slice(0, 6).toUpperCase()}</Text>
          </LinearGradient>

          {/* Players */}
          <Text style={styles.sectionLabel}>PLAYERS ({playerList.length}/{room.maxPlayers})</Text>
          {playerList.map((p) => (
            <View key={p.uid} style={styles.playerRow}>
              <View style={{ position: 'relative' }}>
                <Avatar name={p.name} photoURL={p.photoURL} size={44} />
                {p.ready && (
                  <View style={styles.readyDot}>
                    <Ionicons name="checkmark" size={9} color="#fff" />
                  </View>
                )}
              </View>
              <View style={styles.playerInfo}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  {p.isHost && (
                    <LinearGradient colors={[gameColor, gameColor + 'CC']} style={styles.hostBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="star" size={9} color="#fff" />
                      <Text style={styles.hostBadgeText}>HOST</Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={[styles.playerStatus, { color: p.ready ? C.success : C.textSecondary }]}>
                  {p.ready ? '✓ Ready' : 'Not ready yet'}
                </Text>
              </View>
            </View>
          ))}

          {/* Voice Chat */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>VOICE CHAT</Text>
          <View style={styles.voiceCard}>
            {voiceState === 'idle' && (
              <TouchableOpacity onPress={joinVoice} activeOpacity={0.85}>
                <LinearGradient colors={['#6C5CE7', '#A855F7']} style={styles.voiceJoinBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="mic-outline" size={18} color="#fff" />
                  <Text style={styles.voiceJoinText}>Join Voice Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {voiceState === 'joining' && (
              <View style={styles.voiceRow}>
                <ActivityIndicator color={C.primary} />
                <Text style={styles.voiceHint}>Connecting to voice…</Text>
              </View>
            )}
            {voiceState === 'joined' && (
              <View style={styles.voiceRow}>
                <TouchableOpacity style={[styles.voiceBtn, muted && styles.voiceBtnMuted]} onPress={toggleMute} activeOpacity={0.8}>
                  <Ionicons name={muted ? 'mic-off-outline' : 'mic-outline'} size={16} color="#fff" />
                  <Text style={styles.voiceBtnText}>{muted ? 'Unmute' : 'Mute'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.voiceLeaveBtn} onPress={leaveVoice}>
                  <Ionicons name="call-outline" size={16} color={C.error} />
                  <Text style={styles.voiceLeaveText}>Leave</Text>
                </TouchableOpacity>
              </View>
            )}
            {voiceState === 'leaving' && (
              <View style={styles.voiceRow}>
                <ActivityIndicator color={C.primary} />
                <Text style={styles.voiceHint}>Leaving voice…</Text>
              </View>
            )}
          </View>

          {/* Ready / Start */}
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {me && (
              <TouchableOpacity onPress={toggleReady} disabled={busy} activeOpacity={0.85}>
                {me.ready ? (
                  <LinearGradient colors={['#00E676', '#00B894']} style={styles.readyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.readyBtnText}>Ready! Tap to unready</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.readyBtn, { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border }]}>
                    <Ionicons name="radio-button-off" size={18} color={C.textSecondary} />
                    <Text style={[styles.readyBtnText, { color: C.text }]}>Tap to Ready Up</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {isHost && (
              <TouchableOpacity onPress={startGame} disabled={!allReady || busy} activeOpacity={0.85} style={(!allReady || busy) ? { opacity: 0.45 } : {}}>
                <LinearGradient colors={[gameColor, gameColor + 'CC']} style={styles.startBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="rocket-outline" size={18} color="#fff" />
                      <Text style={styles.startBtnText}>
                        {allReady ? 'Start Game' : 'Waiting for all players…'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {!isHost && (
              <Text style={styles.waitHint}>Waiting for the host to start the game…</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.background },
    flex:    { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    muted:   { ...typography.body, color: C.textSecondary },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: '#ffffff10',
    },
    backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.heading, color: C.text, fontWeight: '700' },
    leaveBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: C.error + '18', borderWidth: 1, borderColor: C.error + '40' },
    leaveText:   { ...typography.caption, color: C.error, fontWeight: '700' },

    scroll: { padding: spacing.lg, paddingBottom: 100 },

    roomBadge: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, marginBottom: spacing.lg,
      alignSelf: 'center', borderWidth: 1, borderColor: '#ffffff15',
    },
    roomColorDot:  { width: 10, height: 10, borderRadius: 5 },
    roomBadgeLabel: { ...typography.small, color: C.textSecondary, fontWeight: '600', letterSpacing: 1 },
    roomBadgeCode:  { ...typography.body, fontWeight: '800', letterSpacing: 3 },

    sectionLabel: { ...typography.small, fontWeight: '800', color: C.textSecondary, letterSpacing: 1.2, marginBottom: spacing.sm },

    playerRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.md, backgroundColor: C.surface,
      borderRadius: radius.md, marginBottom: spacing.sm,
      borderWidth: 1, borderColor: C.border,
    },
    readyDot: { position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: '#00E676', borderWidth: 2, borderColor: C.background, alignItems: 'center', justifyContent: 'center' },
    playerInfo: { flex: 1 },
    playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    playerName: { ...typography.body, fontWeight: '700', color: C.text },
    hostBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
    hostBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
    playerStatus: { ...typography.small, marginTop: 3 },

    voiceCard: { backgroundColor: C.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: C.border },
    voiceRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    voiceHint: { ...typography.caption, color: C.textSecondary },
    voiceJoinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.sm, borderRadius: radius.md },
    voiceJoinText: { ...typography.body, color: '#fff', fontWeight: '700' },
    voiceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primary, paddingVertical: spacing.sm, borderRadius: radius.md },
    voiceBtnMuted: { backgroundColor: C.textSecondary },
    voiceBtnText: { ...typography.caption, color: '#fff', fontWeight: '700' },
    voiceLeaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: C.error + '50', backgroundColor: C.error + '12' },
    voiceLeaveText: { ...typography.caption, color: C.error, fontWeight: '700' },

    readyBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, borderRadius: radius.lg },
    readyBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },
    startBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, borderRadius: radius.lg },
    startBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },
    waitHint:     { ...typography.caption, color: C.textSecondary, textAlign: 'center', marginTop: spacing.md },
  });
}
