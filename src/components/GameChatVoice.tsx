/**
 * GameChatVoice — floating chat + voice overlay for any game screen.
 *
 * Props:
 *   roomId     — Firestore gameRoom document ID (chat stored in subcollection)
 *   myUid      — current user's uid
 *   myName     — current user's display name
 *   accentColor — primary color for the game (e.g. '#6C5CE7' for Ludo)
 *
 * Features:
 *   - Floating pill button shows unread count badge + voice status indicator
 *   - Slide-up panel (Modal) with:
 *       • Voice strip at top: join/mute/leave using createVoiceClient + fetchVoiceToken
 *       • Real-time chat messages via subscribeToGameChat
 *       • Message input + send button
 *   - Works with or without a roomId (hides gracefully if no room)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, FlatList, KeyboardAvoidingView, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GameChatMessage,
  subscribeToGameChat,
  sendGameChatMessage,
} from '../utils/firestore-helpers';
import {
  createVoiceClient,
  fetchVoiceToken,
  VoiceClient,
} from '../services/voiceService';
import { useTheme, AppColors, spacing, radius, typography } from '../utils/useTheme';
import { formatRelativeTime } from '../utils/helpers';

interface Props {
  roomId?:     string;
  myUid:       string;
  myName:      string;
  accentColor?: string;
}

type VoiceState = 'idle' | 'joining' | 'joined' | 'error';

export default function GameChatVoice({ roomId, myUid, myName, accentColor }: Props) {
  const { C } = useTheme();
  const accent = accentColor ?? C.primary;

  const [open,          setOpen]          = useState(false);
  const [messages,      setMessages]      = useState<GameChatMessage[]>([]);
  const [text,          setText]          = useState('');
  const [sending,       setSending]       = useState(false);
  const [unread,        setUnread]        = useState(0);
  const [voiceState,    setVoiceState]    = useState<VoiceState>('idle');
  const [muted,         setMuted]         = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  const voiceRef  = useRef<VoiceClient | null>(null);
  const listRef   = useRef<FlatList>(null);
  const lastSeenRef = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Subscribe to chat ──
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToGameChat(roomId, (msgs) => {
      setMessages(msgs);
      if (!open) {
        const newMsgs = msgs.filter(
          (m) => m.createdAt > lastSeenRef.current && m.senderUid !== myUid,
        );
        if (newMsgs.length > 0) setUnread((u) => u + newMsgs.length);
      }
    });
    return unsub;
  }, [roomId]);

  // ── Clean up voice on unmount ──
  useEffect(() => {
    return () => { voiceRef.current?.leave().catch(() => {}); };
  }, []);

  // ── Slide animation ──
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      friction: 20,
      tension: 180,
    }).start();
    if (open) {
      setUnread(0);
      lastSeenRef.current = Date.now();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [open]);

  // ── Voice ──
  async function joinVoice() {
    if (!roomId || voiceState !== 'idle') return;
    setVoiceState('joining');
    try {
      const token  = await fetchVoiceToken(roomId);
      const client = createVoiceClient();
      client.on('joined', () => { setVoiceState('joined'); setParticipantCount((n) => n + 1); });
      client.on('left',   () => { setVoiceState('idle');   setParticipantCount((n) => Math.max(0, n - 1)); });
      client.on('participant-joined', () => setParticipantCount((n) => n + 1));
      client.on('participant-left',   () => setParticipantCount((n) => Math.max(0, n - 1)));
      client.on('error',  (e: unknown) => { console.warn('[GameChatVoice voice]', e); setVoiceState('error'); });
      await client.join(token.token, token.roomUrl);
      voiceRef.current = client;
    } catch {
      setVoiceState('error');
    }
  }

  async function toggleMute() {
    if (!voiceRef.current) return;
    try { setMuted(await voiceRef.current.toggleMute()); } catch { /* ignore */ }
  }

  async function leaveVoice() {
    try { await voiceRef.current?.leave(); } catch { /* ignore */ }
    voiceRef.current = null;
    setVoiceState('idle');
    setMuted(false);
    setParticipantCount(0);
  }

  // ── Send chat message ──
  async function handleSend() {
    if (!text.trim() || !roomId || sending) return;
    setSending(true);
    const msg: GameChatMessage = {
      id:         `${myUid}_${Date.now()}`,
      senderUid:  myUid,
      senderName: myName,
      text:       text.trim(),
      createdAt:  Date.now(),
    };
    setText('');
    try {
      await sendGameChatMessage(roomId, msg);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  }

  if (!roomId) return null;

  const sc = makeStyles(C, accent);

  const isVoiceActive = voiceState === 'joined';

  return (
    <>
      {/* ── Floating toggle button ── */}
      <View style={sc.fab} pointerEvents="box-none">
        <TouchableOpacity
          style={[sc.fabBtn, isVoiceActive && sc.fabBtnVoice]}
          onPress={() => setOpen(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isVoiceActive ? ['#6C5CE7', '#A855F7'] : [accent, accent + 'CC']}
            style={sc.fabGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name={isVoiceActive ? (muted ? 'mic-off' : 'mic') : 'chatbubble-ellipses-outline'}
              size={20}
              color="#fff"
            />
            {isVoiceActive && (
              <View style={sc.voiceActiveDot} />
            )}
          </LinearGradient>
          {unread > 0 && (
            <View style={sc.badge}>
              <Text style={sc.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Slide-up panel ── */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          style={sc.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={sc.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />

          <View style={sc.panel}>
            {/* Handle */}
            <View style={sc.handle} />

            {/* Header */}
            <View style={sc.panelHeader}>
              <View style={sc.panelHeaderLeft}>
                <LinearGradient colors={[accent, accent + 'AA']} style={sc.headerDot} />
                <Text style={sc.panelTitle}>Game Chat</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} style={sc.closeBtn}>
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* ── Voice strip ── */}
            <View style={sc.voiceStrip}>
              <View style={sc.voiceStripLeft}>
                <Ionicons
                  name={isVoiceActive ? 'radio-outline' : 'mic-outline'}
                  size={14}
                  color={isVoiceActive ? '#A855F7' : C.textSecondary}
                />
                <Text style={[sc.voiceLabel, isVoiceActive && { color: '#A855F7' }]}>
                  {voiceState === 'idle'    ? 'Voice Chat'
                  : voiceState === 'joining' ? 'Connecting…'
                  : voiceState === 'error'   ? 'Voice unavailable'
                  : muted                    ? 'Muted'
                  : `Live · ${participantCount} in voice`}
                </Text>
              </View>
              <View style={sc.voiceActions}>
                {voiceState === 'idle' && (
                  <TouchableOpacity onPress={joinVoice} style={sc.voiceBtn}>
                    <LinearGradient colors={['#6C5CE7', '#A855F7']} style={sc.voiceBtnGrad}>
                      <Ionicons name="mic-outline" size={13} color="#fff" />
                      <Text style={sc.voiceBtnText}>Join</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                {voiceState === 'joining' && (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                )}
                {voiceState === 'joined' && (
                  <>
                    <TouchableOpacity onPress={toggleMute} style={[sc.voiceIconBtn, muted && sc.voiceIconBtnMuted]}>
                      <Ionicons name={muted ? 'mic-off' : 'mic'} size={15} color={muted ? C.textSecondary : '#fff'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={leaveVoice} style={sc.voiceLeaveBtn}>
                      <Ionicons name="call" size={13} color={C.error} />
                    </TouchableOpacity>
                  </>
                )}
                {voiceState === 'error' && (
                  <TouchableOpacity onPress={() => setVoiceState('idle')}>
                    <Text style={{ fontSize: 11, color: C.error }}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Messages ── */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              style={sc.msgList}
              contentContainerStyle={sc.msgContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={sc.emptyChat}>
                  <Text style={sc.emptyChatEmoji}>💬</Text>
                  <Text style={sc.emptyChatText}>Say hi to your opponents!</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isMe = item.senderUid === myUid;
                return (
                  <View style={[sc.msgRow, isMe && sc.msgRowMe]}>
                    {!isMe && (
                      <View style={[sc.msgAvatar, { backgroundColor: accent + '30' }]}>
                        <Text style={[sc.msgAvatarText, { color: accent }]}>
                          {item.senderName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={sc.msgBubbleWrap}>
                      {!isMe && (
                        <Text style={sc.msgName}>{item.senderName}</Text>
                      )}
                      <View style={[sc.msgBubble, isMe ? sc.msgBubbleMe : sc.msgBubbleThem, isMe && { backgroundColor: accent }]}>
                        <Text style={[sc.msgText, isMe && sc.msgTextMe]}>{item.text}</Text>
                      </View>
                      <Text style={[sc.msgTime, isMe && sc.msgTimeMe]}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* ── Input ── */}
            <View style={sc.inputRow}>
              <TextInput
                style={sc.input}
                value={text}
                onChangeText={setText}
                placeholder="Message teammates…"
                placeholderTextColor={C.textSecondary}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                maxLength={200}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[sc.sendBtn, (!text.trim() || sending) && sc.sendBtnDisabled, { backgroundColor: accent }]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function makeStyles(C: AppColors, accent: string) {
  return StyleSheet.create({
    // Floating button
    fab: {
      position: 'absolute', bottom: 100, right: 16,
      zIndex: 999, pointerEvents: 'box-none',
    },
    fabBtn:      { position: 'relative' },
    fabBtnVoice: {},
    fabGrad: {
      width: 52, height: 52, borderRadius: 26,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
    },
    voiceActiveDot: {
      position: 'absolute', top: 6, right: 6,
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: '#00E676',
      borderWidth: 1.5, borderColor: '#fff',
    },
    badge: {
      position: 'absolute', top: -4, right: -4,
      backgroundColor: '#EF4444', borderRadius: 10,
      minWidth: 18, height: 18, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: C.background,
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

    // Modal
    modalWrap: { flex: 1, justifyContent: 'flex-end' },
    backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

    panel: {
      backgroundColor: C.background,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingBottom: 24, maxHeight: '75%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 20,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: C.border, alignSelf: 'center',
      marginTop: spacing.sm, marginBottom: 4,
    },

    panelHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerDot: { width: 10, height: 10, borderRadius: 5 },
    panelTitle: { ...typography.body, fontWeight: '700', color: C.text },
    closeBtn:   { padding: spacing.xs },

    // Voice strip
    voiceStrip: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    voiceStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    voiceLabel:     { ...typography.small, color: C.textSecondary, fontWeight: '600' },
    voiceActions:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    voiceBtn:       {},
    voiceBtnGrad:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
    voiceBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
    voiceIconBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#6C5CE7', alignItems: 'center', justifyContent: 'center' },
    voiceIconBtnMuted: { backgroundColor: C.textSecondary + '60' },
    voiceLeaveBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: C.error + '20', borderWidth: 1, borderColor: C.error + '40', alignItems: 'center', justifyContent: 'center' },

    // Chat messages
    msgList:    { maxHeight: 280 },
    msgContent: { padding: spacing.md, gap: spacing.sm },
    emptyChat:      { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyChatEmoji: { fontSize: 36 },
    emptyChatText:  { ...typography.caption, color: C.textSecondary },

    msgRow:   { flexDirection: 'row', gap: spacing.sm, maxWidth: '80%' },
    msgRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    msgAvatar:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
    msgAvatarText:{ fontSize: 13, fontWeight: '700' },
    msgBubbleWrap:{ gap: 2 },
    msgName:      { ...typography.small, color: C.textSecondary, fontWeight: '600', marginLeft: 4 },
    msgBubble:    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    msgBubbleMe:  { borderBottomRightRadius: 4 },
    msgBubbleThem:{ backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
    msgText:      { ...typography.body, color: C.text, fontSize: 14, lineHeight: 20 },
    msgTextMe:    { color: '#fff' },
    msgTime:      { ...typography.small, color: C.textSecondary, fontSize: 10, marginLeft: 4 },
    msgTimeMe:    { textAlign: 'right', marginRight: 4 },

    // Input
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingTop: spacing.sm,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    input: {
      flex: 1, ...typography.body, color: C.text,
      backgroundColor: C.inputBg, borderRadius: radius.lg,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderWidth: 1, borderColor: C.border, maxHeight: 90, minHeight: 42,
    },
    sendBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { opacity: 0.4 },
  });
}
