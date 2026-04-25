import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  subscribeToConnections,
  getUserProfile,
  createGameRoom,
  sendGameInvite,
} from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import {
  Connection,
  GamesStackParamList,
  GameId,
  GameRoom,
  GameRoomPlayer,
  GameInvite,
  UserProfile,
} from '../../types';

type Nav = NativeStackNavigationProp<GamesStackParamList, 'GameInvite'>;
type Rt = RouteProp<GamesStackParamList, 'GameInvite'>;

const GAME_INFO: Record<GameId, { name: string; emoji: string; maxPlayers: number }> = {
  ludo:          { name: 'Ludo',          emoji: '🎲', maxPlayers: 4 },
  'truth-dare':  { name: 'Truth or Dare', emoji: '🎯', maxPlayers: 8 },
};

function makeRoomId(): string {
  // crypto.randomUUID is available on RN Hermes 0.74+ ; fall back to simple uuid.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function GameInviteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { gameId } = route.params;
  const info = GAME_INFO[gameId];

  const { firebaseUser, userProfile } = useAuthStore();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Subscribe to user's connections
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeToConnections(firebaseUser.uid, setConnections);
    return () => unsub();
  }, [firebaseUser]);

  // Fetch other-user profiles
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    async function load() {
      const otherUids = connections
        .map((c) => c.users.find((u) => u !== uid))
        .filter((u): u is string => !!u && !profiles[u]);
      if (otherUids.length === 0) return;
      const fetched: Record<string, UserProfile> = {};
      await Promise.all(
        otherUids.map(async (otherUid) => {
          const p = await getUserProfile(otherUid);
          if (p) fetched[otherUid] = p;
        }),
      );
      setProfiles((prev) => ({ ...prev, ...fetched }));
    }
    load();
  }, [connections, firebaseUser, profiles]);

  const otherUserRows = useMemo(() => {
    if (!firebaseUser) return [];
    return connections
      .map((c) => {
        const otherUid = c.users.find((u) => u !== firebaseUser.uid) ?? '';
        return { connectionId: c.id, otherUid, profile: profiles[otherUid] };
      })
      .filter((row) => !!row.profile);
  }, [connections, profiles, firebaseUser]);

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else if (next.size + 1 >= info.maxPlayers) {
        Alert.alert(
          'Max players reached',
          `${info.name} rooms hold up to ${info.maxPlayers} players (including you).`,
        );
        return prev;
      } else {
        next.add(uid);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!firebaseUser || !userProfile) {
      Alert.alert('Error', 'You must be signed in.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Select friends', 'Pick at least one connection to invite.');
      return;
    }

    setCreating(true);
    try {
      const roomId = makeRoomId();
      const now = Date.now();

      const host: GameRoomPlayer = {
        uid:      firebaseUser.uid,
        name:     userProfile.name,
        // only include photoURL if it exists — undefined crashes Firestore
        ...(userProfile.photoURL ? { photoURL: userProfile.photoURL } : {}),
        ready:    false,
        isHost:   true,
        joinedAt: now,
      };

      const room: GameRoom = {
        id:         roomId,
        gameId,
        hostUid:    firebaseUser.uid,
        status:     'waiting',
        maxPlayers: info.maxPlayers,
        players:    { [firebaseUser.uid]: host },
        createdAt:  now,
        state:      {},
      };

      await createGameRoom(room);

      // Fan-out invites
      const expiresAt = now + 5 * 60 * 1000;
      await Promise.all(
        Array.from(selected).map((toUid) => {
          const invite: GameInvite = {
            id:       `${firebaseUser.uid}_${toUid}_${gameId}_${now}`,
            fromUid:  firebaseUser.uid,
            fromName: userProfile.name,
            // only include fromPhoto if it exists
            ...(userProfile.photoURL ? { fromPhoto: userProfile.photoURL } : {}),
            toUid,
            gameId,
            roomId,
            status:    'pending',
            createdAt: now,
            expiresAt,
          };
          return sendGameInvite(invite);
        }),
      );

      navigation.replace('GameLobby', { roomId, gameId });
    } catch (err) {
      console.error(err);
      Alert.alert('Could not create room', 'Please try again in a moment.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>
            {info.emoji} Invite to {info.name}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.subText}>
          Pick friends to invite. You can invite up to {info.maxPlayers - 1} players.
        </Text>
        <Text style={styles.selectedText}>
          {selected.size} selected
        </Text>
      </View>

      <FlatList
        data={otherUserRows}
        keyExtractor={(row) => row.otherUid}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            emoji="🤝"
            title="No connections yet"
            subtitle="Connect with people on Discover first, then you can invite them to play."
          />
        }
        renderItem={({ item }) => {
          const p = item.profile!;
          const checked = selected.has(item.otherUid);
          return (
            <TouchableOpacity
              style={[styles.row, checked && styles.rowChecked]}
              onPress={() => toggle(item.otherUid)}
              activeOpacity={0.75}
            >
              <Avatar name={p.name} photoURL={p.photoURL} size={48} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{p.name}</Text>
                {p.city && <Text style={styles.rowMeta}>{p.city}</Text>}
              </View>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createBtn, (creating || selected.size === 0) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={creating || selected.size === 0}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>
              Create Room & Invite {selected.size > 0 ? `(${selected.size})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backIcon: { fontSize: 22, color: colors.text, width: 32 },
  headerTitle: { ...typography.heading, color: colors.text },

  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  subText:      { ...typography.caption, color: colors.textSecondary, flex: 1 },
  selectedText: { ...typography.caption, color: colors.primary, fontWeight: '700' },

  list: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  rowChecked: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  rowInfo: { flex: 1 },
  rowName: { ...typography.body, fontWeight: '600', color: colors.text },
  rowMeta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  checkbox: {
    width: 26, height: 26, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },

  footer: {
    padding: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  createBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { ...typography.body, fontWeight: '700', color: '#fff' },
});
