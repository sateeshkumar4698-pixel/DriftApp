import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import {
  getConnectionRequestStatus,
  areConnected,
  getMemories,
  reportUser,
  blockUser,
} from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import { useTheme, AppColors, spacing, typography, radius, shadows } from '../../utils/useTheme';
import {
  DiscoverStackParamList,
  Memory,
  UserProfile,
} from '../../types';
import { dynamicVibeMatch, MatchBreakdown } from '../../utils/vibeMatch';
import { useMoodStore, MOOD_META } from '../../store/moodStore';

type RouteProps = RouteProp<DiscoverStackParamList, 'ProfileDetail'>;

// ─── Vibe Bar ──────────────────────────────────────────────────────────────────
function VibeBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { C } = useTheme();
  const safe = (typeof value === 'number' && isFinite(value)) ? Math.max(0, Math.min(1, value)) : 0;
  const pct  = Math.round(safe * 100);
  const width = `${pct}%` as `${number}%`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <Text style={{ ...typography.caption, color: C.textSecondary, width: 72 }}>{label}</Text>
      <View style={{
        flex: 1, height: 8,
        backgroundColor: C.surface,
        borderRadius: radius.full,
        overflow: 'hidden',
        marginHorizontal: spacing.sm,
      }}>
        <View style={{ height: '100%', borderRadius: radius.full, width, backgroundColor: color }} />
      </View>
      <Text style={{ ...typography.small, color: C.textSecondary, width: 28, textAlign: 'right' }}>{pct}</Text>
    </View>
  );
}

// ─── Memory Pill ──────────────────────────────────────────────────────────────
function MemoryPill({ memory }: { memory: Memory }) {
  const { C } = useTheme();
  if (memory.isPrivate) return null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: radius.md,
      padding: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm,
    }}>
      <Text style={{ fontSize: 22 }}>{memory.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.caption, color: C.text, fontWeight: '600' }} numberOfLines={1}>{memory.title}</Text>
        <Text style={{ ...typography.small, color: C.textSecondary }} numberOfLines={1}>{memory.description}</Text>
      </View>
    </View>
  );
}

// ─── Photo Carousel ───────────────────────────────────────────────────────────
function PhotoCarousel({ photos, name, photoURL }: { photos?: string[]; name: string; photoURL?: string }) {
  const allPhotos = photos?.length ? photos : (photoURL ? [photoURL] : []);
  const [activeIdx, setActiveIdx] = useState(0);

  if (allPhotos.length === 0) return null;
  if (allPhotos.length === 1) {
    return (
      <View style={{ borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.sm }}>
        <Image source={{ uri: allPhotos[0] }} style={{ width: '100%', height: 240 }} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={allPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48)));
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ height: 240, borderRadius: radius.md, marginRight: spacing.sm, width: SCREEN_WIDTH - 48 }}
          />
        )}
      />
      <PhotoDots count={allPhotos.length} activeIdx={activeIdx} />
    </View>
  );
}

function PhotoDots({ count, activeIdx }: { count: number; activeIdx: number }) {
  const { C } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{
          width: i === activeIdx ? 18 : 6, height: 6, borderRadius: 3,
          backgroundColor: i === activeIdx ? C.primary : C.border,
        }} />
      ))}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { C } = useTheme();
  return (
    <Text style={{
      ...typography.label,
      color: C.textSecondary,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    }}>{title}</Text>
  );
}

const LOOKING_FOR_LABELS: Record<string, string> = {
  friends: '👫 Friends',
  dating: '💘 Dating',
  networking: '💼 Networking',
  events: '🎉 Events',
};

// ─── Match Breakdown Card ─────────────────────────────────────────────────────────────
function MatchBreakdownCard({
  score,
  breakdown,
  mood,
}: {
  score: number;
  breakdown: MatchBreakdown;
  mood: import('../../store/moodStore').MoodPreset;
}) {
  const { C } = useTheme();
  const moodMeta = MOOD_META[mood];

  // Badge appearance
  const badgeBg   = score >= 85 ? '#FF4B6E' : score >= 70 ? '#6C5CE7' : score >= 50 ? '#0984E3' : C.border;
  const badgeEmoji = score >= 85 ? '🔥' : score >= 70 ? '💜' : score >= 50 ? '💙' : '';

  if (score === 0) return null;

  return (
    <View style={[mbc.card, { backgroundColor: C.surface, borderColor: badgeBg + '40' }]}>
      {/* Header */}
      <View style={mbc.header}>
        <View style={[mbc.scorePill, { backgroundColor: badgeBg }]}>
          {badgeEmoji ? <Text style={mbc.badgeEmoji}>{badgeEmoji}</Text> : null}
          <Text style={mbc.scoreText}>{score}% Vibe Match</Text>
        </View>
        <View style={[mbc.moodPill, { backgroundColor: moodMeta.color + '20' }]}>
          <Text style={{ fontSize: 11 }}>{moodMeta.icon}</Text>
          <Text style={[mbc.moodLabel, { color: moodMeta.color }]}>{moodMeta.label} mode</Text>
        </View>
      </View>

      {/* Breakdown rows */}
      {breakdown.sharedVibes.length > 0 && (
        <View style={mbc.row}>
          <Text style={mbc.rowEmoji}>✨</Text>
          <Text style={[mbc.rowLabel, { color: C.textSecondary }]}>Same vibe: </Text>
          <Text style={[mbc.rowValue, { color: C.text }]}>{breakdown.sharedVibes.slice(0, 3).join(', ')}</Text>
        </View>
      )}
      {breakdown.sharedMusic.length > 0 && (
        <View style={mbc.row}>
          <Text style={mbc.rowEmoji}>🎵</Text>
          <Text style={[mbc.rowLabel, { color: C.textSecondary }]}>Music: </Text>
          <Text style={[mbc.rowValue, { color: C.text }]}>{breakdown.sharedMusic.slice(0, 3).join(', ')}</Text>
        </View>
      )}
      {breakdown.sharedInterests.length > 0 && (
        <View style={mbc.row}>
          <Text style={mbc.rowEmoji}>🎯</Text>
          <Text style={[mbc.rowLabel, { color: C.textSecondary }]}>Interests: </Text>
          <Text style={[mbc.rowValue, { color: C.text }]}>{breakdown.sharedInterests.slice(0, 4).join(', ')}</Text>
        </View>
      )}
      {breakdown.sameCity && (
        <View style={mbc.row}>
          <Text style={mbc.rowEmoji}>📍</Text>
          <Text style={[mbc.rowValue, { color: C.text }]}>Same city</Text>
        </View>
      )}
      {breakdown.sharedIntent.length > 0 && (
        <View style={mbc.row}>
          <Text style={mbc.rowEmoji}>👫</Text>
          <Text style={[mbc.rowLabel, { color: C.textSecondary }]}>Both looking for: </Text>
          <Text style={[mbc.rowValue, { color: C.text }]}>
            {breakdown.sharedIntent.map((i) => LOOKING_FOR_LABELS[i] ?? i).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const mbc = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: 4 },
  scorePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 5,
    borderRadius: radius.full,
  },
  badgeEmoji: { fontSize: 12 },
  scoreText:  { fontSize: 13, fontWeight: '800', color: '#fff' },
  moodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
  },
  moodLabel: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  rowEmoji: { fontSize: 13, marginRight: 5 },
  rowLabel: { ...typography.small },
  rowValue: { ...typography.small, fontWeight: '600', flex: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileDetailScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const navigation = useNavigation<NativeStackNavigationProp<DiscoverStackParamList>>();
  const route = useRoute<RouteProps>();
  const { user } = route.params;
  const { firebaseUser, userProfile: myProfile } = useAuthStore();
  const firebaseUser_ = firebaseUser; // alias for inner fns
  const moodPreset    = useMoodStore((s) => s.moodPreset);
  const moodIntensity = useMoodStore((s) => s.moodIntensity);

  // Compute match score against current user's profile
  const matchResult = myProfile ? dynamicVibeMatch(myProfile, user, moodPreset, moodIntensity) : null;

  const [memories, setMemories] = useState<Memory[]>([]);
  const [connectionState, setConnectionState] = useState<
    'none' | 'pending_sent' | 'pending_received' | 'connected'
  >('none');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const VIBE_COLORS = [C.primary, C.secondary, C.success, C.warning];

  function handleMoreMenu() {
    const myUid = firebaseUser_?.uid ?? '';
    Alert.alert(user.name, 'What would you like to do?', [
      {
        text: '🚩 Report',
        onPress: () =>
          Alert.alert('Report User', 'Why are you reporting this profile?', [
            { text: 'Fake profile',          onPress: () => { reportUser(myUid, user.uid, 'Fake profile'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Inappropriate content', onPress: () => { reportUser(myUid, user.uid, 'Inappropriate content'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Spam',                  onPress: () => { reportUser(myUid, user.uid, 'Spam'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Harassment',            onPress: () => { reportUser(myUid, user.uid, 'Harassment'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Cancel', style: 'cancel' },
          ]),
      },
      {
        text: '🚫 Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Block ' + user.name + '?', 'They won\'t be able to find or message you on Drift.', [
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                await blockUser(myUid, user.uid);
                Alert.alert('Blocked', user.name + ' has been blocked.');
                navigation.goBack();
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const scrollY = useRef(new Animated.Value(0)).current;

  const avatarScale = scrollY.interpolate({
    inputRange: [-60, 0, 80],
    outputRange: [1.15, 1, 0.85],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    async function load() {
      if (!firebaseUser_) return;
      setLoading(true);
      try {
        const [publicMemories, connectedAlready, sentRequest, receivedRequest] =
          await Promise.all([
            getMemories(user.uid),
            areConnected(firebaseUser_.uid, user.uid),
            getConnectionRequestStatus(firebaseUser_.uid, user.uid),
            getConnectionRequestStatus(user.uid, firebaseUser_.uid),
          ]);

        setMemories(publicMemories.filter((m) => !m.isPrivate).slice(0, 6));

        if (connectedAlready) {
          setConnectionState('connected');
        } else if (sentRequest?.status === 'pending') {
          setConnectionState('pending_sent');
        } else if (receivedRequest?.status === 'pending') {
          setConnectionState('pending_received');
        } else {
          setConnectionState('none');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.uid, firebaseUser_]);

  function handleConnectPress() {
    if (connectionState === 'connected') {
      const connectionId = [firebaseUser_!.uid, user.uid].sort().join('_');
      navigation.navigate('Chat', { connectionId, connectedUser: user });
      return;
    }
    if (connectionState === 'none') {
      navigation.navigate('ConnectRequest', { user });
    }
  }

  const vibe = user.vibeProfile;
  const vibeAxes = vibe
    ? [
        { label: 'Energy',     value: vibe.energy,     color: VIBE_COLORS[0] },
        { label: 'Social',     value: vibe.social,     color: VIBE_COLORS[1] },
        { label: 'Adventure',  value: vibe.adventure,  color: VIBE_COLORS[2] },
        { label: 'Aesthetic',  value: vibe.aesthetic,  color: VIBE_COLORS[3] },
      ]
    : [];

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportBtn} onPress={handleMoreMenu}>
          <Text style={styles.reportIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      >
        {(user.photos?.length ?? 0) > 0 ? (
          <View style={styles.carouselWrapper}>
            <PhotoCarousel photos={user.photos} name={user.name} photoURL={user.photoURL} />
            {user.isVerified && (
              <View style={styles.verifiedBadgeOverlay}>
                <Text style={styles.verifiedOverlayText}>✓ Verified</Text>
              </View>
            )}
          </View>
        ) : (
          <Animated.View style={[styles.heroSection, { transform: [{ scale: avatarScale }] }]}>
            <Avatar name={user.name} photoURL={user.photoURL} size={100} />
            {user.isVerified && (
              <View style={styles.verifiedRow}>
                <Text style={styles.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </Animated.View>
        )}

        <View style={styles.nameSection}>
          <Text style={styles.name}>{user.name}{user.age ? `, ${user.age}` : ''}</Text>
          {user.city && <Text style={styles.city}>📍 {user.city}</Text>}
          <View style={styles.metaRow}>
            {user.college && <Text style={styles.metaTag}>🎓 {user.college}</Text>}
            {user.work    && <Text style={styles.metaTag}>💼 {user.work}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.lookingForRow}>
            {(user.lookingFor ?? []).map((item) => (
              <View key={item} style={styles.lookingForChip}>
                <Text style={styles.lookingForText}>{LOOKING_FOR_LABELS[item]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="About" />
          <Text style={styles.bio}>{user.bio}</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Interests" />
          <View style={styles.chipsRow}>
            {(user.interests ?? []).map((interest) => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestChipText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>

        {vibe && vibeAxes.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Vibe" />
            <View style={[styles.card, { padding: spacing.md }]}>
              {vibeAxes.map((axis) => (
                <VibeBar key={axis.label} {...axis} />
              ))}
              <View style={styles.primaryVibesRow}>
                {vibe.primaryVibes.slice(0, 3).map((v) => (
                  <View key={v} style={styles.primaryVibeChip}>
                    <Text style={styles.primaryVibeText}>{v}</Text>
                  </View>
                ))}
              </View>
              {vibe.nightlifeStyle && (
                <Text style={styles.nightlifeText}>
                  🌙 Nightlife style: <Text style={{ fontWeight: '600' }}>{vibe.nightlifeStyle}</Text>
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Match Breakdown Card */}
        {matchResult && matchResult.score > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Your Match" />
            <MatchBreakdownCard
              score={matchResult.score}
              breakdown={matchResult.breakdown}
              mood={moodPreset}
            />
          </View>
        )}

        {memories.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Memories & Moments" />
            {loading ? (
              <ActivityIndicator color={C.primary} />
            ) : (
              memories.map((m) => <MemoryPill key={m.id} memory={m} />)
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      <View style={styles.footer}>
        {connectionState === 'pending_sent' ? (
          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>⏳ Connect request sent — waiting for response</Text>
          </View>
        ) : connectionState === 'pending_received' ? (
          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>
              💌 {user.name} wants to connect with you! Check Connections.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.connectBtn, connectionState === 'connected' && styles.connectedBtn]}
            onPress={handleConnectPress}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.connectBtnIcon}>
                  {connectionState === 'connected' ? '💬' : '🤝'}
                </Text>
                <Text style={styles.connectBtnText}>
                  {connectionState === 'connected'
                    ? `Message ${user.name}`
                    : `Connect with ${user.name}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },
    topBar: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.surface,
      alignItems: 'center', justifyContent: 'center',
      ...shadows.card,
    },
    reportBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.surface,
      alignItems: 'center', justifyContent: 'center',
      ...shadows.card,
    },
    reportIcon: { fontSize: 20, color: C.textSecondary },
    scroll: { paddingHorizontal: spacing.lg },
    carouselWrapper: { marginBottom: spacing.sm, position: 'relative' },
    verifiedBadgeOverlay: {
      position: 'absolute', top: spacing.sm, right: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingHorizontal: spacing.sm, paddingVertical: 3,
      borderRadius: radius.full,
    },
    verifiedOverlayText: { ...typography.small, color: '#fff', fontWeight: '700' },
    heroSection: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
    verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
    verifiedText: { ...typography.small, color: C.success, fontWeight: '700' },
    nameSection: { alignItems: 'center', marginBottom: spacing.sm },
    name: { ...typography.h1, color: C.text, textAlign: 'center' },
    city: { ...typography.body, color: C.textSecondary, marginTop: spacing.xs },
    metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
    metaTag: { ...typography.caption, color: C.textSecondary },
    section: { marginBottom: spacing.md },
    lookingForRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
    lookingForChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.lg, backgroundColor: C.primary + '12',
    },
    lookingForText: { ...typography.caption, color: C.primary, fontWeight: '600' },
    bio: { ...typography.body, color: C.textSecondary, lineHeight: 26 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    interestChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
    },
    interestChipText: { ...typography.caption, color: C.textSecondary },
    card: { backgroundColor: C.surface, borderRadius: radius.md, ...shadows.card },
    primaryVibesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
    primaryVibeChip: {
      paddingHorizontal: spacing.md, paddingVertical: 4,
      borderRadius: radius.full, backgroundColor: C.secondary + '20',
    },
    primaryVibeText: { ...typography.small, color: C.secondary, fontWeight: '600' },
    nightlifeText: { ...typography.caption, color: C.textSecondary, marginTop: spacing.sm },
    footer: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      backgroundColor: C.background,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    connectBtn: {
      backgroundColor: C.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      ...shadows.card,
    },
    connectedBtn: { backgroundColor: C.secondary },
    connectBtnIcon: { fontSize: 20 },
    connectBtnText: { ...typography.body, color: '#fff', fontWeight: '700' },
    pendingRow: {
      backgroundColor: C.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    pendingText: { ...typography.caption, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}
