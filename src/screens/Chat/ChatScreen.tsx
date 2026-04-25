import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ref as rtdbRef, onValue, set, remove } from 'firebase/database';
import { rtdb } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { useMatchStore } from '../../store/matchStore';
import {
  subscribeToMessages,
  sendMessage,
  createGameRoom,
  sendGameInvite,
} from '../../utils/firestore-helpers';
import { formatTime } from '../../utils/helpers';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius } from '../../utils/theme';
import {
  Message,
  DiscoverStackParamList,
  GameRoom,
  GameRoomPlayer,
  GameInvite,
} from '../../types';
function makeRoomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type RouteProps = RouteProp<DiscoverStackParamList, 'Chat'>;

// ─── Game picker config ───────────────────────────────────────────────────────

const INVITE_GAMES = [
  { id: 'ludo'       as const, emoji: '🎲', name: 'Ludo',          maxPlayers: 4 },
  { id: 'truth-dare' as const, emoji: '🎯', name: 'Truth or Dare', maxPlayers: 4 },
];

// ─── Game Invite Modal ────────────────────────────────────────────────────────

function GameInviteModal({
  visible,
  onClose,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onInvite: (gameId: 'ludo' | 'truth-dare', maxPlayers: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(gameId: 'ludo' | 'truth-dare', maxPlayers: number) {
    setLoading(gameId);
    try {
      await onInvite(gameId, maxPlayers);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not send game invite. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={gStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={gStyles.sheet}>
        <View style={gStyles.handle} />
        <Text style={gStyles.title}>🎮 Invite to Game</Text>
        <Text style={gStyles.subtitle}>Choose a game to play together</Text>
        <View style={gStyles.gameList}>
          {INVITE_GAMES.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={gStyles.gameRow}
              onPress={() => handle(g.id, g.maxPlayers)}
              activeOpacity={0.8}
              disabled={loading !== null}
            >
              <Text style={gStyles.gameEmoji}>{g.emoji}</Text>
              <View style={gStyles.gameInfo}>
                <Text style={gStyles.gameName}>{g.name}</Text>
                <Text style={gStyles.gameSub}>Tap to send invite</Text>
              </View>
              {loading === g.id
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={gStyles.gameArrow}>→</Text>
              }
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={gStyles.cancelBtn} onPress={onClose}>
          <Text style={gStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const gStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.caption, color: colors.textSecondary,
    textAlign: 'center', marginTop: 4, marginBottom: spacing.lg,
  },
  gameList: { gap: spacing.sm },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  gameEmoji: { fontSize: 32 },
  gameInfo: { flex: 1 },
  gameName: { ...typography.body, fontWeight: '700', color: colors.text },
  gameSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  gameArrow: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  cancelBtn: {
    marginTop: spacing.md, padding: spacing.md,
    alignItems: 'center',
  },
  cancelText: { ...typography.body, color: colors.textSecondary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { connectionId, connectedUser } = route.params;

  const { firebaseUser, userProfile } = useAuthStore();
  const { activeMessages, setMessages } = useMatchStore();

  const [text, setText]               = useState('');
  const [sending, setSending]         = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(false);

  const flatListRef  = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages  = activeMessages[connectionId] ?? [];
  const myUid     = firebaseUser?.uid ?? '';
  const otherUid  = connectedUser.uid;
  const typingPath = `typing/${connectionId}`;

  useEffect(() => {
    const unsub = subscribeToMessages(connectionId, (msgs) =>
      setMessages(connectionId, msgs),
    );
    return unsub;
  }, [connectionId]);

  // Watch other user's typing state
  useEffect(() => {
    const ref = rtdbRef(rtdb, `${typingPath}/${otherUid}`);
    const unsub = onValue(ref, (snap) => setOtherTyping(snap.val() === true));
    return () => unsub();
  }, [connectionId, otherUid]);

  // Cleanup own typing flag on unmount
  useEffect(() => {
    return () => {
      if (myUid) remove(rtdbRef(rtdb, `${typingPath}/${myUid}`));
    };
  }, [connectionId, myUid]);

  function handleTextChange(val: string) {
    setText(val);
    if (!myUid) return;
    set(rtdbRef(rtdb, `${typingPath}/${myUid}`), true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      remove(rtdbRef(rtdb, `${typingPath}/${myUid}`));
    }, 2000);
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim() || !firebaseUser || sending) return;
    const msgText = text.trim();
    setText('');
    setSending(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    remove(rtdbRef(rtdb, `${typingPath}/${myUid}`));
    const message: Message = {
      id:        `${Date.now()}_${firebaseUser.uid}`,
      senderId:  firebaseUser.uid,
      text:      msgText,
      createdAt: Date.now(),
    };
    try {
      await sendMessage(connectionId, message);
    } finally {
      setSending(false);
    }
  }

  // ── Create game room + send invite to connected user ──────────────────────

  async function handleGameInvite(
    gameId: 'ludo' | 'truth-dare',
    maxPlayers: number,
  ) {
    if (!firebaseUser || !userProfile) throw new Error('Not signed in');

    const roomId = makeRoomId();
    const now    = Date.now();

    const host: GameRoomPlayer = {
      uid:      myUid,
      name:     userProfile.name,
      // strip undefined — only include photoURL if it exists
      ...(userProfile.photoURL ? { photoURL: userProfile.photoURL } : {}),
      ready:    false,
      isHost:   true,
      joinedAt: now,
    };

    const room: GameRoom = {
      id:         roomId,
      gameId,
      hostUid:    myUid,
      status:     'waiting',
      maxPlayers,
      players:    { [myUid]: host },
      createdAt:  now,
      state:      {},
    };

    await createGameRoom(room);

    const invite: GameInvite = {
      id:        `${myUid}_${otherUid}_${gameId}_${now}`,
      fromUid:   myUid,
      fromName:  userProfile.name,
      // only include fromPhoto if it exists
      ...(userProfile.photoURL ? { fromPhoto: userProfile.photoURL } : {}),
      toUid:     otherUid,
      gameId,
      roomId,
      status:    'pending',
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
    };

    await sendGameInvite(invite);

    // Send a chat message to let them know
    const notif: Message = {
      id:        `${now}_invite_${myUid}`,
      senderId:  myUid,
      text:      `🎮 I invited you to play ${gameId === 'ludo' ? 'Ludo 🎲' : 'Truth or Dare 🎯'}! Check the notification banner.`,
      createdAt: now,
    };
    await sendMessage(connectionId, notif);
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerUser}
          onPress={() =>
            (navigation as any).navigate('ProfileDetail', { user: connectedUser })
          }
        >
          <Avatar name={connectedUser.name} photoURL={connectedUser.photoURL} size={36} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{connectedUser.name}</Text>
            <Text style={styles.headerSub}>
              {connectedUser.age}{connectedUser.city ? ` · ${connectedUser.city}` : ''}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action buttons */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowGamePicker(true)}
        >
          <Text style={styles.actionBtnText}>🎮</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() =>
            (navigation as any).navigate('MeetupSuggest', { connectionId, connectedUser })
          }
        >
          <Text style={styles.actionBtnText}>📅</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatEmoji}>👋</Text>
              <Text style={styles.emptyChatText}>
                You're connected with {connectedUser.name}!
              </Text>
              <Text style={styles.emptyChatSub}>
                Start chatting · invite them to a game 🎮 · or propose a meetup 📅
              </Text>

              {/* Quick game invite chips */}
              <View style={styles.quickInviteRow}>
                {INVITE_GAMES.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.quickChip}
                    onPress={() => handleGameInvite(g.id, g.maxPlayers).catch(() =>
                      Alert.alert('Error', 'Could not send game invite.')
                    )}
                  >
                    <Text style={styles.quickChipText}>{g.emoji} {g.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.senderId === firebaseUser?.uid;
            const isInviteMsg = item.text.startsWith('🎮 I invited');
            return (
              <View
                style={[
                  styles.bubbleWrapper,
                  isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs,
                ]}
              >
                {!isMine && (
                  <Avatar name={connectedUser.name} photoURL={connectedUser.photoURL} size={28} />
                )}
                <View
                  style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleTheirs,
                    isInviteMsg && styles.bubbleInvite,
                  ]}
                >
                  <Text style={[styles.bubbleText, isMine ? styles.textMine : styles.textTheirs]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.bubbleTime, isMine ? styles.timeMine : styles.timeTheirs]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Typing indicator */}
        {otherTyping && (
          <View style={styles.typingRow}>
            <Avatar name={connectedUser.name} photoURL={connectedUser.photoURL} size={20} />
            <View style={styles.typingBubble}>
              <Text style={styles.typingDots}>• • •</Text>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.gameBtn}
            onPress={() => setShowGamePicker(true)}
          >
            <Text style={styles.gameBtnText}>🎮</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Say something..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnOff]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.background} />
              : <Text style={styles.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Game invite picker */}
      <GameInviteModal
        visible={showGamePicker}
        onClose={() => setShowGamePicker(false)}
        onInvite={handleGameInvite}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: 22, color: colors.text },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerInfo: { flex: 1 },
  headerName: { ...typography.body, fontWeight: '600', color: colors.text },
  headerSub: { ...typography.small, color: colors.textSecondary },

  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { fontSize: 18 },

  messagesList: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },

  emptyChat: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: spacing.xxl, gap: spacing.sm,
  },
  emptyChatEmoji: { fontSize: 48 },
  emptyChatText: {
    ...typography.body, fontWeight: '600', color: colors.text, textAlign: 'center',
  },
  emptyChatSub: {
    ...typography.caption, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.lg,
  },
  quickInviteRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickChip: {
    backgroundColor: `${colors.secondary}12`,
    borderWidth: 1, borderColor: `${colors.secondary}30`,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  quickChipText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },

  bubbleWrapper: {
    flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.xs,
  },
  bubbleWrapperMine:   { justifyContent: 'flex-end' },
  bubbleWrapperTheirs: { justifyContent: 'flex-start', gap: spacing.xs },

  bubble: {
    maxWidth: '72%', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  bubbleMine:   { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface,  borderBottomLeftRadius: 4 },
  bubbleInvite: {
    borderWidth: 1, borderColor: `${colors.secondary}40`,
    backgroundColor: `${colors.secondary}10`,
  },
  bubbleText: { ...typography.body, lineHeight: 22 },
  textMine:   { color: colors.background },
  textTheirs: { color: colors.text },
  bubbleTime: { ...typography.small, marginTop: 3, alignSelf: 'flex-end' },
  timeMine:   { color: `${colors.background}90` },
  timeTheirs: { color: colors.textSecondary },

  typingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  typingBubble: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderBottomLeftRadius: 4,
  },
  typingDots: { ...typography.caption, color: colors.textSecondary, letterSpacing: 3 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  gameBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  gameBtnText: { fontSize: 22 },
  textInput: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...typography.body, color: colors.text, maxHeight: 120,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
  sendIcon: { fontSize: 20, color: colors.background, fontWeight: '700' },
});
