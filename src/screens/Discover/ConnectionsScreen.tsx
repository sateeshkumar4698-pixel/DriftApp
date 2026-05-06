import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { dynamicVibeMatch, matchBadgeColor } from '../../utils/vibeMatch';
import { useMoodStore } from '../../store/moodStore';
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
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.requestTop}
        onPress={() => navigation.navigate('ProfileDetail', { user: sender })}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrapper}>
          <Avatar name={sender.name} photoURL={sender.photoURL} size={56} />
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.requestInfo}>
          <View style={styles.requestNameRow}>
            <Text style={styles.requestName}>{sender.name}</Text>
            {sender.age ? (
              <View style={styles.ageBadge}>
                <Text style={styles.ageBadgeText}>{sender.age}</Text>
              </View>
            ) : null}
          </View>
          {sender.city ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color={C.textSecondary} />
              <Text style={styles.locationText}>{sender.city}</Text>
            </View>
          ) : null}
          <Text style={styles.requestTime}>{formatRelativeTime(request.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Their note */}
      <View style={styles.noteBox}>
        <View style={styles.noteLabelRow}>
          <Ionicons name="chatbubble-ellipses" size={12} color={C.primary} />
          <Text style={styles.noteLabel}>Their message</Text>
        </View>
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
          {sender.interests.length > 3 && (
            <View style={styles.sharedChip}>
              <Text style={styles.sharedChipText}>+{sender.interests.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={onDecline}
          disabled={loading}
          activeOpacity={0.75}
        >
          <Ionicons name="close" size={16} color={C.textSecondary} />
          <Text style={styles.declineBtnText}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptBtnWrapper}
          onPress={onAccept}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FF4B6E', '#FF7A93']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.acceptBtn}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Connection Row ────────────────────────────────────────────────────────────
function ConnectionRow({
  connection,
  otherUser,
  myProfile,
  mood,
  moodIntensity,
  onPress,
  onMeetup,
  onAudioCall,
  onVideoCall,
}: {
  connection: Connection;
  otherUser: UserProfile;
  myProfile?: UserProfile | null;
  mood: import('../../store/moodStore').MoodPreset;
  moodIntensity: 1 | 2 | 3;
  onPress: () => void;
  onMeetup: () => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
}) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const hasMeetupProposal = !!connection.meetupProposal;
  const meetupStatus = connection.meetupProposal?.status;
  const matchResult = myProfile ? dynamicVibeMatch(myProfile, otherUser, mood, moodIntensity) : null;
  const matchScore  = matchResult?.score ?? 0;
  const badgeColors = matchScore >= 50 ? matchBadgeColor(matchScore) : null;

  return (
    <TouchableOpacity style={styles.connRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.avatarWrapper}>
        <Avatar name={otherUser.name} photoURL={otherUser.photoURL} size={54} />
      </View>

      <View style={styles.connInfo}>
        <View style={styles.connNameRow}>
          <Text style={styles.connName}>{otherUser.name}</Text>
          {matchScore >= 50 && badgeColors && (
            <View style={[styles.vibeScoreBadge, { backgroundColor: badgeColors.bg }]}>
              <Text style={{ fontSize: 9 }}>{badgeColors.emoji}</Text>
              <Text style={styles.vibeScoreText}>{matchScore}%</Text>
            </View>
          )}
        </View>
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

      {/* Right action buttons */}
      <View style={styles.connActions}>
        <TouchableOpacity
          style={[styles.callBtn, { backgroundColor: `${C.success}15` }]}
          onPress={onAudioCall}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="call" size={16} color={C.success} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.callBtn, { backgroundColor: `${C.secondary}15` }]}
          onPress={onVideoCall}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="videocam" size={16} color={C.secondary} />
        </TouchableOpacity>
        {connection.lastMessageAt && (
          <Text style={styles.connTime}>
            {formatRelativeTime(connection.lastMessageAt)}
          </Text>
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
  connectedCount,
}: {
  active: 'requests' | 'connected';
  onSelect: (t: 'requests' | 'connected') => void;
  pendingCount: number;
  connectedCount: number;
}) {
  const { C } = useTheme();
  const styles = makeStyles(C);

  return (
    <View style={styles.tabBar}>
      {(['requests', 'connected'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, active === tab && styles.tabActive]}
          onPress={() => onSelect(tab)}
          activeOpacity={0.75}
        >
          {active === tab && (
            <LinearGradient
              colors={['#FF4B6E', '#FF7A93']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tabIndicator}
            />
          )}
          <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>
            {tab === 'requests' ? 'Requests' : 'Connected'}
          </Text>
          {tab === 'requests' && pendingCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingCount}</Text>
            </View>
          )}
          {tab === 'connected' && connectedCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: `${C.secondary}20` }]}>
              <Text style={[styles.countBadgeText, { color: C.secondary }]}>{connectedCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ConnectionsScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const moodPreset    = useMoodStore((s) => s.moodPreset);
  const moodIntensity = useMoodStore((s) => s.moodIntensity);

  const [activeTab, setActiveTab] = useState<'requests' | 'connected'>('requests');
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, UserProfile>>({});
  const [connectedProfiles, setConnectedProfiles] = useState<Record<string, UserProfile>>({});
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubReq  = subscribeToPendingRequests(firebaseUser.uid, setPendingRequests);
    const unsubConn = subscribeToConnections(firebaseUser.uid, setConnections);
    return () => { unsubReq(); unsubConn(); };
  }, [firebaseUser]);

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

  function handleCall(otherUser: UserProfile, connectionId: string, callType: 'audio' | 'video') {
    (navigation as any).navigate('Call', {
      connectionId,
      remoteUser: otherUser,
      callType,
      isOutgoing: true,
    });
  }

  const filteredConnections = connections.filter((c) => {
    if (!search) return true;
    const otherUid  = c.users.find((u) => u !== firebaseUser?.uid) ?? '';
    const otherUser = connectedProfiles[otherUid];
    if (!otherUser) return false;
    return (
      otherUser.name.toLowerCase().includes(search.toLowerCase()) ||
      (otherUser.city ?? '').toLowerCase().includes(search.toLowerCase())
    );
  });

  async function handleRefresh() {
    setRefreshing(true);
    await new Promise((res) => setTimeout(res, 800));
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIconWrapper}>
            <LinearGradient
              colors={['#FF4B6E', '#6C5CE7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerIcon}
            >
              <Ionicons name="people" size={16} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.headerTitle}>Connections</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{connections.length}</Text>
          <Text style={styles.statLabel}>Connected</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, pendingRequests.length > 0 && { color: C.primary }]}>
            {pendingRequests.length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <TabBar
        active={activeTab}
        onSelect={setActiveTab}
        pendingCount={pendingRequests.length}
        connectedCount={connections.length}
      />

      {/* Search bar (Connected tab) */}
      {activeTab === 'connected' && (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={C.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: C.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search connections..."
              placeholderTextColor={C.textSecondary}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={C.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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
            if (!sender) {
              return (
                <View style={styles.skeletonCard}>
                  <ActivityIndicator color={C.primary} />
                </View>
              );
            }
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
          data={filteredConnections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🌱"
              title={search ? 'No results' : 'No connections yet'}
              subtitle={
                search
                  ? `No connections named "${search}"`
                  : 'Browse people on Discover and send a genuine connect request.'
              }
            />
          }
          renderItem={({ item }) => {
            const otherUid  = item.users.find((u) => u !== firebaseUser?.uid) ?? '';
            const otherUser = connectedProfiles[otherUid];
            if (!otherUser) return null;
            return (
              <ConnectionRow
                connection={item}
                otherUser={otherUser}
                myProfile={userProfile}
                mood={moodPreset}
                moodIntensity={moodIntensity}
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
                onAudioCall={() => handleCall(otherUser, item.id, 'audio')}
                onVideoCall={() => handleCall(otherUser, item.id, 'video')}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: C.surface,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerIconWrapper: {
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    headerIcon: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.h3,
      color: C.text,
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      gap: spacing.xl,
      backgroundColor: C.background,
    },
    statItem: {
      alignItems: 'center',
      gap: 2,
    },
    statNumber: {
      ...typography.h2,
      color: C.text,
    },
    statLabel: {
      ...typography.small,
      color: C.textSecondary,
      fontWeight: '500',
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: C.border,
    },

    // Tabs
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      gap: spacing.xs,
      position: 'relative',
    },
    tabActive: {},
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      borderRadius: 1,
    },
    tabText: {
      ...typography.label,
      color: C.textSecondary,
    },
    tabTextActive: {
      color: C.primary,
      fontWeight: '700',
    },
    countBadge: {
      backgroundColor: `${C.primary}20`,
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 1,
      minWidth: 18,
      alignItems: 'center',
    },
    countBadgeText: {
      ...typography.small,
      color: C.primary,
      fontWeight: '700',
    },

    list: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },

    // Request card
    requestCard: {
      backgroundColor: C.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      ...shadows.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    requestTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    avatarWrapper: {
      position: 'relative',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#10B981',
      borderWidth: 2,
      borderColor: C.card,
    },
    requestInfo: { flex: 1 },
    requestNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 4,
    },
    requestName: {
      ...typography.h3,
      color: C.text,
    },
    ageBadge: {
      backgroundColor: C.surface,
      borderRadius: radius.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: C.border,
    },
    ageBadgeText: {
      ...typography.small,
      color: C.textSecondary,
      fontWeight: '600',
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: 3,
    },
    locationText: {
      ...typography.caption,
      color: C.textSecondary,
    },
    requestTime: {
      ...typography.small,
      color: C.textTertiary,
    },

    noteBox: {
      backgroundColor: `${C.primary}08`,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: C.primary,
    },
    noteLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    noteLabel: {
      ...typography.small,
      color: C.primary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    noteText: {
      ...typography.body,
      color: C.text,
      lineHeight: 22,
      fontStyle: 'italic',
    },

    sharedRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.md,
      flexWrap: 'wrap',
    },
    sharedChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: `${C.secondary}12`,
      borderWidth: 1,
      borderColor: `${C.secondary}30`,
    },
    sharedChipText: {
      ...typography.small,
      color: C.secondary,
      fontWeight: '500',
    },

    requestActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    declineBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: radius.lg,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    declineBtnText: {
      ...typography.label,
      color: C.textSecondary,
    },
    acceptBtnWrapper: {
      flex: 2,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
    },
    acceptBtnText: {
      ...typography.label,
      color: '#fff',
      fontWeight: '700',
    },

    // Connection row
    connRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    connInfo: { flex: 1 },
    connNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 3,
    },
    connName: {
      ...typography.body,
      fontWeight: '600',
      color: C.text,
    },
    connMeta: {
      ...typography.caption,
      color: C.textSecondary,
    },
    meetupBadge: {
      marginTop: 4,
      alignSelf: 'flex-start',
      backgroundColor: `${C.warning}20`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    meetupBadgeAccepted: { backgroundColor: `${C.success}20` },
    meetupBadgeText: {
      ...typography.small,
      color: C.warning,
      fontWeight: '600',
    },

    connActions: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    callBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    connTime: {
      ...typography.small,
      color: C.textSecondary,
    },
    vibeScoreBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    vibeScoreText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#fff',
    },

    separator: {
      height: 1,
      backgroundColor: C.border,
      marginLeft: 70,
    },
    skeletonCard: {
      height: 80,
      backgroundColor: C.surface,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    searchRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: C.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
    },
  });
}
