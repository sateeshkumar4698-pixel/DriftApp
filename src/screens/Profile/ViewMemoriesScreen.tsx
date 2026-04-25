import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { getMemories, toggleMemoryFavorite } from '../../utils/firestore-helpers';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { Memory } from '../../types';

const TYPE_CONFIG: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  first_connection:  { emoji: '🤝', color: '#6C5CE7', label: 'First Connection' },
  first_message:     { emoji: '💬', color: '#00B894', label: 'First Message' },
  call_milestone:    { emoji: '📞', color: '#0984E3', label: 'Call' },
  game_win:          { emoji: '🏆', color: '#FDCB6E', label: 'Game Win' },
  event_attended:    { emoji: '🎉', color: '#E17055', label: 'Event' },
  streak_milestone:  { emoji: '🔥', color: '#FF4B6E', label: 'Streak' },
  meetup_done:       { emoji: '📍', color: '#00CEC9', label: 'Meetup' },
  manual:            { emoji: '📝', color: '#636E72', label: 'Note' },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Memory Card ──────────────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onToggleFavorite,
}: {
  memory: Memory;
  onToggleFavorite: (id: string, current: boolean) => void;
}) {
  const config = TYPE_CONFIG[memory.type] ?? TYPE_CONFIG.manual;

  return (
    <View style={styles.card}>
      {/* Timeline dot */}
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <View style={[styles.dotLine]} />

      <View style={styles.cardContent}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: `${config.color}18` }]}>
            <Text style={styles.typeEmoji}>{config.emoji}</Text>
            <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onToggleFavorite(memory.id, memory.isFavorite)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.favoriteBtn}>{memory.isFavorite ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Main emoji + title */}
        <View style={styles.titleRow}>
          <Text style={styles.memoryEmoji}>{memory.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{memory.title}</Text>
            <Text style={styles.date}>{formatDate(memory.date)}</Text>
          </View>
          {memory.isPinned && <Text style={styles.pinned}>📌</Text>}
        </View>

        {/* Description */}
        {memory.description ? (
          <Text style={styles.description}>{memory.description}</Text>
        ) : null}

        {/* Location */}
        {memory.location ? (
          <View style={styles.locationRow}>
            <Text style={styles.locationText}>📍 {memory.location}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: '❤️ Favorites', value: 'favorites' },
  { label: '📌 Pinned', value: 'pinned' },
  { label: '🤝 Connections', value: 'first_connection' },
  { label: '📍 Meetups', value: 'meetup_done' },
  { label: '🔥 Streaks', value: 'streak_milestone' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ViewMemoriesScreen() {
  const navigation = useNavigation();
  const { firebaseUser } = useAuthStore();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const data = await getMemories(firebaseUser.uid);
      // Sort: pinned first, then by date desc
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
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isFavorite: !current } : m)),
      );
    } catch {
      Alert.alert('Error', 'Could not update memory.');
    }
  }

  const filtered = memories.filter((m) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'favorites') return m.isFavorite;
    if (activeFilter === 'pinned') return m.isPinned;
    return m.type === activeFilter;
  });

  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Memories</Text>
          <Text style={styles.headerSub}>{memories.length} moments</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter tabs */}
      <FlatList
        data={FILTERS}
        horizontal
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === item.value && styles.filterChipActive]}
            onPress={() => setActiveFilter(item.value)}
          >
            <Text style={[styles.filterText, activeFilter === item.value && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        style={styles.filterRow}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              emoji="🌌"
              title="No memories yet"
              subtitle="As you connect, meet people, and hit streaks — Drift builds your story here."
            />
          }
          renderItem={({ item }) => (
            <MemoryCard memory={item} onToggleFavorite={handleToggleFavorite} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
  },
  backText: { fontSize: 20, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text, textAlign: 'center' },
  headerSub: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },

  filterRow: { borderBottomWidth: 1, borderBottomColor: colors.border },
  filterList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.caption, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.background, fontWeight: '600' },

  list: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Card with timeline line
  card: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  dot: {
    width: 12, height: 12,
    borderRadius: 6,
    marginTop: spacing.md,
    marginRight: spacing.md,
    flexShrink: 0,
    zIndex: 1,
  },
  dotLine: {
    position: 'absolute',
    left: 5,
    top: spacing.md + 14,
    bottom: -spacing.lg,
    width: 2,
    backgroundColor: colors.border,
  },
  cardContent: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  typeEmoji: { fontSize: 11 },
  typeLabel: { ...typography.small, fontWeight: '600', fontSize: 11 },
  favoriteBtn: { fontSize: 18 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  memoryEmoji: { fontSize: 28, marginTop: -2 },
  title: { ...typography.body, fontWeight: '700', color: colors.text, flex: 1 },
  date: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  pinned: { fontSize: 14 },

  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  locationRow: { marginTop: spacing.sm },
  locationText: { ...typography.caption, color: colors.textSecondary },
});
