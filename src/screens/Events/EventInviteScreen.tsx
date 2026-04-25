import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import {
  subscribeToConnections,
  getUserProfile,
  sendEventInvite,
} from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Connection, EventsStackParamList, EventInvite, UserProfile } from '../../types';

type RouteProps = RouteProp<EventsStackParamList, 'EventInvite'>;

export default function EventInviteScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { event } = route.params;
  const { firebaseUser, userProfile } = useAuthStore();
  const uid = firebaseUser?.uid ?? '';

  const [connections, setConnections] = useState<UserProfile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState<Set<string>>(new Set());
  const [sent, setSent]               = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToConnections(uid, async (conns: Connection[]) => {
      const profiles = await Promise.all(
        conns.map((c) => {
          const otherUid = c.users.find((u) => u !== uid) ?? '';
          return getUserProfile(otherUid);
        }),
      );
      setConnections(profiles.filter((p): p is UserProfile => p !== null));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  async function handleInvite(friend: UserProfile) {
    if (!userProfile) return;
    setSending((prev) => new Set(prev).add(friend.uid));
    try {
      const now = Date.now();
      const invite: EventInvite = {
        id:         `${uid}_${friend.uid}_${event.id}_${now}`,
        fromUid:    uid,
        fromName:   userProfile.name,
        toUid:      friend.uid,
        eventId:    event.id,
        eventTitle: event.title,
        status:     'pending',
        createdAt:  now,
        expiresAt:  now + 7 * 24 * 60 * 60 * 1000, // 7 days
      };
      await sendEventInvite(invite);
      setSent((prev) => new Set(prev).add(friend.uid));
    } catch {
      Alert.alert('Error', 'Could not send invite. Try again.');
    } finally {
      setSending((prev) => { const s = new Set(prev); s.delete(friend.uid); return s; });
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Invite Friends</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : connections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyText}>No connections yet</Text>
          <Text style={styles.emptySub}>Connect with people on Discover first!</Text>
        </View>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Select connections to invite to this event:
            </Text>
          }
          renderItem={({ item }) => {
            const isSending = sending.has(item.uid);
            const isSent    = sent.has(item.uid);
            return (
              <View style={styles.row}>
                <Avatar name={item.name} photoURL={item.photoURL} size={44} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{item.name}, {item.age}</Text>
                  {item.city && <Text style={styles.rowCity}>📍 {item.city}</Text>}
                </View>
                <TouchableOpacity
                  style={[
                    styles.inviteBtn,
                    isSent    && styles.inviteBtnSent,
                    isSending && styles.inviteBtnLoading,
                  ]}
                  onPress={() => !isSent && !isSending && handleInvite(item)}
                  disabled={isSent || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.inviteBtnText}>
                      {isSent ? '✓ Invited' : 'Invite'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: 22, color: colors.text },
  headerInfo: { flex: 1 },
  headerTitle: { ...typography.heading, color: colors.text },
  headerSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyText: { ...typography.body, fontWeight: '700', color: colors.text },
  emptySub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  listHeader: {
    ...typography.caption, color: colors.textSecondary, fontWeight: '600',
    marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 60 + spacing.md },

  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, paddingVertical: spacing.sm,
  },
  rowInfo: { flex: 1 },
  rowName: { ...typography.body, fontWeight: '600', color: colors.text },
  rowCity: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  inviteBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.primary, borderRadius: radius.full, minWidth: 72,
    alignItems: 'center',
  },
  inviteBtnSent: { backgroundColor: colors.success },
  inviteBtnLoading: { backgroundColor: colors.primary, opacity: 0.7 },
  inviteBtnText: { ...typography.small, color: '#fff', fontWeight: '700' },
});
