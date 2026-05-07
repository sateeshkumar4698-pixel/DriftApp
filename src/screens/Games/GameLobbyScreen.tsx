import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ExpoClipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// ─── Lazy-load react-native-webview so older binaries don't crash ─────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeWebView: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NativeWebView = require('react-native-webview').WebView;
} catch { /* Native module not compiled into this binary */ }
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../store/authStore';
import {
  subscribeToGameRoom,
  setPlayerReady,
  startGameRoom,
  leaveGameRoom,
  subscribeToConnections,
  getUserProfile,
  sendGameInvite,
} from '../../utils/firestore-helpers';
// Voice uses Jitsi Meet — no backend required
import Avatar from '../../components/Avatar';
import { spacing, typography, radius } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import {
  Connection,
  GameInvite,
  GameRoom,
  GamesStackParamList,
  UserProfile,
} from '../../types';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'GameLobby'>;
type Rt  = RouteProp<GamesStackParamList, 'GameLobby'>;

const GAME_NAME: Record<string, string> = {
  ludo: 'Ludo', 'truth-dare': 'Truth or Dare', wyr: 'Would You Rather', uno: 'UNO', chess: 'Chess', bet: 'Stake It',
};

const GAME_COLOR: Record<string, string> = {
  ludo: '#6C5CE7', 'truth-dare': '#FF4B6E', wyr: '#00B894', uno: '#E17055', chess: '#4A4A6A', bet: '#FDCB6E',
};

export default function GameLobbyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { roomId, gameId } = route.params;
  const { firebaseUser, userProfile } = useAuthStore();
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);

  const [room, setRoom]           = useState<GameRoom | null>(null);
  const [busy, setBusy]           = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Voice
  const [voiceState, setVoiceState]   = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');
  const [voiceRoomUrl, setVoiceRoomUrl] = useState<string | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Invite More
  const [showInviteModal, setShowInviteModal]   = useState(false);
  const [connections, setConnections]           = useState<Connection[]>([]);
  const [profiles, setProfiles]                 = useState<Record<string, UserProfile>>({});
  const [inviteSelected, setInviteSelected]     = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites]     = useState(false);

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
      if (gameId === 'ludo')       navigation.replace('LudoGame', { roomId });
      else if (gameId === 'wyr')   navigation.replace('WouldYouRather', { roomId });
      else                         navigation.replace('TruthOrDare', { roomId });
    }
  }, [room, gameId, navigation, roomId]);

  useEffect(() => {
    return () => { setShowVoiceModal(false); setVoiceRoomUrl(null); };
  }, []);

  // ── Invite More: load connections when modal opens ──────────────────────────
  useEffect(() => {
    if (!showInviteModal || !firebaseUser) return;
    const unsub = subscribeToConnections(firebaseUser.uid, setConnections);
    return () => unsub();
  }, [showInviteModal, firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const missing = connections
      .map((c) => c.users.find((u) => u !== uid))
      .filter((u): u is string => !!u && !profiles[u]);
    if (!missing.length) return;
    Promise.all(missing.map(async (u) => {
      const p = await getUserProfile(u);
      if (p) setProfiles((prev) => ({ ...prev, [u]: p }));
    }));
  }, [connections, firebaseUser]);

  const inviteRows = useMemo(() => {
    if (!firebaseUser || !room) return [];
    return connections
      .map((c) => {
        const otherUid = c.users.find((u) => u !== firebaseUser.uid) ?? '';
        return { otherUid, profile: profiles[otherUid] };
      })
      .filter((r) => !!r.profile && !room.players[r.otherUid]);
  }, [connections, profiles, firebaseUser, room]);

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
      setShowVoiceModal(false);
      setVoiceRoomUrl(null);
      await leaveGameRoom(roomId, firebaseUser!.uid);
      navigation.goBack();
    } catch { Alert.alert('Error', 'Could not leave the room.'); }
  }

  // ── Voice: Jitsi Meet — completely free, no backend, no API key ──────────────

  function joinVoice() {
    if (voiceState !== 'idle' && voiceState !== 'error') return;
    // All players in this room join the same Jitsi channel automatically
    const jitsiRoom = `drift-game-${roomId.slice(0, 8)}`;
    const params = [
      'config.prejoinPageEnabled=false',
      'config.disableDeepLinking=true',
      'config.startWithVideoMuted=true',
      'config.disableVideo=true',
      'config.startWithAudioMuted=false',
      'interfaceConfig.SHOW_JITSI_WATERMARK=false',
      'interfaceConfig.TOOLBAR_BUTTONS=["microphone","hangup"]',
    ].join('&');
    const url = `https://meet.jit.si/${encodeURIComponent(jitsiRoom)}#${params}`;
    setVoiceRoomUrl(url);
    setVoiceState('joined');
    setShowVoiceModal(true);
  }

  function leaveVoice() {
    setShowVoiceModal(false);
    setVoiceRoomUrl(null);
    setVoiceState('idle');
  }

  // ── Copy room code ───────────────────────────────────────────────────────────
  function copyCode() {
    const code = room?.code ?? room?.id.slice(0, 6).toUpperCase() ?? '';
    ExpoClipboard.setStringAsync(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleSendMoreInvites() {
    if (!firebaseUser || !userProfile || !room || inviteSelected.size === 0) return;
    setSendingInvites(true);
    try {
      const now      = Date.now();
      const expiresAt = now + 5 * 60 * 1000;
      await Promise.all(
        Array.from(inviteSelected).map((toUid) => {
          const invite: GameInvite = {
            id:       `${firebaseUser.uid}_${toUid}_${room.gameId}_${now}`,
            fromUid:  firebaseUser.uid,
            fromName: userProfile.name,
            ...(userProfile.photoURL ? { fromPhoto: userProfile.photoURL } : {}),
            toUid,
            gameId:    room.gameId,
            roomId:    room.id,
            status:    'pending',
            createdAt: now,
            expiresAt,
          };
          return sendGameInvite(invite);
        }),
      );
      Alert.alert('Invites Sent!', `${inviteSelected.size} friend${inviteSelected.size > 1 ? 's' : ''} invited.`);
      setInviteSelected(new Set());
      setShowInviteModal(false);
    } catch {
      Alert.alert('Error', 'Could not send invites. Please try again.');
    } finally {
      setSendingInvites(false);
    }
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

          {/* Room Code Card */}
          <View style={styles.codeCard}>
            <LinearGradient colors={[gameColor + '20', gameColor + '08']} style={styles.codeCardInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.codeCardLeft}>
                <Text style={styles.codeCardLabel}>ROOM CODE</Text>
                <Text style={[styles.codeCardCode, { color: gameColor }]}>
                  {room.code ?? roomId.slice(0, 6).toUpperCase()}
                </Text>
                <Text style={styles.codeCardHint}>Share this code to invite friends</Text>
              </View>
              <TouchableOpacity onPress={copyCode} style={[styles.copyBtn, { borderColor: gameColor + '40' }]} activeOpacity={0.7}>
                <Ionicons name={codeCopied ? 'checkmark' : 'copy-outline'} size={16} color={codeCopied ? '#00E676' : gameColor} />
                <Text style={[styles.copyBtnText, { color: codeCopied ? '#00E676' : gameColor }]}>
                  {codeCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

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

          {/* Invite More (host only, when room isn't full) */}
          {isHost && Object.keys(room.players).length < room.maxPlayers && (
            <TouchableOpacity
              style={[styles.inviteMoreBtn, { borderColor: gameColor + '50', backgroundColor: gameColor + '10' }]}
              onPress={() => setShowInviteModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={18} color={gameColor} />
              <Text style={[styles.inviteMoreText, { color: gameColor }]}>Invite More Friends</Text>
            </TouchableOpacity>
          )}

          {/* Voice Chat */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>VOICE CHAT</Text>
          <View style={styles.voiceCard}>
            {(voiceState === 'idle' || voiceState === 'error') && (
              <>
                <TouchableOpacity onPress={joinVoice} activeOpacity={0.85}>
                  <LinearGradient colors={['#6C5CE7', '#A855F7']} style={styles.voiceJoinBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="mic-outline" size={18} color="#fff" />
                    <Text style={styles.voiceJoinText}>Join Voice Chat</Text>
                  </LinearGradient>
                </TouchableOpacity>
                {voiceState === 'error' && (
                  <Text style={styles.voiceErrorHint}>⚠️ Could not join voice. Tap to retry.</Text>
                )}
              </>
            )}
            {/* joining state removed — Jitsi connect is instant */}
            {voiceState === 'joined' && (
              <View style={styles.voiceRow}>
                <TouchableOpacity
                  style={styles.voiceBtn}
                  onPress={() => setShowVoiceModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic-outline" size={16} color="#fff" />
                  <Text style={styles.voiceBtnText}>Open Voice</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.voiceLeaveBtn} onPress={leaveVoice}>
                  <Ionicons name="call-outline" size={16} color={C.error} />
                  <Text style={styles.voiceLeaveText}>Leave</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Voice WebView Modal */}
          <Modal visible={showVoiceModal} transparent animationType="slide" onRequestClose={() => setShowVoiceModal(false)}>
            <View style={styles.voiceModalWrap}>
              <View style={styles.voiceModalHeader}>
                <Ionicons name="mic" size={16} color="#A855F7" />
                <Text style={styles.voiceModalTitle}>Voice Chat · {GAME_NAME[gameId] ?? 'Game'}</Text>
                <TouchableOpacity onPress={() => setShowVoiceModal(false)} style={{ padding: 4 }}>
                  <Ionicons name="chevron-down" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              {voiceRoomUrl && NativeWebView ? (
                <NativeWebView
                  source={{ uri: voiceRoomUrl }}
                  style={{ flex: 1 }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={['*']}
                />
              ) : voiceRoomUrl && !NativeWebView ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <Text style={{ color: '#A855F7', textAlign: 'center', lineHeight: 22 }}>
                    Voice chat requires a development build.{'\n'}Run: npx expo run:ios
                  </Text>
                </View>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#A855F7" size="large" />
                </View>
              )}
              <TouchableOpacity style={styles.voiceLeaveFullBtn} onPress={leaveVoice}>
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.voiceLeaveFullGrad}>
                  <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.voiceLeaveFullText}>Leave Voice</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Invite More Modal */}
          <Modal
            visible={showInviteModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowInviteModal(false)}
          >
            <View style={styles.inviteModalOverlay}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowInviteModal(false)} />
              <View style={[styles.inviteModalSheet, { backgroundColor: isDark ? '#1A1A2E' : C.background }]}>
                <View style={styles.inviteModalHandle} />
                <Text style={styles.inviteModalTitle}>
                  {GAME_NAME[gameId] ?? 'Game'} · Invite Friends
                </Text>
                <Text style={styles.inviteModalSub}>
                  {room.maxPlayers - Object.keys(room.players).length} spot{room.maxPlayers - Object.keys(room.players).length !== 1 ? 's' : ''} remaining
                </Text>

                {inviteRows.length === 0 ? (
                  <View style={styles.inviteModalEmpty}>
                    <Text style={{ fontSize: 36 }}>🤝</Text>
                    <Text style={styles.inviteModalEmptyText}>No available connections</Text>
                    <Text style={styles.inviteModalEmptySub}>All your connections are already in the room or you have none yet.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={inviteRows}
                    keyExtractor={(r) => r.otherUid}
                    style={{ width: '100%', maxHeight: 260 }}
                    contentContainerStyle={{ gap: spacing.sm }}
                    renderItem={({ item }) => {
                      const p = item.profile!;
                      const checked = inviteSelected.has(item.otherUid);
                      const spotsFull = inviteSelected.size + Object.keys(room.players).length >= room.maxPlayers;
                      return (
                        <TouchableOpacity
                          style={[styles.inviteRow, checked && { borderColor: gameColor, backgroundColor: gameColor + '10' }]}
                          onPress={() => {
                            if (!checked && spotsFull) {
                              Alert.alert('Room Full', `Max ${room.maxPlayers} players.`); return;
                            }
                            setInviteSelected((prev) => {
                              const next = new Set(prev);
                              checked ? next.delete(item.otherUid) : next.add(item.otherUid);
                              return next;
                            });
                          }}
                          activeOpacity={0.75}
                        >
                          <Avatar name={p.name} photoURL={p.photoURL} size={40} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inviteRowName}>{p.name}</Text>
                            {p.city && <Text style={styles.inviteRowMeta}>{p.city}</Text>}
                          </View>
                          <View style={[styles.inviteCheckbox, checked && { backgroundColor: gameColor, borderColor: gameColor }]}>
                            {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}

                <TouchableOpacity
                  style={[
                    styles.inviteSendBtn,
                    { backgroundColor: gameColor },
                    (sendingInvites || inviteSelected.size === 0) && { opacity: 0.45 },
                  ]}
                  onPress={handleSendMoreInvites}
                  disabled={sendingInvites || inviteSelected.size === 0}
                  activeOpacity={0.85}
                >
                  {sendingInvites
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.inviteSendText}>
                        Send Invite{inviteSelected.size > 1 ? 's' : ''}{inviteSelected.size > 0 ? ` (${inviteSelected.size})` : ''}
                      </Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowInviteModal(false)} style={{ paddingVertical: spacing.md }}>
                  <Text style={[styles.inviteModalSub, { color: C.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

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

    // ── Room Code Card ────────────────────────────────────────────────────────
    codeCard: {
      borderRadius: radius.lg, overflow: 'hidden',
      marginBottom: spacing.lg, borderWidth: 1.5, borderColor: '#ffffff15',
    },
    codeCardInner: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    codeCardLeft:  { flex: 1 },
    codeCardLabel: { ...typography.small, fontWeight: '800', color: C.textSecondary, letterSpacing: 1.5, marginBottom: 4 },
    codeCardCode:  { fontSize: 32, fontWeight: '900', letterSpacing: 6 },
    codeCardHint:  { ...typography.small, color: C.textSecondary, marginTop: 4 },
    copyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
    copyBtnText: { ...typography.caption, fontWeight: '700' },

    // ── Invite More button ─────────────────────────────────────────────────────
    inviteMoreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      paddingVertical: spacing.sm + 2, borderRadius: radius.md,
      borderWidth: 1.5, marginBottom: spacing.lg,
    },
    inviteMoreText: { ...typography.caption, fontWeight: '700' },

    // ── Invite More Modal ──────────────────────────────────────────────────────
    inviteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    inviteModalSheet: {
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl,
      alignItems: 'center',
    },
    inviteModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: spacing.md },
    inviteModalTitle:  { ...typography.heading, color: C.text, fontWeight: '700', marginBottom: 4 },
    inviteModalSub:    { ...typography.caption, color: C.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    inviteModalEmpty:  { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    inviteModalEmptyText: { ...typography.body, fontWeight: '700', color: C.text },
    inviteModalEmptySub:  { ...typography.small, color: C.textSecondary, textAlign: 'center' },
    inviteRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: C.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.border, padding: spacing.sm + 2,
    },
    inviteRowName: { ...typography.body, fontWeight: '600', color: C.text },
    inviteRowMeta: { ...typography.small, color: C.textSecondary, marginTop: 2 },
    inviteCheckbox: {
      width: 26, height: 26, borderRadius: radius.full,
      borderWidth: 2, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    inviteSendBtn:  { width: '100%', paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', marginTop: spacing.lg },
    inviteSendText: { ...typography.body, color: '#fff', fontWeight: '700' },

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
    voiceErrorHint: { ...typography.caption, color: C.error, marginTop: 6 },
    voiceModalWrap: { flex: 1, backgroundColor: '#000' },
    voiceModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, paddingTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: '#222' },
    voiceModalTitle: { ...typography.body, color: '#fff', fontWeight: '700', flex: 1 },
    voiceLeaveFullBtn: { margin: spacing.md },
    voiceLeaveFullGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, borderRadius: radius.lg },
    voiceLeaveFullText: { ...typography.body, color: '#fff', fontWeight: '700' },

    readyBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, borderRadius: radius.lg },
    readyBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },
    startBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, borderRadius: radius.lg },
    startBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },
    waitHint:     { ...typography.caption, color: C.textSecondary, textAlign: 'center', marginTop: spacing.md },
  });
}
