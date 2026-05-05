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
import { LinearGradient } from 'expo-linear-gradient';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CHIP_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#FFB347', '#87CEEB',
];

const HERO_HEIGHT = 280;

const LOOKING_FOR_COLORS: Record<string, string> = {
  friends:    '#00B894',
  dating:     '#FF4B6E',
  networking: '#0984E3',
  events:     '#E17055',
};

const LOOKING_FOR_LABELS: Record<string, string> = {
  friends:    '👫 Friends',
  dating:     '💘 Dating',
  networking: '💼 Networking',
  events:     '🎉 Events',
};

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

// ─── Hero Photo Carousel (full-bleed) ─────────────────────────────────────────
function HeroPhotoCarousel({ photos, name, photoURL }: { photos?: string[]; name: string; photoURL?: string }) {
  const allPhotos = photos?.length ? photos : (photoURL ? [photoURL] : []);
  const [activeIdx, setActiveIdx] = useState(0);

  if (allPhotos.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <FlatList
        data={allPhotos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
        }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT, resizeMode: 'cover' }}
          />
        )}
      />
      {/* Dot indicators */}
      {allPhotos.length > 1 && (
        <View style={{ position: 'absolute', bottom: 60, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {allPhotos.map((_, i) => (
            <View key={i} style={{
              width: i === activeIdx ? 18 : 6, height: 4, borderRadius: 2,
              backgroundColor: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.45)',
            }} />
          ))}
        </View>
      )}
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

  const badgeBg   = score >= 85 ? '#FF4B6E' : score >= 70 ? '#6C5CE7' : score >= 50 ? '#0984E3' : C.border;
  const badgeEmoji = score >= 85 ? '🔥' : score >= 70 ? '💜' : score >= 50 ? '💙' : '';

  if (score === 0) return null;

  return (
    <View style={[mbc.card, { backgroundColor: C.surface, borderColor: badgeBg + '40' }]}>
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
  const { C, isDark } = useTheme();
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

  // Hero parallax
  const heroTranslate = scrollY.interpolate({
    inputRange: [-80, 0, HERO_HEIGHT],
    outputRange: [40, 0, -HERO_HEIGHT * 0.4],
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

  // Pick a hero gradient based on primary vibe or fallback
  const primaryVibe  = vibe?.primaryVibes?.[0] ?? '';
  const vibeGradients: Record<string, readonly [string, string, string]> = {
    chill:     ['#6C5CE7', '#A855F7', '#0984E3'],
    energetic: ['#FF4B6E', '#FF8C42', '#FFD700'],
    creative:  ['#E17055', '#FDCB6E', '#FF4B6E'],
    romantic:  ['#FF4B6E', '#C2185B', '#6C5CE7'],
    social:    ['#00B894', '#0984E3', '#6C5CE7'],
    focused:   ['#0984E3', '#00B4D8', '#00E676'],
    adventurous: ['#E17055', '#FF8C42', '#FFD700'],
  };
  const heroGrad: readonly [string, string, string] = vibeGradients[primaryVibe.toLowerCase()] ?? ['#1A0A2E', '#0D1744', '#6C5CE7'];

  const hasPhotos = (user.photos?.length ?? 0) > 0 || !!user.photoURL;

  return (
    <View style={styles.flex}>
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      >
        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Background: photo carousel OR gradient */}
          {hasPhotos ? (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: heroTranslate }] }]}>
              <HeroPhotoCarousel photos={user.photos} name={user.name} photoURL={user.photoURL} />
            </Animated.View>
          ) : (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: heroTranslate }] }]}>
              <LinearGradient
                colors={heroGrad}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              {/* Decorative circles */}
              <View style={styles.heroBubble1} />
              <View style={styles.heroBubble2} />
            </Animated.View>
          )}

          {/* Dark scrim at bottom for text legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)']}
            style={styles.heroScrim}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          />

          {/* Avatar centered in lower half */}
          <Animated.View style={[styles.heroAvatarWrap, { transform: [{ scale: avatarScale }] }]}>
            <LinearGradient
              colors={['#FF4B6E', '#6C5CE7']}
              style={styles.heroAvatarRing}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={[styles.heroAvatarInner, { backgroundColor: isDark ? '#0D0D1A' : '#fff' }]}>
                <Avatar name={user.name} photoURL={user.photoURL} size={94} />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Name / age / city overlaid at bottom */}
          <View style={styles.heroMeta}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{user.name}</Text>
              {user.age ? <Text style={styles.heroAge}>{user.age}</Text> : null}
              {user.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                </View>
              )}
            </View>
            {user.city ? (
              <Text style={styles.heroCity}>📍 {user.city}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <View style={styles.contentWrap}>

          {/* Meta pills: city + college/work */}
          {(user.college || user.work) && (
            <View style={styles.metaPillsRow}>
              {user.college && (
                <View style={[styles.metaPill, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={styles.metaPillText}>🎓 {user.college}</Text>
                </View>
              )}
              {user.work && (
                <View style={[styles.metaPill, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={styles.metaPillText}>💼 {user.work}</Text>
                </View>
              )}
            </View>
          )}

          {/* Looking For chips */}
          {(user.lookingFor ?? []).length > 0 && (
            <View style={styles.lookingForRow}>
              {(user.lookingFor ?? []).map((item) => {
                const color = LOOKING_FOR_COLORS[item] ?? C.primary;
                return (
                  <View key={item} style={[styles.lookingForChip, { backgroundColor: color + '18', borderColor: color + '50', borderWidth: 1 }]}>
                    <Text style={[styles.lookingForText, { color }]}>{LOOKING_FOR_LABELS[item]}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Bio */}
          {!!user.bio && (
            <View style={styles.section}>
              <SectionHeader title="About" />
              <Text style={styles.bio}>{user.bio}</Text>
            </View>
          )}

          {/* Interests */}
          {(user.interests ?? []).length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Interests" />
              <View style={styles.chipsRow}>
                {(user.interests ?? []).map((interest, idx) => {
                  const color = CHIP_PALETTE[idx % CHIP_PALETTE.length];
                  return (
                    <View
                      key={interest}
                      style={[styles.interestChip, { backgroundColor: color + '1A', borderColor: color + '55', borderWidth: 1 }]}
                    >
                      <Text style={[styles.interestChipText, { color }]}>{interest}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Vibe section */}
          {vibe && vibeAxes.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Vibe" />
              <View style={[styles.vibeCard, { backgroundColor: C.surface, borderColor: C.primary + '40' }]}>
                {vibeAxes.map((axis) => (
                  <VibeBar key={axis.label} {...axis} />
                ))}
                <View style={styles.primaryVibesRow}>
                  {vibe.primaryVibes.slice(0, 3).map((v) => (
                    <View key={v} style={[styles.primaryVibeChip, { backgroundColor: C.secondary + '20', borderColor: C.secondary + '40', borderWidth: 1 }]}>
                      <Text style={[styles.primaryVibeText, { color: C.secondary }]}>{v}</Text>
                    </View>
                  ))}
                </View>
                {vibe.nightlifeStyle && (
                  <Text style={[styles.nightlifeText, { color: C.textSecondary }]}>
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

          {/* Memories */}
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

          <View style={{ height: 110 }} />
        </View>
      </Animated.ScrollView>

      {/* ── Floating nav buttons over hero ───────────────────────────────── */}
      <SafeAreaView style={styles.floatingNav} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.floatBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={handleMoreMenu}>
          <Text style={styles.moreIcon}>⋯</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Footer CTA ──────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {connectionState === 'pending_sent' ? (
          <View style={[styles.pendingRow, { backgroundColor: C.surface }]}>
            <Text style={[styles.pendingText, { color: C.textSecondary }]}>⏳ Connect request sent — waiting for response</Text>
          </View>
        ) : connectionState === 'pending_received' ? (
          <View style={[styles.pendingRow, { backgroundColor: C.surface }]}>
            <Text style={[styles.pendingText, { color: C.textSecondary }]}>
              💌 {user.name} wants to connect with you! Check Connections.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleConnectPress}
            disabled={actionLoading}
            activeOpacity={0.88}
          >
            {connectionState === 'connected' ? (
              <LinearGradient
                colors={['#6C5CE7', '#A855F7']}
                style={styles.ctaBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.ctaBtnIcon}>💬</Text>
                    <Text style={styles.ctaBtnText}>Message {user.name}</Text>
                  </>
                )}
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={['#FF4B6E', '#D93056']}
                style={styles.ctaBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {/* Shine */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
                  style={styles.ctaShine}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                />
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color="#fff" />
                    <Text style={styles.ctaBtnText}>Connect with {user.name}</Text>
                  </>
                )}
              </LinearGradient>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    // ── Hero ────────────────────────────────────────────────────────────────
    hero: {
      height: HERO_HEIGHT,
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'flex-end',
    },
    heroScrim: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: HERO_HEIGHT * 0.65,
    },
    heroBubble1: {
      position: 'absolute',
      width: 220, height: 220, borderRadius: 110,
      backgroundColor: 'rgba(255,255,255,0.06)',
      top: -60, right: -40,
    },
    heroBubble2: {
      position: 'absolute',
      width: 140, height: 140, borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.04)',
      bottom: 30, left: -30,
    },
    heroAvatarWrap: {
      position: 'absolute',
      bottom: 64,
      alignSelf: 'center',
    },
    heroAvatarRing: {
      width: 108, height: 108, borderRadius: 54,
      alignItems: 'center', justifyContent: 'center',
    },
    heroAvatarInner: {
      width: 100, height: 100, borderRadius: 50,
      overflow: 'hidden',
    },
    heroMeta: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      alignItems: 'center',
    },
    heroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    heroName: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    heroAge: {
      fontSize: 22,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.85)',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    verifiedBadge: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.success,
      alignItems: 'center', justifyContent: 'center',
    },
    heroCity: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.80)',
      marginTop: 3,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },

    // ── Floating nav ────────────────────────────────────────────────────────
    floatingNav: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    floatBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.38)',
      alignItems: 'center', justifyContent: 'center',
    },
    moreIcon: {
      fontSize: 20,
      color: '#fff',
      fontWeight: '600',
      lineHeight: 22,
    },

    // ── Content ─────────────────────────────────────────────────────────────
    scroll: { paddingBottom: 0 },
    contentWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

    metaPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    metaPillText: {
      ...typography.caption,
      color: C.textSecondary,
      fontWeight: '500',
    },

    lookingForRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    lookingForChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    lookingForText: {
      ...typography.caption,
      fontWeight: '700',
    },

    section: { marginBottom: spacing.md },
    bio: { ...typography.body, color: C.textSecondary, lineHeight: 26, fontSize: 16 },

    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    interestChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
    },
    interestChipText: { fontSize: 13, fontWeight: '600' },

    vibeCard: {
      borderRadius: radius.md,
      borderWidth: 1.5,
      padding: spacing.md,
      ...shadows.card,
    },
    primaryVibesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
    primaryVibeChip: {
      paddingHorizontal: spacing.md, paddingVertical: 4,
      borderRadius: radius.full,
    },
    primaryVibeText: { ...typography.small, fontWeight: '600' },
    nightlifeText: { ...typography.caption, marginTop: spacing.sm },

    // ── Footer ──────────────────────────────────────────────────────────────
    footer: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      backgroundColor: C.background,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    ctaBtn: {
      height: 56,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      overflow: 'hidden',
      shadowColor: '#FF4B6E',
      shadowOpacity: 0.40,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    ctaShine: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: '50%',
      borderRadius: 16,
    },
    ctaBtnIcon: { fontSize: 20 },
    ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },

    pendingRow: {
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    pendingText: { ...typography.caption, textAlign: 'center', lineHeight: 20 },
  });
}
