import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView,
  TextInput, Animated, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { getEvents, getMyHostedEvents, getMyAttendingEvents } from '../../utils/firestore-helpers';
import { formatDate } from '../../utils/helpers';
import { spacing, radius, shadows } from '../../utils/theme';
import { Event, EventsStackParamList } from '../../types';
import { useTheme, AppColors } from '../../utils/useTheme';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
  label: string;
  emoji: string;
}> = {
  social:       { icon: 'people-outline',     grad: ['#FF4B6E', '#C2185B'], label: 'Social',       emoji: '🎉' },
  professional: { icon: 'briefcase-outline',  grad: ['#6C5CE7', '#4834D4'], label: 'Professional', emoji: '💼' },
  sports:       { icon: 'football-outline',   grad: ['#00D2FF', '#0077FF'], label: 'Sports',       emoji: '⚽' },
  food:         { icon: 'restaurant-outline', grad: ['#FFD700', '#FF8C00'], label: 'Food',         emoji: '🍽️' },
  other:        { icon: 'bookmark-outline',   grad: ['#00E676', '#00BCD4'], label: 'Other',        emoji: '✨' },
};

const FILTERS = ['All', 'Social', 'Professional', 'Sports', 'Food', 'Other'] as const;
type FilterType = typeof FILTERS[number];
type MainTab = 'discover' | 'mine';
type MineTab = 'hosting' | 'attending';

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  item,
  uid,
  onPress,
}: {
  item: Event;
  uid: string;
  onPress: () => void;
}) {
  const { C } = useTheme();
  const sc = makeCardStyles(C);
  const cfg    = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.other;
  const full   = item.maxAttendees != null && item.attendees.length >= item.maxAttendees;
  const pct    = item.maxAttendees ? item.attendees.length / item.maxAttendees : 0;
  const now    = Date.now();
  const soon   = item.date - now < 24 * 3600 * 1000 && item.date > now;
  const past   = item.date < now;
  const isHost = item.hostId === uid;
  const going  = item.attendees.includes(uid);

  return (
    <TouchableOpacity style={[sc.card, past && sc.cardPast, item.cancelled && sc.cardCancelled]} onPress={onPress} activeOpacity={0.82}>
      {/* Left gradient stripe */}
      <LinearGradient
        colors={item.cancelled ? ['#6B7280', '#9CA3AF'] : cfg.grad}
        style={sc.stripe}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />

      <View style={sc.body}>
        {/* Top row — badges */}
        <View style={sc.topRow}>
          <LinearGradient
            colors={item.cancelled ? ['#6B728040', '#9CA3AF40'] : [cfg.grad[0] + '20', cfg.grad[1] + '20']}
            style={sc.catBadge}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={sc.catEmoji}>{cfg.emoji}</Text>
            <Text style={[sc.catLabel, item.cancelled && sc.mutedText]}>{cfg.label}</Text>
          </LinearGradient>

          <View style={sc.badgeRow}>
            {item.cancelled && (
              <View style={sc.cancelBadge}>
                <Text style={sc.cancelText}>Cancelled</Text>
              </View>
            )}
            {!item.cancelled && past && (
              <View style={sc.pastBadge}>
                <Text style={sc.pastText}>Past</Text>
              </View>
            )}
            {!item.cancelled && soon && (
              <View style={sc.soonBadge}>
                <Ionicons name="flash" size={10} color={C.gold} />
                <Text style={sc.soonText}>Soon</Text>
              </View>
            )}
            {!item.cancelled && full && !past && (
              <View style={sc.fullBadge}>
                <Text style={sc.fullText}>Full</Text>
              </View>
            )}
            {isHost && (
              <View style={sc.hostBadge}>
                <Ionicons name="star" size={9} color={C.gold} />
                <Text style={sc.hostBadgeText}>Host</Text>
              </View>
            )}
            {going && !isHost && (
              <View style={sc.goingBadge}>
                <Ionicons name="checkmark" size={9} color={C.success} />
                <Text style={sc.goingText}>Going</Text>
              </View>
            )}
          </View>
        </View>

        {/* Title + description */}
        <Text style={[sc.title, (past || item.cancelled) && sc.mutedText]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={sc.desc} numberOfLines={2}>{item.description}</Text>

        {/* Tags */}
        {(item.tags ?? []).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sc.tagsScroll}>
            {(item.tags ?? []).map((tag) => (
              <View key={tag} style={sc.tag}>
                <Text style={sc.tagText}>#{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Meta row */}
        <View style={sc.metaRow}>
          <View style={sc.metaItem}>
            <Ionicons name="calendar-outline" size={11} color={C.textSecondary} />
            <Text style={sc.metaText}>{formatDate(item.date)}</Text>
          </View>
          <View style={sc.metaItem}>
            <Ionicons name="location-outline" size={11} color={C.textSecondary} />
            <Text style={sc.metaText} numberOfLines={1}>{item.location}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={sc.footer}>
          <View style={sc.hostRow}>
            <Ionicons name="person-circle-outline" size={12} color={C.textTertiary} />
            <Text style={sc.hostText}>{item.hostName}</Text>
          </View>
          <View style={sc.attendeeInfo}>
            {item.maxAttendees ? (
              <>
                <View style={sc.miniBarBg}>
                  <LinearGradient
                    colors={full ? ['#EF4444', '#C62828'] : cfg.grad}
                    style={[sc.miniBarFill, { width: `${Math.min(pct * 100, 100)}%` as `${number}%` }]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  />
                </View>
                <Text style={sc.attendeeText}>{item.attendees.length}/{item.maxAttendees}</Text>
              </>
            ) : (
              <>
                <Ionicons name="people-outline" size={11} color={C.textSecondary} />
                <Text style={sc.attendeeText}>{item.attendees.length} going</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeCardStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      ...shadows.card,
    },
    cardPast:      { opacity: 0.75 },
    cardCancelled: { opacity: 0.6 },
    stripe:        { width: 4 },
    body:          { flex: 1, padding: spacing.md },

    topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    catBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
    catEmoji:{ fontSize: 12 },
    catLabel:{ fontSize: 11, fontWeight: '700', color: C.text },
    mutedText:{ color: C.textSecondary },

    badgeRow:     { flexDirection: 'row', gap: 4, alignItems: 'center' },
    cancelBadge:  { backgroundColor: C.error + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: C.error + '40' },
    cancelText:   { fontSize: 10, fontWeight: '700', color: C.error },
    pastBadge:    { backgroundColor: C.textSecondary + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
    pastText:     { fontSize: 10, fontWeight: '600', color: C.textSecondary },
    soonBadge:    { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.gold + '22', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: C.gold + '44' },
    soonText:     { fontSize: 10, fontWeight: '700', color: C.gold },
    fullBadge:    { backgroundColor: C.error + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: C.error + '40' },
    fullText:     { fontSize: 10, fontWeight: '700', color: C.error },
    hostBadge:    { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.gold + '22', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
    hostBadgeText:{ fontSize: 10, fontWeight: '700', color: C.gold },
    goingBadge:   { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.success + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full },
    goingText:    { fontSize: 10, fontWeight: '700', color: C.success },

    title:  { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
    desc:   { fontSize: 12, color: C.textSecondary, lineHeight: 18, marginBottom: 8 },

    tagsScroll: { marginBottom: 6 },
    tag:        { backgroundColor: C.secondary + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, marginRight: 4 },
    tagText:    { fontSize: 10, fontWeight: '600', color: C.secondary },

    metaRow:  { flexDirection: 'row', gap: spacing.md, marginBottom: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
    metaText: { fontSize: 11, color: C.textSecondary, flex: 1 },

    footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hostRow:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
    hostText:     { fontSize: 11, color: C.textTertiary },
    attendeeInfo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    miniBarBg:    { width: 48, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
    miniBarFill:  { height: 4, borderRadius: 2 },
    attendeeText: { fontSize: 11, color: C.textSecondary, fontWeight: '600' },
  });
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionLabel({ title, count, C }: { title: string; count: number; C: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: C.background }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ backgroundColor: C.primary + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary }}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<EventsStackParamList>;

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { firebaseUser } = useAuthStore();
  const { events, setEvents } = useEventStore();
  const { C, isDark } = useTheme();
  const sc = makeStyles(C);
  const uid = firebaseUser?.uid ?? '';

  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [activeFilter,   setActiveFilter]   = useState<FilterType>('All');
  const [mainTab,        setMainTab]        = useState<MainTab>('discover');
  const [mineTab,        setMineTab]        = useState<MineTab>('hosting');
  const [myHosted,       setMyHosted]       = useState<Event[]>([]);
  const [myAttending,    setMyAttending]    = useState<Event[]>([]);
  const [mineLoading,    setMineLoading]    = useState(false);
  const [searchText,     setSearchText]     = useState('');
  const [searchFocused,  setSearchFocused]  = useState(false);

  const searchAnim = useRef(new Animated.Value(0)).current;

  // ── Load all public events ──
  async function loadEvents(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch {
      Alert.alert('Error', 'Failed to load events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ── Load my events ──
  async function loadMyEvents() {
    if (!uid) return;
    setMineLoading(true);
    try {
      const [hosted, attending] = await Promise.all([
        getMyHostedEvents(uid),
        getMyAttendingEvents(uid),
      ]);
      setMyHosted(hosted);
      // Attending includes hosted — remove duplicates
      setMyAttending(attending.filter((e) => e.hostId !== uid));
    } catch {
      // non-critical
    } finally {
      setMineLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    loadEvents(true);
    loadMyEvents();
  }, [uid]));

  // ── Search focus animation ──
  function onSearchFocus() {
    setSearchFocused(true);
    Animated.timing(searchAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }
  function onSearchBlur() {
    setSearchFocused(false);
    Animated.timing(searchAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  // ── Filtered discover events ──
  const now = Date.now();
  const filteredEvents = events.filter((e) => {
    if (activeFilter !== 'All' && e.category.toLowerCase() !== activeFilter.toLowerCase()) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Sort: upcoming first, then past
  const upcoming = filteredEvents.filter((e) => !e.cancelled && e.date >= now);
  const past     = filteredEvents.filter((e) => !e.cancelled && e.date < now);
  const cancelled = filteredEvents.filter((e) => e.cancelled);

  const discoverSections = [
    ...(upcoming.length > 0  ? [{ title: 'Upcoming',  count: upcoming.length,  data: upcoming }]  : []),
    ...(past.length > 0      ? [{ title: 'Past',       count: past.length,      data: past }]      : []),
    ...(cancelled.length > 0 ? [{ title: 'Cancelled',  count: cancelled.length, data: cancelled }] : []),
  ];

  // ── My events ──
  const mineData = mineTab === 'hosting' ? myHosted : myAttending;
  const mineUpcoming = mineData.filter((e) => !e.cancelled && e.date >= now);
  const minePast     = mineData.filter((e) => !e.cancelled && e.date < now);
  const mineCancelled= mineData.filter((e) => e.cancelled);

  const mineSections = [
    ...(mineUpcoming.length > 0  ? [{ title: 'Upcoming', count: mineUpcoming.length,  data: mineUpcoming }]  : []),
    ...(minePast.length > 0      ? [{ title: 'Past',      count: minePast.length,      data: minePast }]      : []),
    ...(mineCancelled.length > 0 ? [{ title: 'Cancelled', count: mineCancelled.length, data: mineCancelled }] : []),
  ];

  const borderColor = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.primary] });

  // ── Render ──
  return (
    <View style={sc.root}>
      <SafeAreaView style={sc.flex} edges={['top']}>

        {/* ── Header ── */}
        <View style={sc.header}>
          <View>
            <Text style={sc.headerTitle}>Events</Text>
            <Text style={sc.headerSub}>
              {mainTab === 'discover' ? `${upcoming.length} upcoming near you` : `${mineData.length} events`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} activeOpacity={0.8}>
            <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.hostBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={sc.hostBtnText}>Host</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Main tab switcher ── */}
        <View style={sc.mainTabRow}>
          {(['discover', 'mine'] as MainTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[sc.mainTab, mainTab === tab && sc.mainTabActive]}
              onPress={() => setMainTab(tab)}
            >
              <Ionicons
                name={tab === 'discover' ? 'compass-outline' : 'person-outline'}
                size={15}
                color={mainTab === tab ? C.primary : C.textSecondary}
              />
              <Text style={[sc.mainTabText, mainTab === tab && sc.mainTabTextActive]}>
                {tab === 'discover' ? 'Discover' : 'My Events'}
              </Text>
              {tab === 'mine' && (myHosted.length + myAttending.length) > 0 && (
                <View style={sc.tabBadge}>
                  <Text style={sc.tabBadgeText}>{myHosted.length + myAttending.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {mainTab === 'discover' ? (
          <>
            {/* ── Search bar ── */}
            <View style={sc.searchRow}>
              <Animated.View style={[sc.searchBox, { borderColor }]}>
                <Ionicons name="search-outline" size={16} color={C.textSecondary} />
                <TextInput
                  style={sc.searchInput}
                  placeholder="Search events, locations..."
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

            {/* ── Category filter chips ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sc.filterList}
              style={sc.filterBar}
            >
              {FILTERS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveFilter(cat)}
                  activeOpacity={0.8}
                  style={[sc.filterChip, activeFilter === cat && sc.filterChipActive]}
                >
                  {cat !== 'All' && (
                    <Text style={sc.filterEmoji}>{CATEGORY_CONFIG[cat.toLowerCase()]?.emoji}</Text>
                  )}
                  <Text style={[sc.filterText, activeFilter === cat && sc.filterTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Event list ── */}
            {loading ? (
              <View style={sc.center}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={sc.loadingText}>Loading events...</Text>
              </View>
            ) : discoverSections.length === 0 ? (
              <View style={sc.emptyWrap}>
                <LinearGradient colors={[C.primary + '22', C.secondary + '22']} style={sc.emptyIcon}>
                  <Ionicons name="calendar-outline" size={40} color={C.primary} />
                </LinearGradient>
                <Text style={sc.emptyTitle}>
                  {searchText ? 'No results found' : 'No events yet'}
                </Text>
                <Text style={sc.emptySub}>
                  {searchText ? `Try a different search term` : 'Be the first to host one!'}
                </Text>
                {!searchText && (
                  <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} activeOpacity={0.8}>
                    <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={sc.emptyBtnText}>Host an Event</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <SectionList
                sections={discoverSections}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={sc.list}
                stickySectionHeadersEnabled={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); loadEvents(true); loadMyEvents(); }}
                    tintColor={C.primary}
                    colors={[C.primary]}
                  />
                }
                renderSectionHeader={({ section }) => (
                  <SectionLabel title={section.title} count={section.count} C={C} />
                )}
                ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                renderItem={({ item }) => (
                  <View style={sc.cardWrap}>
                    <EventCard
                      item={item}
                      uid={uid}
                      onPress={() => navigation.navigate('EventDetail', { event: item })}
                    />
                  </View>
                )}
              />
            )}
          </>
        ) : (
          <>
            {/* ── My Events sub-tab ── */}
            <View style={sc.mineTabRow}>
              {(['hosting', 'attending'] as MineTab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[sc.mineTab, mineTab === tab && sc.mineTabActive]}
                  onPress={() => setMineTab(tab)}
                >
                  <Text style={[sc.mineTabText, mineTab === tab && sc.mineTabTextActive]}>
                    {tab === 'hosting' ? `Hosting (${myHosted.length})` : `Attending (${myAttending.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mineLoading ? (
              <View style={sc.center}>
                <ActivityIndicator size="large" color={C.primary} />
              </View>
            ) : mineSections.length === 0 ? (
              <View style={sc.emptyWrap}>
                <LinearGradient colors={[C.primary + '22', C.secondary + '22']} style={sc.emptyIcon}>
                  <Ionicons name={mineTab === 'hosting' ? 'mic-outline' : 'ticket-outline'} size={40} color={C.primary} />
                </LinearGradient>
                <Text style={sc.emptyTitle}>
                  {mineTab === 'hosting' ? "You haven't hosted yet" : "You're not attending any events"}
                </Text>
                <Text style={sc.emptySub}>
                  {mineTab === 'hosting' ? 'Create your first event!' : 'Browse and RSVP to events'}
                </Text>
                <TouchableOpacity
                  onPress={() => mineTab === 'hosting' ? navigation.navigate('CreateEvent') : setMainTab('discover')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={sc.emptyBtnText}>
                      {mineTab === 'hosting' ? 'Host an Event' : 'Browse Events'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <SectionList
                sections={mineSections}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={sc.list}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                  <SectionLabel title={section.title} count={section.count} C={C} />
                )}
                ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                renderItem={({ item }) => (
                  <View style={sc.cardWrap}>
                    <EventCard
                      item={item}
                      uid={uid}
                      onPress={() => navigation.navigate('EventDetail', { event: item })}
                    />
                  </View>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    loadingText: { fontSize: 13, color: C.textSecondary },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
    headerSub:   { fontSize: 12, color: C.textSecondary, marginTop: 2 },
    hostBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full },
    hostBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    mainTabRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      gap: spacing.sm,
      backgroundColor: C.background,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    mainTab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, paddingVertical: 8, borderRadius: radius.lg,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    mainTabActive: {
      backgroundColor: C.primary + '15', borderColor: C.primary,
    },
    mainTabText:       { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    mainTabTextActive: { color: C.primary, fontWeight: '700' },
    tabBadge:     { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 16, alignItems: 'center' },
    tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

    searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: C.background },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: C.inputBg, borderRadius: radius.lg,
      paddingHorizontal: spacing.md, height: 42,
      borderWidth: 1.5,
    },
    searchInput: { flex: 1, fontSize: 14, color: C.text },

    filterBar:  { backgroundColor: C.background, borderBottomWidth: 1, borderBottomColor: C.border },
    filterList: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
    filterChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: radius.full,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    filterChipActive: { backgroundColor: C.primary + '15', borderColor: C.primary },
    filterEmoji:      { fontSize: 12 },
    filterText:       { fontSize: 12, fontWeight: '600', color: C.textSecondary },
    filterTextActive: { color: C.primary },

    mineTabRow: {
      flexDirection: 'row', gap: spacing.sm,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      backgroundColor: C.background, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    mineTab:           { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: C.surface },
    mineTabActive:     { backgroundColor: C.primary + '15' },
    mineTabText:       { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    mineTabTextActive: { color: C.primary, fontWeight: '700' },

    list:    { paddingTop: spacing.xs, paddingBottom: 100 },
    cardWrap:{ paddingHorizontal: spacing.lg },

    emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
    emptyIcon:  { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
    emptySub:   { fontSize: 13, color: C.textSecondary, textAlign: 'center' },
    emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.full },
    emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}
