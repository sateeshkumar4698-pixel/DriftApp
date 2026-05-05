import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  respondToConnectionRequest,
  respondToGameInvite,
  respondToEventInvite,
  getUserProfile,
  joinGameRoom,
} from '../../utils/firestore-helpers';
import { formatRelativeTime } from '../../utils/helpers';
import { spacing, typography, radius } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { AppNotification, DiscoverStackParamList, GameRoomPlayer } from '../../types';

type Nav = NativeStackNavigationProp<DiscoverStackParamList>;

// ─── Notif type config ────────────────────────────────────────────────────────

const NOTIF_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  connection_request: { emoji: '👋', color: '#6C5CE7', bg: '#6C5CE708' },
  connection_accepted:{ emoji: '🎉', color: '#00B894', bg: '#00B89408' },
  game_invite:        { emoji: '🎮', color: '#E17055', bg: '#E1705508' },
  event_invite:       { emoji: '📅', color: '#0984E3', bg: '#0984E308' },
  new_message:        { emoji: '💬', color: '#FF4B6E', bg: '#FF4B6E08' },
  event_rsvp:         { emoji: '✅', color: '#00B894', bg: '#00B89408' },
  system:             { emoji: '📢', color: '#636E72', bg: '#63657208' },
};

// ─── Single Notification Row ──────────────────────────────────────────────────

function NotifRow({
  item,
  onPress,
  onAccept,
  onDecline,
}: {
  item: AppNotification;
  onPress: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cfg = NOTIF_CONFIG[item.type] ?? NOTIF_CONFIG.system;
  const isActionable =
    (item.type === 'connection_request' ||
     item.type === 'game_invite' ||
     item.type === 'event_invite') &&
    !item.read;

  return (
    <TouchableOpacity
      style={[styles.row, !item.read && styles.rowUnread, { backgroundColor: item.read ? C.background : cfg.bg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Unread dot */}
      {!item.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: `${cfg.color}18` }]}>
        <Text style={styles.iconEmoji}>{cfg.emoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>

        {/* Accept / Decline for actionable notifications */}
        {isActionable && onAccept && onDecline && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const uid = firebaseUser?.uid ?? '';

  const { C, isDark } = useTheme();
  const styles = makeStyles(C);

  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToNotifications(uid, (list) => {
      setNotifs(list);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  // ── Mark all read on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (uid && !loading) {
      markAllNotificationsRead(uid).catch(() => {});
    }
  }, [uid, loading]);

  // ── Navigate to relevant screen based on type ──────────────────────────────

  async function handlePress(item: AppNotification) {
    if (!item.read) markNotificationRead(item.id).catch(() => {});

    switch (item.type) {
      case 'connection_request':
      case 'connection_accepted': {
        const otherUid = (item.data.fromUid ?? item.data.connectedUid) as string | undefined;
        if (otherUid) {
          const profile = await getUserProfile(otherUid);
          if (profile) {
            navigation.navigate('Connections');
          }
        } else {
          navigation.navigate('Connections');
        }
        break;
      }
      case 'game_invite':
        // The GameInviteBanner handles accepting — just go to games
        (navigation as any).navigate('Play');
        break;
      case 'event_invite':
      case 'event_rsvp':
        // Navigate to events tab
        (navigation as any).navigate('Events');
        break;
      case 'new_message': {
        const connectionId = item.data.connectionId as string | undefined;
        const senderId     = item.data.senderId as string | undefined;
        if (connectionId && senderId) {
          const sender = await getUserProfile(senderId);
          if (sender) {
            navigation.navigate('Chat', { connectionId, connectedUser: sender });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // ── Accept handlers ────────────────────────────────────────────────────────

  async function handleAcceptConnection(item: AppNotification) {
    const requestId = item.data.requestId as string | undefined;
    if (!requestId) return;
    try {
      await respondToConnectionRequest(requestId, 'accepted');
      markNotificationRead(item.id).catch(() => {});
      Alert.alert('Connected! 🎉', 'You are now connected.');
    } catch {
      Alert.alert('Error', 'Could not accept request.');
    }
  }

  async function handleDeclineConnection(item: AppNotification) {
    const requestId = item.data.requestId as string | undefined;
    if (!requestId) return;
    try {
      await respondToConnectionRequest(requestId, 'declined');
      markNotificationRead(item.id).catch(() => {});
    } catch { /* silent */ }
  }

  async function handleAcceptGame(item: AppNotification) {
    if (!firebaseUser || !userProfile) return;
    const inviteId = item.data.inviteId as string | undefined;
    const roomId   = item.data.roomId   as string | undefined;
    const gameId   = item.data.gameId   as 'ludo' | 'truth-dare' | undefined;
    if (!inviteId || !roomId || !gameId) return;
    try {
      await respondToGameInvite(inviteId, 'accepted');
      const player: GameRoomPlayer = {
        uid:      uid,
        name:     userProfile.name,
        ...(userProfile.photoURL ? { photoURL: userProfile.photoURL } : {}),
        ready:    false,
        isHost:   false,
        joinedAt: Date.now(),
      };
      await joinGameRoom(roomId, player);
      markNotificationRead(item.id).catch(() => {});
      (navigation as any).navigate('Play', {
        screen: 'GameLobby',
        params: { roomId, gameId },
      });
    } catch {
      Alert.alert('Error', 'Room may no longer be available.');
    }
  }

  async function handleDeclineGame(item: AppNotification) {
    const inviteId = item.data.inviteId as string | undefined;
    if (!inviteId) return;
    await respondToGameInvite(inviteId, 'declined').catch(() => {});
    markNotificationRead(item.id).catch(() => {});
  }

  async function handleAcceptEvent(item: AppNotification) {
    const inviteId = item.data.inviteId as string | undefined;
    if (!inviteId) return;
    await respondToEventInvite(inviteId, 'accepted').catch(() => {});
    markNotificationRead(item.id).catch(() => {});
    (navigation as any).navigate('Events');
  }

  async function handleDeclineEvent(item: AppNotification) {
    const inviteId = item.data.inviteId as string | undefined;
    if (!inviteId) return;
    await respondToEventInvite(inviteId, 'declined').catch(() => {});
    markNotificationRead(item.id).catch(() => {});
  }

  function resolveHandlers(item: AppNotification): {
    onAccept?: () => void;
    onDecline?: () => void;
  } {
    if (item.read) return {};
    if (item.type === 'connection_request')
      return {
        onAccept:  () => handleAcceptConnection(item),
        onDecline: () => handleDeclineConnection(item),
      };
    if (item.type === 'game_invite')
      return {
        onAccept:  () => handleAcceptGame(item),
        onDecline: () => handleDeclineGame(item),
      };
    if (item.type === 'event_invite')
      return {
        onAccept:  () => handleAcceptEvent(item),
        onDecline: () => handleDeclineEvent(item),
      };
    return {};
  }

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity
            onPress={() => markAllNotificationsRead(uid).catch(() => {})}
          >
            <Text style={styles.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySub}>
            Connection requests, game invites, and event updates will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <NotifRow
              item={item}
              onPress={() => handlePress(item)}
              {...resolveHandlers(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border, gap: spacing.sm,
    },
    backBtn: { padding: spacing.xs },
    backIcon: { fontSize: 22, color: C.text },
    headerTitle: { flex: 1, ...typography.heading, color: C.text },
    markAllBtn: { ...typography.small, color: C.primary, fontWeight: '600' },

    center: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: spacing.xl, gap: spacing.sm,
    },
    emptyEmoji: { fontSize: 56, marginBottom: spacing.sm },
    emptyTitle: { ...typography.title, color: C.text, textAlign: 'center' },
    emptySub: {
      ...typography.body, color: C.textSecondary,
      textAlign: 'center', lineHeight: 24,
    },

    separator: { height: 1, backgroundColor: C.border, marginLeft: 72 },

    row: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      gap: spacing.md,
    },
    rowUnread: { borderLeftWidth: 3, borderLeftColor: C.primary },
    unreadDot: {
      position: 'absolute', top: spacing.md + 4, right: spacing.md,
      width: 8, height: 8, borderRadius: 4,
    },
    iconWrap: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    iconEmoji: { fontSize: 22 },

    content: { flex: 1, gap: 2 },
    title: { ...typography.body, color: C.textSecondary, fontWeight: '500' },
    titleUnread: { color: C.text, fontWeight: '700' },
    body: { ...typography.caption, color: C.textSecondary, lineHeight: 18 },
    time: { ...typography.small, color: C.textSecondary, marginTop: 4 },

    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    acceptBtn: {
      paddingHorizontal: spacing.md, paddingVertical: 6,
      backgroundColor: C.primary, borderRadius: radius.full,
    },
    acceptText: { ...typography.small, color: '#fff', fontWeight: '700' },
    declineBtn: {
      paddingHorizontal: spacing.md, paddingVertical: 6,
      borderWidth: 1, borderColor: C.border, borderRadius: radius.full,
    },
    declineText: { ...typography.small, color: C.textSecondary, fontWeight: '600' },
  });
}
