import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import {
  getDiscoverFeed,
  getInteractedUids,
  getActiveStatuses,
  getMyStatus,
  subscribeToConnections,
  subscribeToUnreadCount,
} from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { Connection, DiscoverStackParamList, DriftStatus, UserProfile } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_EMOJI: Record<string, string> = {
  friends: '👫',
  dating: '💘',
  networking: '💼',
  events: '🎉',
};

const STATUS_TYPE_EMOJI: Record<string, string> = {
  vibe_check:    '✨',
  location_drop: '📍',
  looking_for:   '👀',
  game_invite:   '🎮',
  photo_moment:  '📸',
  memory_share:  '🌟',
  event_invite:  '🎉',
};

const STATUS_TYPE_LABEL: Record<string, string> = {
  vibe_check:    'Vibe Check',
  location_drop: 'Location Drop',
  looking_for:   'Looking For',
  game_invite:   'Game Invite',
  photo_moment:  'Photo Moment',
  memory_share:  'Memory Share',
};

const INTENT_FILTERS = ['All', 'Friends', 'Networking', 'Events', 'Dating', '🟢 Active'];

// ─── Vibe helpers ─────────────────────────────────────────────────────────────

function vibeHint(me: UserProfile, other: UserProfile): string {
  const myInterests    = me.interests    ?? [];
  const otherInterests = other.interests ?? [];
  const shared = myInterests.filter((i) => otherInterests.includes(i));
  if (shared.length >= 3) return `You both love ${shared.slice(0, 2).join(' & ')} ✨`;
  if (shared.length > 0)  return `Shared interest: ${shared[0]} 🎯`;
  const myVibes    = me.vibeProfile?.primaryVibes    ?? [];
  const otherVibes = other.vibeProfile?.primaryVibes ?? [];
  const sharedVibes = myVibes.filter((v) => otherVibes.includes(v));
  if (sharedVibes.length > 0) return `Same vibe: ${sharedVibes[0]} 🔥`;
  return 'New kind of connection 🌊';
}

function vibeMatch(me: UserProfile, other: UserProfile): number {
  let score = 0;
  const myI    = me.interests    ?? [];
  const otherI = other.interests ?? [];
  const sharedI = myI.filter((i) => otherI.includes(i));
  score += Math.min(sharedI.length * 12, 40);

  const myV    = me.vibeProfile?.primaryVibes    ?? [];
  const otherV = other.vibeProfile?.primaryVibes ?? [];
  const sharedV = myV.filter((v) => otherV.includes(v));
  score += Math.min(sharedV.length * 12, 30);

  if (me.city && other.city && me.city.toLowerCase() === other.city.toLowerCase()) score += 15;

  const myLF    = me.lookingFor    ?? [];
  const otherLF = other.lookingFor ?? [];
  if (myLF.some((f) => otherLF.includes(f))) score += 15;

  return Math.min(score, 99); // cap at 99 so 100 is never shown (keeps it honest)
}

// ─── Status Viewer Modal ──────────────────────────────────────────────────────

interface StatusViewItem {
  status: DriftStatus;
  name: string;
  photoURL?: string;
  isMine?: boolean;
}

function StatusViewerModal({
  item,
  onClose,
  onEdit,
}: {
  item: StatusViewItem | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  if (!item) return null;
  const { status, name, isMine } = item;
  const emoji = STATUS_TYPE_EMOJI[status.type] ?? '✨';
  const label = STATUS_TYPE_LABEL[status.type] ?? status.type;
  const typeColor: Record<string, string> = {
    vibe_check:    '#6C5CE7',
    location_drop: '#00B894',
    looking_for:   '#FF4B6E',
    game_invite:   '#0984E3',
    photo_moment:  '#E17055',
    memory_share:  '#FDCB6E',
  };
  const accentColor = typeColor[status.type] ?? colors.secondary;
  const timeLeft = Math.max(0, Math.round((status.expiresAt - Date.now()) / (1000 * 60 * 60)));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={sv.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={sv.sheet}>
          {/* Color bar */}
          <View style={[sv.colorBar, { backgroundColor: accentColor }]} />

          {/* Header */}
          <View style={sv.header}>
            <View style={[sv.typePill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
              <Text style={sv.typePillEmoji}>{emoji}</Text>
              <Text style={[sv.typePillLabel, { color: accentColor }]}>{label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isMine && onEdit && (
                <TouchableOpacity onPress={onEdit} style={[sv.closeBtn, sv.editBtn]}>
                  <Text style={[sv.closeBtnText, { color: accentColor }]}>✏️ Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={sv.closeBtn}>
                <Text style={sv.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Poster */}
          <Text style={sv.posterName}>{isMine ? 'Your status' : name}</Text>

          {/* Content */}
          <View style={sv.contentBox}>
            {status.text ? (
              <Text style={sv.contentText}>{status.text}</Text>
            ) : status.location ? (
              <View>
                <Text style={sv.locationVenue}>📍 {status.location.venue}</Text>
                {status.location.city ? (
                  <Text style={sv.locationCity}>{status.location.city}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Footer */}
          <View style={sv.footer}>
            <Text style={sv.expiryText}>⏱ Expires in {timeLeft}h</Text>
            <View style={[sv.audiencePill, { backgroundColor: status.audience === 'everyone' ? colors.success + '18' : colors.secondary + '18' }]}>
              <Text style={[sv.audienceText, { color: status.audience === 'everyone' ? colors.success : colors.secondary }]}>
                {status.audience === 'everyone' ? '🌍 Everyone' : '🫂 Connections'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const sv = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  colorBar:    { height: 4 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  typePillEmoji: { fontSize: 16 },
  typePillLabel: { ...typography.caption, fontWeight: '700' },
  closeBtn:      { padding: spacing.sm },
  closeBtnText:  { fontSize: 16, color: colors.textSecondary, fontWeight: '600' },
  editBtn:       { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 10 },
  posterName:    { ...typography.body, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  contentBox: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    minHeight: 80,
    justifyContent: 'center',
  },
  contentText:   { fontSize: 20, fontWeight: '600', color: colors.text, lineHeight: 30 },
  locationVenue: { fontSize: 20, fontWeight: '700', color: colors.text },
  locationCity:  { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  expiryText:    { ...typography.small, color: colors.textSecondary },
  audiencePill: {
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full,
  },
  audienceText:  { ...typography.small, fontWeight: '700' },
});

// ─── Stories Bar ──────────────────────────────────────────────────────────────

function StoriesBar({
  currentUser,
  myStatus,
  statuses,
  onAddStatus,
  onViewStatus,
}: {
  currentUser: UserProfile;
  myStatus: DriftStatus | null;
  statuses: StatusViewItem[];
  onAddStatus: () => void;
  onViewStatus: (item: StatusViewItem) => void;
}) {
  return (
    <View style={storiesStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={storiesStyles.row}>
        {/* My status */}
        <TouchableOpacity
          style={storiesStyles.storyItem}
          onPress={myStatus ? () => onViewStatus({ status: myStatus, name: currentUser.name, photoURL: currentUser.photoURL, isMine: true }) : onAddStatus}
          activeOpacity={0.8}
        >
          <View style={[
            storiesStyles.avatarRing,
            myStatus ? storiesStyles.activeRing : storiesStyles.addRing,
          ]}>
            <Avatar name={currentUser.name} photoURL={currentUser.photoURL} size={48} />
            {!myStatus && (
              <View style={storiesStyles.addDot}>
                <Text style={storiesStyles.addPlus}>+</Text>
              </View>
            )}
            {myStatus && (
              <View style={storiesStyles.statusTypeDot}>
                <Text style={{ fontSize: 10 }}>{STATUS_TYPE_EMOJI[myStatus.type] ?? '✨'}</Text>
              </View>
            )}
          </View>
          <Text style={storiesStyles.storyName} numberOfLines={1}>
            {myStatus ? 'My Status' : 'Add Status'}
          </Text>
        </TouchableOpacity>

        {/* Connection statuses */}
        {statuses.map((item) => (
          <TouchableOpacity
            key={item.status.uid}
            style={storiesStyles.storyItem}
            onPress={() => onViewStatus(item)}
            activeOpacity={0.8}
          >
            <View style={[storiesStyles.avatarRing, storiesStyles.connectionRing]}>
              <Avatar name={item.name} photoURL={item.photoURL} size={48} />
              <View style={storiesStyles.statusTypeDot}>
                <Text style={{ fontSize: 10 }}>{STATUS_TYPE_EMOJI[item.status.type] ?? '✨'}</Text>
              </View>
            </View>
            <Text style={storiesStyles.storyName} numberOfLines={1}>
              {item.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const storiesStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  row: { paddingHorizontal: spacing.md, gap: spacing.md },
  storyItem: { alignItems: 'center', gap: 4, width: 68 },
  avatarRing: {
    width: 60, height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRing: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  activeRing: {
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
  connectionRing: {
    borderColor: colors.secondary,
    borderStyle: 'solid',
  },
  addDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  addPlus: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  statusTypeDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  storyName: {
    ...typography.small,
    color: colors.textSecondary,
    maxWidth: 68,
    textAlign: 'center',
  },
});

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  search,
  setSearch,
  activeFilter,
  setActiveFilter,
}: {
  search: string;
  setSearch: (s: string) => void;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
}) {
  return (
    <View style={styles.filterContainer}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, interest or vibe..."
          placeholderTextColor={colors.textSecondary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={INTENT_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
            onPress={() => setActiveFilter(item)}
          >
            <Text style={[styles.filterChipText, activeFilter === item && styles.filterChipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({
  user,
  currentUser,
  isActive,
  onPress,
  onConnect,
  onMeet,
  onEvent,
}: {
  user: UserProfile;
  currentUser: UserProfile;
  isActive: boolean;
  onPress: () => void;
  onConnect: () => void;
  onMeet: () => void;
  onEvent: () => void;
}) {
  const hint     = vibeHint(currentUser, user);
  const matchPct = vibeMatch(currentUser, user);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const interests = user.interests ?? [];
  const lookingFor = user.lookingFor ?? [];

  function handlePressIn() {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }
  function handlePressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  }

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Top row */}
        <View style={styles.cardTop}>
          <View>
            <Avatar name={user.name} photoURL={user.photoURL} size={64} />
            {isActive && <View style={styles.activeDot} />}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{user.name}{user.age ? `, ${user.age}` : ''}</Text>
              {user.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
              {isActive && (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>🟢 Active</Text>
                </View>
              )}
            </View>
            {user.city ? <Text style={styles.cardCity}>📍 {user.city}</Text> : null}
            {(user.college || user.work) ? (
              <Text style={styles.cardMeta} numberOfLines={1}>{user.college ?? user.work}</Text>
            ) : null}
          </View>
          {/* Match % badge */}
          {matchPct > 0 && (
            <View style={[styles.matchBadge, matchPct >= 60 && styles.matchBadgeHigh]}>
              <Text style={[styles.matchPct, matchPct >= 60 && styles.matchPctHigh]}>{matchPct}%</Text>
              <Text style={styles.matchLabel}>match</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {user.bio ? (
          <Text style={styles.cardBio} numberOfLines={2}>{user.bio}</Text>
        ) : null}

        {/* Interest chips */}
        {interests.length > 0 && (
          <View style={styles.chipsRow}>
            {interests.slice(0, 4).map((interest) => (
              <View key={interest} style={styles.chip}>
                <Text style={styles.chipText}>{interest}</Text>
              </View>
            ))}
            {interests.length > 4 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>+{interests.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Vibe hint */}
        {hint ? (
          <View style={styles.hintRow}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}

        {/* Vibe tags */}
        {(user.vibeProfile?.primaryVibes ?? []).length > 0 && (
          <View style={styles.vibeRow}>
            {(user.vibeProfile!.primaryVibes).slice(0, 2).map((v) => (
              <View key={v} style={styles.vibeChip}>
                <Text style={styles.vibeChipText}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* ── Action row ── */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onMeet} activeOpacity={0.8}>
          <Text style={styles.actionBtnEmoji}>🗺</Text>
          <Text style={styles.actionBtnLabel}>Meet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onEvent} activeOpacity={0.8}>
          <Text style={styles.actionBtnEmoji}>🎉</Text>
          <Text style={styles.actionBtnLabel}>Event</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.connectBtn]} onPress={onConnect} activeOpacity={0.8}>
          <Text style={styles.connectBtnEmoji}>🤝</Text>
          <Text style={styles.connectBtnLabel}>Connect</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DiscoverStackParamList>>();
  const uid         = useAuthStore((s) => s.firebaseUser?.uid);
  const userProfile = useAuthStore((s) => s.userProfile);

  const [users, setUsers]               = useState<UserProfile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [feedError, setFeedError]       = useState(false);
  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [myStatus, setMyStatus]         = useState<DriftStatus | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<StatusViewItem[]>([]);
  const [viewingStatus, setViewingStatus] = useState<StatusViewItem | null>(null);
  const [activeUids, setActiveUids]       = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount]     = useState(0);

  // Live unread notification badge
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToUnreadCount(uid, setUnreadCount);
    return unsub;
  }, [uid]);

  const lastDocRef = useRef<any>(null);
  const hasMoreRef = useRef(true);

  const loadFeed = useCallback(async (reset = false) => {
    if (!uid) return;
    if (reset) {
      setLoading(true);
      setFeedError(false);
      lastDocRef.current = null;
      hasMoreRef.current = true;
    }
    if (!hasMoreRef.current) return;
    try {
      const blockedUids = userProfile?.blockedUsers ?? [];
      const excludeUids = reset ? [...await getInteractedUids(uid), ...blockedUids] : [];
      const { users: newUsers, lastDoc } = await getDiscoverFeed(
        uid,
        excludeUids,
        reset ? undefined : lastDocRef.current,
      );
      lastDocRef.current = lastDoc;
      hasMoreRef.current = newUsers.length === 20;
      setUsers((prev) => (reset ? newUsers : [...prev, ...newUsers]));
    } catch {
      setFeedError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [uid]);

  useEffect(() => { loadFeed(true); }, [loadFeed]);

  // Own status — re-fetch every time the screen comes into focus so it
  // appears immediately after posting or expiring (no stale cache).
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getMyStatus(uid).then(setMyStatus).catch(() => {});
    }, [uid]),
  );

  // Connection statuses — enrich names from already-loaded users when possible
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToConnections(uid, async (connections: Connection[]) => {
      if (connections.length === 0) { setConnectionStatuses([]); setActiveUids(new Set()); return; }
      const otherUids = connections.map((c) => c.users[0] === uid ? c.users[1] : c.users[0]);
      try {
        const statuses = await getActiveStatuses(otherUids);
        // Build set of who has an active status (for badge on profile cards)
        setActiveUids(new Set(statuses.map((s) => s.uid)));
        setConnectionStatuses(statuses.map((s) => {
          // Try to find the real name from already-loaded users
          const found = users.find((u) => u.uid === s.uid);
          return {
            status: s,
            name: found?.name ?? s.uid.slice(0, 8),
            photoURL: found?.photoURL,
          };
        }));
      } catch { /* non-critical */ }
    });
    return unsub;
  }, [uid, users]);

  function handleLoadMore() {
    if (loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    loadFeed(false);
  }

  const filtered = users.filter((u) => {
    const interests  = u.interests  ?? [];
    const lookingFor = u.lookingFor ?? [];
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      interests.some((i) => i.toLowerCase().includes(search.toLowerCase())) ||
      (u.vibeProfile?.primaryVibes ?? []).some((v) => v.toLowerCase().includes(search.toLowerCase()));
    let matchesFilter = true;
    if (activeFilter === '🟢 Active') {
      matchesFilter = activeUids.has(u.uid);
    } else if (activeFilter !== 'All') {
      matchesFilter = lookingFor.includes(activeFilter.toLowerCase() as any);
    }
    return matchesSearch && matchesFilter;
  });

  // "Near You" — same city, shown as a horizontal strip above the feed
  const nearYou = userProfile?.city
    ? users
        .filter((u) => u.city && u.city.toLowerCase() === (userProfile.city ?? '').toLowerCase())
        .slice(0, 12)
    : [];

  function handleConnect(user: UserProfile) {
    navigation.navigate('ConnectRequest', { user });
  }

  function handleMeet(user: UserProfile) {
    // MeetupSuggest requires a connectionId — navigate via any cast since we
    // may not have one at discover time; the MeetupSuggest screen will handle gracefully.
    (navigation as any).navigate('MeetupSuggest', { connectedUser: user, connectionId: '' });
  }

  function handleEvent(_user: UserProfile) {
    // Navigate to events tab — user can pick an event to invite to
    (navigation as any).navigate('Events');
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Status Viewer Modal */}
      <StatusViewerModal
        item={viewingStatus}
        onClose={() => setViewingStatus(null)}
        onEdit={() => {
          const status = viewingStatus?.status;
          setViewingStatus(null);
          navigation.navigate('StatusCreate', { initialStatus: status });
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Drift</Text>
          <Text style={styles.headerSub}>Discover your people</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Shake to Share */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('ShakeShare')}
          >
            <Text style={styles.headerIconText}>🤝</Text>
          </TouchableOpacity>

          {/* QR Scanner */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <Text style={styles.headerIconText}>📷</Text>
          </TouchableOpacity>

          {/* Bell icon with unread badge */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.connectionsBtn}
            onPress={() => navigation.navigate('Connections')}
          >
            <Text style={styles.connectionsBtnText}>Connections 💫</Text>
          </TouchableOpacity>
        </View>
      </View>

      {userProfile && (
        <StoriesBar
          currentUser={userProfile}
          myStatus={myStatus}
          statuses={connectionStatuses}
          onAddStatus={() => navigation.navigate('StatusCreate', undefined)}
          onViewStatus={(item) => setViewingStatus(item)}
        />
      )}

      <FilterBar
        search={search}
        setSearch={setSearch}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      {/* Near You horizontal strip */}
      {nearYou.length > 0 && !search && (
        <View style={styles.nearYouSection}>
          <Text style={styles.nearYouTitle}>📍 Near You · {userProfile?.city}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearYouRow}>
            {nearYou.map((u) => (
              <TouchableOpacity
                key={u.uid}
                style={styles.nearYouCard}
                onPress={() => navigation.navigate('ProfileDetail', { user: u })}
                activeOpacity={0.8}
              >
                <View style={styles.nearYouAvatarWrap}>
                  <Avatar name={u.name} photoURL={u.photoURL} size={48} />
                  {activeUids.has(u.uid) && <View style={styles.activeDot} />}
                </View>
                <Text style={styles.nearYouName} numberOfLines={1}>{u.name.split(' ')[0]}</Text>
                {u.city ? <Text style={styles.nearYouCity} numberOfLines={1}>{u.city}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          feedError ? (
            <EmptyState emoji="📡" title="Could not load people" subtitle="Check your connection and tap retry.">
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadFeed(true)}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </EmptyState>
          ) : (
            <EmptyState emoji="🌊" title="No one here yet" subtitle="Check back soon — more people are joining Drift every day." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} /> : null}
        renderItem={({ item }) =>
          userProfile ? (
            <ProfileCard
              user={item}
              currentUser={userProfile}
              isActive={activeUids.has(item.uid)}
              onPress={() => navigation.navigate('ProfileDetail', { user: item })}
              onConnect={() => handleConnect(item)}
              onMeet={() => handleMeet(item)}
              onEvent={() => handleEvent(item)}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.heading, color: colors.primary, fontWeight: '700', letterSpacing: -1 },
  headerSub:   { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { fontSize: 18 },
  bellBtn: { position: 'relative', padding: 6 },
  bellIcon: { fontSize: 22 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.background,
  },
  bellBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  connectionsBtn: {
    backgroundColor: `${colors.secondary}15`,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  connectionsBtnText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },

  filterContainer: {
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: { flex: 1, ...typography.body, color: colors.text },
  filterList:  { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText:       { ...typography.caption, color: colors.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: colors.background, fontWeight: '600' },

  feedList: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  cardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  cardInfo: { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardName: { ...typography.body, fontWeight: '700', color: colors.text },
  verifiedBadge: { fontSize: 12, color: colors.success, fontWeight: '700' },
  cardCity: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  intentBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  intentText: { fontSize: 18 },
  cardBio: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { ...typography.small, color: colors.textSecondary },
  hintRow: {
    backgroundColor: `${colors.primary}10`, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6, marginBottom: spacing.sm,
  },
  hintText: { ...typography.caption, color: colors.primary, fontWeight: '500' },
  vibeRow:  { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  vibeChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: `${colors.secondary}15`,
  },
  vibeChipText: { ...typography.small, color: colors.secondary, fontWeight: '600' },

  // Action row
  actionRow: {
    flexDirection: 'row', gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionBtnEmoji: { fontSize: 14 },
  actionBtnLabel: { ...typography.small, fontWeight: '600', color: colors.text },
  connectBtn: {
    flex: 1.5,
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  connectBtnEmoji: { fontSize: 14 },
  connectBtnLabel: { ...typography.small, fontWeight: '700', color: colors.background },

  retryBtn: {
    marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.full, alignSelf: 'center',
  },
  retryText: { ...typography.body, color: '#fff', fontWeight: '600' },

  // ── Active dot (on avatar) ────────────────────────────────────────────────
  activeDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2, borderColor: colors.background,
  },
  activePill: {
    backgroundColor: colors.success + '18',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
  },
  activePillText: { fontSize: 10, fontWeight: '700', color: colors.success },

  // ── Match badge ───────────────────────────────────────────────────────────
  matchBadge: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface,
    minWidth: 52,
  },
  matchBadgeHigh: { borderColor: colors.success + '60', backgroundColor: colors.success + '10' },
  matchPct:     { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  matchPctHigh: { color: colors.success },
  matchLabel:   { fontSize: 9, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5 },

  // ── Near You section ──────────────────────────────────────────────────────
  nearYouSection: {
    backgroundColor: colors.background,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  nearYouTitle: {
    ...typography.small, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  nearYouRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  nearYouCard: { alignItems: 'center', gap: 4, width: 64 },
  nearYouAvatarWrap: { position: 'relative' },
  nearYouName: { ...typography.small, fontWeight: '600', color: colors.text, textAlign: 'center', maxWidth: 64 },
  nearYouCity: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', maxWidth: 64 },
});
