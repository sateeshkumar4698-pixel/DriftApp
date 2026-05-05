import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { getMemories, toggleMemoryFavorite } from '../../utils/firestore-helpers';
import { useTheme, AppColors, spacing, typography, radius, shadows } from '../../utils/useTheme';
import { Memory } from '../../types';

const SCREEN_W = Dimensions.get('window').width;

// ─── Type config ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { emoji: string; color: string; gradient: [string, string]; label: string }> = {
  first_connection: { emoji: '🤝', color: '#6C5CE7', gradient: ['#6C5CE7', '#A29BFE'], label: 'First Connection' },
  first_message:    { emoji: '💬', color: '#00B894', gradient: ['#00B894', '#55EFC4'], label: 'First Message' },
  call_milestone:   { emoji: '📞', color: '#0984E3', gradient: ['#0984E3', '#74B9FF'], label: 'Call' },
  game_win:         { emoji: '🏆', color: '#FDCB6E', gradient: ['#FDCB6E', '#FFE8A3'], label: 'Game Win' },
  event_attended:   { emoji: '🎉', color: '#E17055', gradient: ['#E17055', '#FAB1A0'], label: 'Event' },
  streak_milestone: { emoji: '🔥', color: '#FF4B6E', gradient: ['#FF4B6E', '#FF7A93'], label: 'Streak' },
  meetup_done:      { emoji: '📍', color: '#00CEC9', gradient: ['#00CEC9', '#81ECEC'], label: 'Meetup' },
  manual:           { emoji: '📝', color: '#636E72', gradient: ['#636E72', '#B2BEC3'], label: 'Note' },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(ts);
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All',         value: 'all',              icon: 'grid-outline' as const },
  { label: 'Favorites',   value: 'favorites',        icon: 'heart-outline' as const },
  { label: 'Pinned',      value: 'pinned',           icon: 'bookmark-outline' as const },
  { label: 'Connections', value: 'first_connection', icon: 'people-outline' as const },
  { label: 'Meetups',     value: 'meetup_done',      icon: 'location-outline' as const },
  { label: 'Streaks',     value: 'streak_milestone', icon: 'flame-outline' as const },
  { label: 'Events',      value: 'event_attended',   icon: 'calendar-outline' as const },
];

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function SkeletonCard({ C }: { C: AppColors }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View style={[styles.skeletonCard, { backgroundColor: C.surface, opacity }]}>
      <View style={[styles.skeletonBadge, { backgroundColor: C.border }]} />
      <View style={[styles.skeletonTitle, { backgroundColor: C.border }]} />
      <View style={[styles.skeletonSub,   { backgroundColor: C.border, width: '55%' }]} />
    </Animated.View>
  );
}

// ─── Stats Banner ────────────────────────────────────────────────────────────

function StatsBanner({ memories, C }: { memories: Memory[]; C: AppColors }) {
  const favCount     = memories.filter((m) => m.isFavorite).length;
  const pinnedCount  = memories.filter((m) => m.isPinned).length;
  const withPhoto    = memories.filter((m) => !!m.mediaURL).length;

  const stats = [
    { icon: 'albums-outline' as const,   label: 'Moments',   value: memories.length, color: '#6C5CE7' },
    { icon: 'heart-outline' as const,    label: 'Favorites', value: favCount,         color: '#FF4B6E' },
    { icon: 'bookmark-outline' as const, label: 'Pinned',    value: pinnedCount,      color: '#FDCB6E' },
    { icon: 'images-outline' as const,   label: 'With Photo', value: withPhoto,       color: '#00B894' },
  ];

  return (
    <View style={[styles.statsBanner, { backgroundColor: C.surface, borderColor: C.border }]}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.statItem, i < stats.length - 1 && { borderRightWidth: 1, borderRightColor: C.border }]}>
          <Ionicons name={s.icon} size={16} color={s.color} />
          <Text style={[styles.statValue, { color: C.text }]}>{s.value}</Text>
          <Text style={[styles.statLabel, { color: C.textSecondary }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Memory Card ─────────────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onToggleFavorite,
  C,
}: {
  memory: Memory;
  onToggleFavorite: (id: string, current: boolean) => void;
  C: AppColors;
}) {
  const config   = TYPE_CONFIG[memory.type] ?? TYPE_CONFIG.manual;
  const favScale = useRef(new Animated.Value(1)).current;

  function handleFavPress() {
    Animated.sequence([
      Animated.timing(favScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(favScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
    onToggleFavorite(memory.id, memory.isFavorite);
  }

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }, shadows.card]}>
      {/* Coloured left accent bar */}
      <LinearGradient
        colors={config.gradient}
        style={styles.cardAccent}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={styles.cardInner}>
        {/* ── Header row ── */}
        <View style={styles.cardHeader}>
          <View style={[styles.typePill, { backgroundColor: `${config.color}18` }]}>
            <Text style={styles.pillEmoji}>{config.emoji}</Text>
            <Text style={[styles.pillLabel, { color: config.color }]}>{config.label}</Text>
          </View>

          <View style={styles.cardHeaderRight}>
            {memory.isPinned && (
              <View style={[styles.pinnedBadge, { backgroundColor: `#FDCB6E18` }]}>
                <Ionicons name="bookmark" size={11} color="#D4A017" />
              </View>
            )}
            <Animated.View style={{ transform: [{ scale: favScale }] }}>
              <TouchableOpacity onPress={handleFavPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={memory.isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={memory.isFavorite ? '#FF4B6E' : C.textSecondary}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* ── Main content ── */}
        <View style={styles.cardBody}>
          <Text style={styles.memoryEmoji}>{memory.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={2}>{memory.title}</Text>
            {memory.description ? (
              <Text style={[styles.cardDesc, { color: C.textSecondary }]} numberOfLines={2}>
                {memory.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── Media thumbnail ── */}
        {memory.mediaURL ? (
          <Image
            source={{ uri: memory.mediaURL }}
            style={[styles.mediaThumbnail, { borderColor: C.border }]}
            resizeMode="cover"
          />
        ) : null}

        {/* ── Footer ── */}
        <View style={[styles.cardFooter, { borderTopColor: C.divider }]}>
          <Ionicons name="time-outline" size={12} color={C.textTertiary} />
          <Text style={[styles.cardDate, { color: C.textTertiary }]}>{formatRelativeDate(memory.date)}</Text>
          {memory.location ? (
            <>
              <View style={[styles.footerDot, { backgroundColor: C.textTertiary }]} />
              <Ionicons name="location-outline" size={12} color={C.textTertiary} />
              <Text style={[styles.cardDate, { color: C.textTertiary }]} numberOfLines={1}>{memory.location}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────────

function FilterChip({
  item,
  isActive,
  onPress,
  C,
}: {
  item: typeof FILTERS[number];
  isActive: boolean;
  onPress: () => void;
  C: AppColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[
          styles.filterChip,
          { backgroundColor: C.surface, borderColor: C.border },
          isActive && { backgroundColor: '#FF4B6E', borderColor: '#FF4B6E' },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={13}
          color={isActive ? '#fff' : C.textSecondary}
        />
        <Text style={[styles.filterText, { color: isActive ? '#fff' : C.textSecondary }, isActive && { fontWeight: '700' }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyMemories({ C }: { C: AppColors }) {
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={['#6C5CE718', '#FF4B6E18']}
        style={styles.emptyIconCircle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.emptyIconEmoji}>🌌</Text>
      </LinearGradient>
      <Text style={[styles.emptyTitle, { color: C.text }]}>No memories here yet</Text>
      <Text style={[styles.emptySub, { color: C.textSecondary }]}>
        Connect, meet people, hit streaks — Drift will capture your story automatically.
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ViewMemoriesScreen() {
  const navigation = useNavigation();
  const { C, isDark } = useTheme();
  const { firebaseUser } = useAuthStore();
  const [memories,     setMemories]     = useState<Memory[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const data = await getMemories(firebaseUser.uid);
      data.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.date - a.date;
      });
      setMemories(data);
    } catch {
      Alert.alert('Error', 'Could not load memories.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleFavorite(id: string, current: boolean) {
    if (!firebaseUser) return;
    try {
      await toggleMemoryFavorite(firebaseUser.uid, id, !current);
      setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, isFavorite: !current } : m)));
    } catch {
      Alert.alert('Error', 'Could not update memory.');
    }
  }

  const filtered = memories.filter((m) => {
    if (activeFilter === 'all')       return true;
    if (activeFilter === 'favorites') return m.isFavorite;
    if (activeFilter === 'pinned')    return m.isPinned;
    return m.type === activeFilter;
  });

  // Animated header
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0.7], extrapolate: 'clamp' });
  const headerScale   = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0.97], extrapolate: 'clamp' });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: C.background }]}>

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.text }]}>Memories</Text>
          {!loading && (
            <View style={styles.headerPillWrap}>
              <LinearGradient
                colors={['#FF4B6E', '#6C5CE7']}
                style={styles.headerPill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.headerPillText}>{memories.length} moments</Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Refresh */}
        <TouchableOpacity onPress={load} style={[styles.backBtn, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="refresh-outline" size={20} color={C.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Body ── */}
      <Animated.FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}

        /* ── Sticky header list items ── */
        ListHeaderComponent={
          <>
            {/* Stats banner */}
            {!loading && memories.length > 0 && (
              <StatsBanner memories={memories} C={C} />
            )}

            {/* Filter row */}
            <View style={[styles.filterRow, { borderBottomColor: C.divider }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    item={f}
                    isActive={activeFilter === f.value}
                    onPress={() => setActiveFilter(f.value)}
                    C={C}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Skeleton loaders while loading */}
            {loading && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} C={C} />)}
              </View>
            )}
          </>
        }

        ListEmptyComponent={
          !loading ? <EmptyMemories C={C} /> : null
        }

        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <MemoryCard memory={item} onToggleFavorite={handleToggleFavorite} C={C} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerTitle: { ...typography.h2, fontWeight: '800' },
  headerPillWrap: {},
  headerPill: {
    paddingHorizontal: spacing.md, paddingVertical: 3,
    borderRadius: radius.full,
  },
  headerPillText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  // Stats banner
  statsBanner: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.xs,
  },
  statItem: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 2,
  },
  statValue: { ...typography.h3, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '500' },

  // Filters
  filterRow: { borderBottomWidth: 1, marginTop: spacing.md },
  filterScroll: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
  },
  filterText: { ...typography.label, fontSize: 12 },

  // List
  listContent: { paddingTop: 0 },
  cardWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  // Card
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: { width: 4 },
  cardInner: { flex: 1, padding: spacing.md },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.sm,
  },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  pillEmoji: { fontSize: 11 },
  pillLabel: { fontSize: 11, fontWeight: '700' },

  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pinnedBadge: {
    width: 22, height: 22, borderRadius: radius.xs + 2,
    alignItems: 'center', justifyContent: 'center',
  },

  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  memoryEmoji: { fontSize: 30, lineHeight: 36 },
  cardTitle: { ...typography.bodyLg, fontWeight: '700', lineHeight: 22 },
  cardDesc:  { ...typography.caption, lineHeight: 18, marginTop: 3 },

  mediaThumbnail: {
    width: '100%', height: 160,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderTopWidth: 1, paddingTop: spacing.xs,
  },
  cardDate: { fontSize: 11, fontWeight: '500' },
  footerDot: { width: 3, height: 3, borderRadius: 1.5 },

  // Skeleton
  skeletonCard: {
    borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, gap: spacing.sm,
  },
  skeletonBadge: { height: 22, width: 90, borderRadius: radius.full },
  skeletonTitle: { height: 16, width: '80%', borderRadius: radius.xs },
  skeletonSub:   { height: 12, borderRadius: radius.xs },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyIconEmoji: { fontSize: 42 },
  emptyTitle: { ...typography.h2, fontWeight: '800', marginBottom: spacing.sm, textAlign: 'center' },
  emptySub:   { ...typography.bodyLg, textAlign: 'center', lineHeight: 24 },
});
