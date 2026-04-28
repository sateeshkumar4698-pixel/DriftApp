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
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import {
  DiscoverStackParamList,
  Memory,
  UserProfile,
  VibeProfile,
} from '../../types';

type RouteProps = RouteProp<DiscoverStackParamList, 'ProfileDetail'>;

// ─── Vibe Bar ──────────────────────────────────────────────────────────────────
function VibeBar({ label, value, color }: { label: string; value: number; color: string }) {
  // Guard against undefined/NaN values — vibeProfile fields are optional
  const safe = (typeof value === 'number' && isFinite(value)) ? Math.max(0, Math.min(1, value)) : 0;
  const pct  = Math.round(safe * 100);
  const width = `${pct}%` as `${number}%`;
  return (
    <View style={vibeBarStyles.row}>
      <Text style={vibeBarStyles.label}>{label}</Text>
      <View style={vibeBarStyles.track}>
        <View style={[vibeBarStyles.fill, { width, backgroundColor: color }]} />
      </View>
      <Text style={vibeBarStyles.value}>{pct}</Text>
    </View>
  );
}
const vibeBarStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary, width: 72 },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
  },
  fill: { height: '100%', borderRadius: radius.full },
  value: { ...typography.small, color: colors.textSecondary, width: 28, textAlign: 'right' },
});

// ─── Memory Pill ──────────────────────────────────────────────────────────────
function MemoryPill({ memory }: { memory: Memory }) {
  if (memory.isPrivate) return null;
  return (
    <View style={memStyles.pill}>
      <Text style={memStyles.emoji}>{memory.emoji}</Text>
      <View style={memStyles.info}>
        <Text style={memStyles.title} numberOfLines={1}>{memory.title}</Text>
        <Text style={memStyles.desc} numberOfLines={1}>{memory.description}</Text>
      </View>
    </View>
  );
}
const memStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  emoji: { fontSize: 22 },
  info: { flex: 1 },
  title: { ...typography.caption, color: colors.text, fontWeight: '600' },
  desc: { ...typography.small, color: colors.textSecondary },
});

// ─── Photo Carousel ───────────────────────────────────────────────────────────
function PhotoCarousel({ photos, name, photoURL }: { photos?: string[]; name: string; photoURL?: string }) {
  const allPhotos = photos?.length ? photos : (photoURL ? [photoURL] : []);
  const [activeIdx, setActiveIdx] = useState(0);

  if (allPhotos.length === 0) return null;
  if (allPhotos.length === 1) {
    return (
      <View style={carouselStyles.singleContainer}>
        <Image source={{ uri: allPhotos[0] }} style={carouselStyles.singleImage} />
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
            style={[carouselStyles.carouselImage, { width: SCREEN_WIDTH - 48 }]}
          />
        )}
      />
      <View style={carouselStyles.dots}>
        {allPhotos.map((_, i) => (
          <View key={i} style={[carouselStyles.dot, i === activeIdx && carouselStyles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  singleContainer: { borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.sm },
  singleImage: { width: '100%', height: 240 },
  carouselImage: { height: 240, borderRadius: radius.md, marginRight: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={sectionStyles.title}>{title}</Text>;
}
const sectionStyles = StyleSheet.create({
  title: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
});

const LOOKING_FOR_LABELS: Record<string, string> = {
  friends: '👫 Friends',
  dating: '💘 Dating',
  networking: '💼 Networking',
  events: '🎉 Events',
};

const VIBE_COLORS = [colors.primary, colors.secondary, colors.success, colors.warning];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DiscoverStackParamList>>();
  const route = useRoute<RouteProps>();
  const { user } = route.params;
  const { firebaseUser } = useAuthStore();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [connectionState, setConnectionState] = useState<
    'none' | 'pending_sent' | 'pending_received' | 'connected'
  >('none');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  function handleMoreMenu() {
    const myUid = firebaseUser?.uid ?? '';
    Alert.alert(user.name, 'What would you like to do?', [
      {
        text: '🚩 Report',
        onPress: () =>
          Alert.alert('Report User', 'Why are you reporting this profile?', [
            { text: 'Fake profile',      onPress: () => { reportUser(myUid, user.uid, 'Fake profile'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Inappropriate content', onPress: () => { reportUser(myUid, user.uid, 'Inappropriate content'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Spam',             onPress: () => { reportUser(myUid, user.uid, 'Spam'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
            { text: 'Harassment',       onPress: () => { reportUser(myUid, user.uid, 'Harassment'); Alert.alert('Reported', 'Thanks — we\'ll review this profile.'); } },
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
  const scrollY = new Animated.Value(0);

  const avatarScale = scrollY.interpolate({
    inputRange: [-60, 0, 80],
    outputRange: [1.15, 1, 0.85],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    async function load() {
      if (!firebaseUser) return;
      setLoading(true);
      try {
        const [publicMemories, connectedAlready, sentRequest, receivedRequest] =
          await Promise.all([
            getMemories(user.uid),
            areConnected(firebaseUser.uid, user.uid),
            getConnectionRequestStatus(firebaseUser.uid, user.uid),
            getConnectionRequestStatus(user.uid, firebaseUser.uid),
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
  }, [user.uid, firebaseUser]);

  function handleConnectPress() {
    if (connectionState === 'connected') {
      // Open chat
      const connectionId = [firebaseUser!.uid, user.uid].sort().join('_');
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
        { label: 'Energy', value: vibe.energy, color: VIBE_COLORS[0] },
        { label: 'Social', value: vibe.social, color: VIBE_COLORS[1] },
        { label: 'Adventure', value: vibe.adventure, color: VIBE_COLORS[2] },
        { label: 'Aesthetic', value: vibe.aesthetic, color: VIBE_COLORS[3] },
      ]
    : [];

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Back button */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
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
        {/* Hero — photo carousel or avatar */}
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

        {/* Name + meta */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{user.name}, {user.age}</Text>
          {user.city && <Text style={styles.city}>📍 {user.city}</Text>}
          <View style={styles.metaRow}>
            {user.college && (
              <Text style={styles.metaTag}>🎓 {user.college}</Text>
            )}
            {user.work && (
              <Text style={styles.metaTag}>💼 {user.work}</Text>
            )}
          </View>
        </View>

        {/* Looking For */}
        <View style={styles.section}>
          <View style={styles.lookingForRow}>
            {(user.lookingFor ?? []).map((item) => (
              <View key={item} style={styles.lookingForChip}>
                <Text style={styles.lookingForText}>{LOOKING_FOR_LABELS[item]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <SectionHeader title="About" />
          <Text style={styles.bio}>{user.bio}</Text>
        </View>

        {/* Interests */}
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

        {/* Vibe Profile */}
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

        {/* Memories timeline */}
        {memories.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Memories & Moments" />
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              memories.map((m) => <MemoryPill key={m.id} memory={m} />)
            )}
          </View>
        )}

        {/* Spacer for sticky footer */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Sticky connect footer */}
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
            style={[
              styles.connectBtn,
              connectionState === 'connected' && styles.connectedBtn,
            ]}
            onPress={handleConnectPress}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.background} />
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  reportBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  reportIcon: { fontSize: 20, color: colors.textSecondary },

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
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  verifiedText: { ...typography.small, color: colors.success, fontWeight: '700' },

  nameSection: { alignItems: 'center', marginBottom: spacing.sm },
  name: { ...typography.title, color: colors.text, textAlign: 'center' },
  city: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  metaTag: { ...typography.caption, color: colors.textSecondary },

  section: { marginBottom: spacing.md },

  lookingForRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  lookingForChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.lg, backgroundColor: `${colors.primary}12`,
  },
  lookingForText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  bio: { ...typography.body, color: colors.textSecondary, lineHeight: 26 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  interestChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  interestChipText: { ...typography.caption, color: colors.textSecondary },

  card: { backgroundColor: colors.surface, borderRadius: radius.md, ...shadows.card },
  primaryVibesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  primaryVibeChip: {
    paddingHorizontal: spacing.md, paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: `${colors.secondary}20`,
  },
  primaryVibeText: { ...typography.small, color: colors.secondary, fontWeight: '600' },
  nightlifeText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },

  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  connectBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  connectedBtn: { backgroundColor: colors.secondary },
  connectBtnIcon: { fontSize: 20 },
  connectBtnText: { ...typography.body, color: colors.background, fontWeight: '700' },
  pendingRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  pendingText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
