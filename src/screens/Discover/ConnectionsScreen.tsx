import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import {
  subscribeToPendingRequests,
  subscribeToConnections,
  respondToConnectionRequest,
  getUserProfile,
} from '../../utils/firestore-helpers';
import { formatRelativeTime } from '../../utils/helpers';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import {
  Connection,
  ConnectionRequest,
  DiscoverStackParamList,
  UserProfile,
} from '../../types';

type Nav = NativeStackNavigationProp<DiscoverStackParamList>;

// ─── Pending Request Card ─────────────────────────────────────────────────────
function RequestCard({
  request,
  sender,
  onAccept,
  onDecline,
  loading,
}: {
  request: ConnectionRequest;
  sender: UserProfile;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
}) {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.requestTop}
        onPress={() => navigation.navigate('ProfileDetail', { user: sender })}
      >
        <Avatar name={sender.name} photoURL={sender.photoURL} size={52} />
        <View style={styles.requestInfo}>
          <View style={styles.requestNameRow}>
            <Text style={styles.requestName}>{sender.name}, {sender.age}</Text>
            {sender.city && <Text style={styles.requestCity}> · {sender.city}</Text>}
          </View>
          <Text style={styles.requestTime}>
            {formatRelativeTime(request.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Their note */}
      <View style={styles.noteBox}>
        <Text style={styles.noteLabel}>Their message</Text>
        <Text style={styles.noteText}>"{request.note}"</Text>
      </View>

      {/* Shared interests */}
      {sender.interests.length > 0 && (
        <View style={styles.sharedRow}>
          {sender.interests.slice(0, 3).map((i) => (
            <View key={i} style={styles.sharedChip}>
              <Text style={styles.sharedChipText}>{i}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={onDecline}
          disabled={loading}
        >
          <Text style={styles.declineBtnText}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={onAccept}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.acceptBtnText}>🤝 Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Connection Row ────────────────────────────────────────────────────────────
function ConnectionRow({
  connection,
  otherUser,
  onPress,
  onMeetup,
}: {
  connection: Connection;
  otherUser: UserProfile;
  onPress: () => void;
  onMeetup: () => void;
}) {
  const hasMeetupProposal = !!connection.meetupProposal;
  const meetupStatus = connection.meetupProposal?.status;

  return (
    <TouchableOpacity style={styles.connRow} onPress={onPress}>
      <Avatar name={otherUser.name} photoURL={otherUser.photoURL} size={52} />
      <View style={styles.connInfo}>
        <Text style={styles.connName}>{otherUser.name}</Text>
        <Text style={styles.connMeta} numberOfLines={1}>
          {connection.lastMessage ?? `Connected ${formatRelativeTime(connection.connectedAt)}`}
        </Text>
        {hasMeetupProposal && (
          <View style={[
            styles.meetupBadge,
            meetupStatus === 'accepted' && styles.meetupBadgeAccepted,
          ]}>
            <Text style={styles.meetupBadgeText}>
              {meetupStatus === 'accepted' ? '✓ Meetup confirmed!' :
               meetupStatus === 'pending' ? '📅 Meetup proposed' :
               '✓ Meetup done'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.connRight}>
        {connection.lastMessageAt && (
          <Text style={styles.connTime}>
            {formatRelativeTime(connection.lastMessageAt)}
          </Text>
        )}
        {!hasMeetupProposal && (
          <TouchableOpacity style={styles.meetupBtn} onPress={onMeetup}>
            <Text style={styles.meetupBtnText}>📅 Meet</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar({
  active,
  onSelect,
  pendingCount,
}: {
  active: 'requests' | 'connected';
  onSelect: (t: 'requests' | 'connected') => void;
  pendingCount: number;
}) {
  return (
    <View style={styles.tabBar}>
      {(['requests', 'connected'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, active === tab && styles.tabActive]}
          onPress={() => onSelect(tab)}
        >
          <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>
            {tab === 'requests' ? 'Requests' : 'Connected'}
            {tab === 'requests' && pendingCount > 0 && (
              <Text style={styles.badge}> {pendingCount}</Text>
            )}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ConnectionsScreen() {
  const navigation = useNavigation<Nav>();
  const { firebaseUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'requests' | 'connected'>('requests');
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  // user profiles fetched for each request/connection
  const [senderProfiles, setSenderProfiles] = useState<Record<string, UserProfile>>({});
  const [connectedProfiles, setConnectedProfiles] = useState<Record<string, UserProfile>>({});

  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  // Live listeners
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubReq = subscribeToPendingRequests(firebaseUser.uid, setPendingRequests);
    const unsubConn = subscribeToConnections(firebaseUser.uid, setConnections);
    return () => { unsubReq(); unsubConn(); };
  }, [firebaseUser]);

  // Fetch sender profiles for requests
  useEffect(() => {
    async function load() {
      const missing = pendingRequests.filter((r) => !senderProfiles[r.fromUid]);
      if (missing.length === 0) return;
      const fetched: Record<string, UserProfile> = {};
      await Promise.all(
        missing.map(async (r) => {
          const profile = await getUserProfile(r.fromUid);
          if (profile) fetched[r.fromUid] = profile;
        }),
      );
      setSenderProfiles((prev) => ({ ...prev, ...fetched }));
    }
    load();
  }, [pendingRequests]);

  // Fetch other-user profiles for connections
  useEffect(() => {
    if (!firebaseUser) return;
    async function load() {
      const missing = connections.filter((c) => {
        const otherUid = c.users.find((u) => u !== firebaseUser!.uid)!;
        return !connectedProfiles[otherUid];
      });
      if (missing.length === 0) return;
      const fetched: Record<string, UserProfile> = {};
      await Promise.all(
        missing.map(async (c) => {
          const otherUid = c.users.find((u) => u !== firebaseUser!.uid)!;
          const profile = await getUserProfile(otherUid);
          if (profile) fetched[otherUid] = profile;
        }),
      );
      setConnectedProfiles((prev) => ({ ...prev, ...fetched }));
    }
    load();
  }, [connections, firebaseUser]);

  async function handleRespond(requestId: string, status: 'accepted' | 'declined') {
    setRespondingTo(requestId);
    try {
      await respondToConnectionRequest(requestId, status);
      if (status === 'accepted') setActiveTab('connected');
    } catch {
      Alert.alert('Error', 'Could not respond. Please try again.');
    } finally {
      setRespondingTo(null);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={{ width: 32 }} />
      </View>

      <TabBar
        active={activeTab}
        onSelect={setActiveTab}
        pendingCount={pendingRequests.length}
      />

      {activeTab === 'requests' ? (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              emoji="📬"
              title="No pending requests"
              subtitle="When someone wants to connect with you, their request will appear here."
            />
          }
          renderItem={({ item }) => {
            const sender = senderProfiles[item.fromUid];
            if (!sender) return (
              <View style={styles.skeletonCard}>
                <ActivityIndicator color={colors.primary} />
              </View>
            );
            return (
              <RequestCard
                request={item}
                sender={sender}
                onAccept={() => handleRespond(item.id, 'accepted')}
                onDecline={() => handleRespond(item.id, 'declined')}
                loading={respondingTo === item.id}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              emoji="🌱"
              title="No connections yet"
              subtitle="Browse people on Discover and send a genuine connect request."
            />
          }
          renderItem={({ item }) => {
            const otherUid = item.users.find((u) => u !== firebaseUser?.uid) ?? '';
            const otherUser = connectedProfiles[otherUid];
            if (!otherUser) return null;
            return (
              <ConnectionRow
                connection={item}
                otherUser={otherUser}
                onPress={() =>
                  navigation.navigate('Chat', {
                    connectionId: item.id,
                    connectedUser: otherUser,
                  })
                }
                onMeetup={() =>
                  navigation.navigate('MeetupSuggest', {
                    connectionId: item.id,
                    connectedUser: otherUser,
                  })
                }
              />
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backIcon: { fontSize: 22, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.body, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  badge: { color: colors.primary, fontWeight: '700' },

  list: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },

  // Request card
  requestCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  requestTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  requestInfo: { flex: 1 },
  requestNameRow: { flexDirection: 'row', alignItems: 'baseline' },
  requestName: { ...typography.body, fontWeight: '700', color: colors.text },
  requestCity: { ...typography.caption, color: colors.textSecondary },
  requestTime: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  noteBox: {
    backgroundColor: `${colors.primary}08`,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  noteLabel: { ...typography.small, color: colors.primary, fontWeight: '600', marginBottom: 4 },
  noteText: { ...typography.body, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
  sharedRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, flexWrap: 'wrap' },
  sharedChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  sharedChipText: { ...typography.small, color: colors.textSecondary },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  declineBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.lg,
    backgroundColor: colors.surface, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  declineBtnText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  acceptBtn: {
    flex: 2, paddingVertical: spacing.sm, borderRadius: radius.lg,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  acceptBtnText: { ...typography.body, color: colors.background, fontWeight: '700' },

  // Connection row
  connRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, gap: spacing.md,
  },
  connInfo: { flex: 1 },
  connName: { ...typography.body, fontWeight: '600', color: colors.text },
  connMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  meetupBadge: {
    marginTop: 4, alignSelf: 'flex-start',
    backgroundColor: `${colors.warning}20`,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full,
  },
  meetupBadgeAccepted: { backgroundColor: `${colors.success}20` },
  meetupBadgeText: { ...typography.small, color: colors.warning, fontWeight: '600' },
  connRight: { alignItems: 'flex-end', gap: spacing.xs },
  connTime: { ...typography.small, color: colors.textSecondary },
  meetupBtn: {
    backgroundColor: `${colors.secondary}15`,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
  },
  meetupBtnText: { ...typography.small, color: colors.secondary, fontWeight: '600' },

  separator: { height: 1, backgroundColor: colors.border, marginLeft: 68 },
  skeletonCard: {
    height: 80, backgroundColor: colors.surface, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
});
