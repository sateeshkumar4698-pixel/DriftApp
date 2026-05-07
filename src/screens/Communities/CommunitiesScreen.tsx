import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  getCommunities,
  getJoinedCommunityIds,
} from '../../utils/firestore-helpers';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius, shadows } from '../../utils/theme';
import { Community, CommunityCategory, FeedStackParamList } from '../../types';
import EmptyState from '../../components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<FeedStackParamList>;

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<CommunityCategory, { label: string; emoji: string; color: string; color2: string }> = {
  culture_caste:  { label: 'Culture & Caste',   emoji: '🏘️', color: '#FF6B6B', color2: '#FF8E53' },
  lgbtq:          { label: 'LGBTQ+',            emoji: '🌈', color: '#A855F7', color2: '#EC4899' },
  startups:       { label: 'Startups',           emoji: '🚀', color: '#3B82F6', color2: '#06B6D4' },
  employment:     { label: 'Jobs & Employment',  emoji: '💼', color: '#10B981', color2: '#059669' },
  education:      { label: 'Education',          emoji: '📚', color: '#F59E0B', color2: '#EF4444' },
  students:       { label: 'Students',           emoji: '🎓', color: '#8B5CF6', color2: '#7C3AED' },
  politics:       { label: 'Politics',           emoji: '🗳️', color: '#EF4444', color2: '#DC2626' },
  gossip:         { label: 'Gossip & Drama',     emoji: '🗣️', color: '#F97316', color2: '#EF4444' },
  gaming:         { label: 'Gaming',             emoji: '🎮', color: '#6366F1', color2: '#4F46E5' },
  fitness:        { label: 'Fitness',            emoji: '💪', color: '#22C55E', color2: '#16A34A' },
  music_arts:     { label: 'Music & Arts',       emoji: '🎵', color: '#EC4899', color2: '#BE185D' },
  tech:           { label: 'Tech & Coding',      emoji: '💻', color: '#0EA5E9', color2: '#0284C7' },
  relationships:  { label: 'Relationships',      emoji: '❤️', color: '#FF4B6E', color2: '#E11D48' },
  travel:         { label: 'Travel',             emoji: '🌍', color: '#10B981', color2: '#0891B2' },
  food_lifestyle: { label: 'Food & Lifestyle',   emoji: '🍕', color: '#F59E0B', color2: '#D97706' },
  general:        { label: 'General',            emoji: '💬', color: '#6B7280', color2: '#4B5563' },
};

const CATEGORY_FILTERS: Array<{ key: CommunityCategory | 'all'; label: string; emoji: string }> = [
  { key: 'all', label: 'All', emoji: '✨' },
  ...Object.entries(CATEGORY_META).map(([k, v]) => ({
    key: k as CommunityCategory,
    label: v.label,
    emoji: v.emoji,
  })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMemberCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function joinedToday(community: Community): number {
  // Simulate "joined today" social proof — use memberCount as seed for small variety
  return Math.max(1, Math.floor((community.memberCount % 47) + 3));
}

// ─── Community Card ───────────────────────────────────────────────────────────

function CommunityCard({
  community,
  isJoined,
  onPress,
}: {
  community: Community;
  isJoined: boolean;
  onPress: () => void;
}) {
  const { C } = useTheme();
  const meta = CATEGORY_META[community.category];
  const c1 = community.coverColor || meta.color;
  const c2 = community.coverColor2 || meta.color2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={styles.cardShadow}
    >
      <LinearGradient
        colors={[c1, c2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Top row: icon + badges */}
        <View style={styles.cardTop}>
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIcon}>{community.iconEmoji}</Text>
          </View>
          <View style={styles.cardBadges}>
            {isJoined && (
              <View style={styles.joinedBadge}>
                <Ionicons name="checkmark" size={10} color="#fff" />
                <Text style={styles.joinedBadgeText}>Joined</Text>
              </View>
            )}
            {community.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#fff" />
              </View>
            )}
            {community.communityType !== 'open' && (
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={10} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* Community name */}
        <Text style={styles.cardName} numberOfLines={2}>{community.name}</Text>

        {/* Category badge */}
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeEmoji}>{meta.emoji}</Text>
          <Text style={styles.catBadgeLabel} numberOfLines={1}>{meta.label}</Text>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.memberRow}>
            <Ionicons name="people" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.memberCount}>
              {formatMemberCount(community.memberCount)} members
            </Text>
          </View>
          <Text style={styles.socialProof}>
            +{joinedToday(community)} today
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunitiesScreen() {
  const { C, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const { firebaseUser } = useAuthStore();
  const uid = firebaseUser?.uid ?? '';

  const [communities, setCommunities] = useState<Community[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommunityCategory | 'all'>('all');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  // ── Load data ──
  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [all, ids] = await Promise.all([
        getCommunities(),
        uid ? getJoinedCommunityIds(uid) : Promise.resolve([]),
      ]);
      // Sort by memberCount descending
      setCommunities([...all].sort((a, b) => b.memberCount - a.memberCount));
      setJoinedIds(ids);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(true); }, [uid]));

  // ── Search animation ──
  function onSearchFocus() {
    setSearchFocused(true);
    Animated.timing(searchAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }
  function onSearchBlur() {
    setSearchFocused(false);
    Animated.timing(searchAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  // ── FAB animation ──
  function onFabPressIn() {
    Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, speed: 40 }).start();
  }
  function onFabPressOut() {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  }

  // ── Derived data ──
  const joinedCommunities = communities.filter((c) => joinedIds.includes(c.id));

  const filteredCommunities = communities.filter((c) => {
    const matchCat = activeCategory === 'all' || c.category === activeCategory;
    const q = searchText.trim().toLowerCase();
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      CATEGORY_META[c.category].label.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const trendingCommunities = filteredCommunities.slice(0, 20);

  const borderColor = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.primary],
  });

  const sc = makeStyles(C, isDark);

  // ── Render category chip ──
  const renderCategoryChip = ({ item }: { item: typeof CATEGORY_FILTERS[0] }) => {
    const isActive = activeCategory === item.key;
    return (
      <TouchableOpacity
        onPress={() => setActiveCategory(item.key)}
        activeOpacity={0.8}
        style={[sc.filterChip, isActive && sc.filterChipActive]}
      >
        <Text style={sc.filterEmoji}>{item.emoji}</Text>
        <Text style={[sc.filterText, isActive && sc.filterTextActive]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  // ── Render community card ──
  const renderCommunity = ({ item }: { item: Community }) => (
    <CommunityCard
      community={item}
      isJoined={joinedIds.includes(item.id)}
      onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
    />
  );

  return (
    <SafeAreaView style={[sc.root]} edges={['top']}>
      {isDark && (
        <LinearGradient
          colors={['#0D0D1A', '#0A0A1F']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── Header ── */}
      <View style={sc.header}>
        <View>
          <Text style={sc.headerTitle}>Communities</Text>
          <Text style={sc.headerSub}>
            {communities.length > 0
              ? `${communities.length} communities, ${joinedIds.length} joined`
              : 'Find your tribe'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateCommunity')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FF4B6E', '#C2185B']}
            style={sc.createBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={sc.createBtnText}>Create</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={sc.searchRow}>
        <Animated.View style={[sc.searchBox, { borderColor }]}>
          <Ionicons name="search-outline" size={16} color={C.textSecondary} />
          <TextInput
            style={sc.searchInput}
            placeholder="Search communities..."
            placeholderTextColor={C.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* ── Category filters ── */}
      <FlatList
        data={CATEGORY_FILTERS}
        horizontal
        keyExtractor={(item) => item.key}
        renderItem={renderCategoryChip}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sc.filterList}
        style={sc.filterBar}
      />

      {/* ── Content ── */}
      {loading ? (
        <View style={sc.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={sc.loadingText}>Loading communities...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCommunities.length > 0 || searchText || activeCategory !== 'all' ? filteredCommunities : undefined}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sc.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ListHeaderComponent={() => (
            <>
              {/* Your communities */}
              {joinedCommunities.length > 0 && !searchText && activeCategory === 'all' && (
                <View style={sc.section}>
                  <View style={sc.sectionHeader}>
                    <Text style={sc.sectionTitle}>Your Communities</Text>
                    <View style={sc.sectionBadge}>
                      <Text style={sc.sectionBadgeText}>{joinedCommunities.length}</Text>
                    </View>
                  </View>
                  <FlatList
                    data={joinedCommunities}
                    horizontal
                    keyExtractor={(c) => c.id}
                    renderItem={({ item }) => (
                      <View style={{ width: 180, marginRight: spacing.sm }}>
                        <CommunityCard
                          community={item}
                          isJoined
                          onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}
                        />
                      </View>
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: spacing.md }}
                  />
                </View>
              )}

              {/* Trending header */}
              {trendingCommunities.length > 0 && (
                <View style={sc.sectionHeader}>
                  <Text style={sc.sectionTitle}>
                    {searchText || activeCategory !== 'all' ? 'Results' : 'Trending Now'}
                  </Text>
                  {!searchText && activeCategory === 'all' && (
                    <View style={sc.sectionBadge}>
                      <Text style={sc.sectionBadgeText}>{trendingCommunities.length}</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="🏘️"
              title={searchText ? 'No communities found' : 'No communities yet'}
              subtitle={
                searchText
                  ? 'Try a different search term'
                  : 'Be the first to create one!'
              }
            >
              {!searchText && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('CreateCommunity')}
                  activeOpacity={0.8}
                  style={{ marginTop: spacing.md }}
                >
                  <LinearGradient
                    colors={['#FF4B6E', '#C2185B']}
                    style={sc.emptyBtn}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
                    <Text style={sc.emptyBtnText}>Create Community</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </EmptyState>
          }
          numColumns={2}
          columnWrapperStyle={sc.gridRow}
          renderItem={({ item }) => (
            <View style={sc.gridCell}>
              {renderCommunity({ item })}
            </View>
          )}
        />
      )}

      {/* ── FAB ── */}
      <Animated.View style={[sc.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          onPress={() => navigation.navigate('CreateCommunity')}
          activeOpacity={1}
        >
          <LinearGradient
            colors={['#FF4B6E', '#6C5CE7']}
            style={sc.fabGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Card shadow wrapper styles (static, no theme dependency) ─────────────────

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: radius.lg,
    ...shadows.card,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 170,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 26,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  joinedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    flex: 1,
    marginBottom: spacing.xs,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  catBadgeEmoji: {
    fontSize: 10,
  },
  catBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    maxWidth: 100,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  socialProof: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
});

// ─── Dynamic styles ───────────────────────────────────────────────────────────

function makeStyles(C: AppColors, isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: C.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      fontSize: 13,
      color: C.textSecondary,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: isDark ? 'transparent' : C.background,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 12,
      color: C.textSecondary,
      marginTop: 2,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: radius.full,
    },
    createBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },

    // Search
    searchRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: isDark ? 'transparent' : C.background,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: C.inputBg,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      height: 42,
      borderWidth: 1.5,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: C.text,
    },

    // Filters
    filterBar: {
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      backgroundColor: isDark ? 'transparent' : C.background,
    },
    filterList: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: radius.full,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    filterChipActive: {
      backgroundColor: C.primary + '18',
      borderColor: C.primary,
    },
    filterEmoji: {
      fontSize: 13,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textSecondary,
    },
    filterTextActive: {
      color: C.primary,
    },

    // List
    listContent: {
      paddingTop: spacing.md,
      paddingBottom: 120,
      paddingHorizontal: spacing.md,
    },
    gridRow: {
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    gridCell: {
      flex: 1,
    },

    // Sections
    section: {
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.3,
    },
    sectionBadge: {
      backgroundColor: C.primary + '20',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    sectionBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: C.primary,
    },

    // Empty state
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: radius.full,
    },
    emptyBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.lg,
    },
    fabGrad: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.modal,
    },
  });
}
