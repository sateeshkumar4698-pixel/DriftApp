import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEventStore } from '../../store/eventStore';
import { getEvents } from '../../utils/firestore-helpers';
import { formatDate } from '../../utils/helpers';
import { colors, spacing, radius } from '../../utils/theme';
import { Event, EventsStackParamList } from '../../types';

// ─── Dark design tokens ────────────────────────────────────────────────────────
const D = {
  bg:      '#0D0D1A',
  card:    '#15152A',
  border:  '#2A2A4A',
  text:    '#FFFFFF',
  sub:     '#8888BB',
  muted:   '#555580',
  pink:    '#FF4B6E',
  purple:  '#6C5CE7',
  cyan:    '#00D2FF',
  gold:    '#FFD700',
  green:   '#00E676',
};

const CATEGORY_CONFIG: Record<string, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
  label: string;
}> = {
  social:       { icon: 'people-outline',     grad: ['#FF4B6E', '#C2185B'],  label: 'Social'       },
  professional: { icon: 'briefcase-outline',  grad: ['#6C5CE7', '#4834D4'],  label: 'Professional' },
  sports:       { icon: 'football-outline',   grad: ['#00D2FF', '#0077FF'],  label: 'Sports'       },
  food:         { icon: 'restaurant-outline', grad: ['#FFD700', '#FF8C00'],  label: 'Food'         },
  other:        { icon: 'bookmark-outline',   grad: ['#00E676', '#00BCD4'],  label: 'Other'        },
};

export default function EventsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const { events, setEvents } = useEventStore();
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    setLoading(true);
    try { const data = await getEvents(); setEvents(data); }
    catch { Alert.alert('Error', 'Failed to load events.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEvents(); }, []);

  function EventCard({ item }: { item: Event }) {
    const cfg   = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.other;
    const full  = item.maxAttendees != null && item.attendees.length >= item.maxAttendees;
    const pct   = item.maxAttendees ? item.attendees.length / item.maxAttendees : 0;
    const soon  = item.date - Date.now() < 24 * 3600 * 1000 && item.date > Date.now();

    return (
      <TouchableOpacity
        style={sc.card}
        onPress={() => navigation.navigate('EventDetail', { event: item })}
        activeOpacity={0.82}
      >
        {/* Category stripe */}
        <LinearGradient colors={cfg.grad} style={sc.cardStripe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />

        <View style={sc.cardBody}>
          {/* Top row */}
          <View style={sc.cardTop}>
            <LinearGradient colors={cfg.grad} style={sc.categoryBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name={cfg.icon} size={14} color="#fff" />
              <Text style={sc.categoryLabel}>{cfg.label}</Text>
            </LinearGradient>
            <View style={sc.tagRow}>
              {soon && (
                <View style={sc.soonBadge}>
                  <Ionicons name="flash" size={10} color={D.gold} />
                  <Text style={sc.soonText}>Soon</Text>
                </View>
              )}
              {full && (
                <View style={sc.fullBadge}>
                  <Text style={sc.fullText}>Full</Text>
                </View>
              )}
            </View>
          </View>

          {/* Title */}
          <Text style={sc.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={sc.cardDesc} numberOfLines={2}>{item.description}</Text>

          {/* Meta row */}
          <View style={sc.metaRow}>
            <View style={sc.metaItem}>
              <Ionicons name="calendar-outline" size={12} color={D.sub} />
              <Text style={sc.metaText}>{formatDate(item.date)}</Text>
            </View>
            <View style={sc.metaItem}>
              <Ionicons name="location-outline" size={12} color={D.sub} />
              <Text style={sc.metaText} numberOfLines={1}>{item.location}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={sc.cardFooter}>
            <View style={sc.hostRow}>
              <Ionicons name="person-circle-outline" size={13} color={D.muted} />
              <Text style={sc.hostText}>{item.hostName}</Text>
            </View>
            <View style={sc.attendeeInfo}>
              {item.maxAttendees ? (
                <>
                  <View style={sc.miniBarBg}>
                    <LinearGradient
                      colors={full ? ['#EF4444', '#C62828'] : cfg.grad}
                      style={[sc.miniBarFill, { width: `${Math.min(pct * 100, 100)}%` as any }]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    />
                  </View>
                  <Text style={sc.attendeeText}>{item.attendees.length}/{item.maxAttendees}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="people-outline" size={12} color={D.sub} />
                  <Text style={sc.attendeeText}>{item.attendees.length} going</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={sc.root}>
      <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={sc.flex}>

        {/* Header */}
        <LinearGradient colors={['#1A0A2E', '#0D1744', '#0A1628']} style={sc.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View>
            <Text style={sc.headerTitle}>Events</Text>
            <Text style={sc.headerSub}>{events.length} happening near you</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} activeOpacity={0.8}>
            <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.hostBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={sc.hostBtnText}>Host</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {loading ? (
          <View style={sc.center}>
            <ActivityIndicator size="large" color={D.pink} />
            <Text style={sc.loadingText}>Loading events...</Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            contentContainerStyle={events.length === 0 ? sc.emptyContainer : sc.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            ListEmptyComponent={
              <View style={sc.emptyWrap}>
                <LinearGradient colors={['#FF4B6E22', '#6C5CE722']} style={sc.emptyIcon}>
                  <Ionicons name="calendar-outline" size={40} color={D.pink} />
                </LinearGradient>
                <Text style={sc.emptyTitle}>No events yet</Text>
                <Text style={sc.emptySub}>Be the first to host one!</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} activeOpacity={0.8}>
                  <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.emptyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
                    <Text style={sc.emptyBtnText}>Host an Event</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => <EventCard item={item} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const sc = StyleSheet.create({
  root:    { flex: 1, backgroundColor: D.bg },
  flex:    { flex: 1 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontSize: 13, color: D.sub },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#ffffff10',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: D.sub, marginTop: 2 },
  hostBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.full },
  hostBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  list:           { padding: spacing.lg, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: spacing.lg },

  // Event card
  card: {
    flexDirection: 'row',
    backgroundColor: D.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: D.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  cardStripe: { width: 4 },
  cardBody:   { flex: 1, padding: spacing.md },

  cardTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  tagRow:        { flexDirection: 'row', gap: 5 },
  soonBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFD70022', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: '#FFD70044' },
  soonText:      { fontSize: 10, fontWeight: '700', color: D.gold },
  fullBadge:     { backgroundColor: '#EF444422', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: '#EF444444' },
  fullText:      { fontSize: 10, fontWeight: '700', color: '#EF4444' },

  cardTitle: { fontSize: 16, fontWeight: '700', color: D.text, marginBottom: 4 },
  cardDesc:  { fontSize: 12, color: D.sub, lineHeight: 18, marginBottom: 10 },

  metaRow:  { flexDirection: 'row', gap: spacing.md, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 11, color: D.sub, flex: 1 },

  cardFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hostRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hostText:     { fontSize: 11, color: D.muted },
  attendeeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniBarBg:    { width: 48, height: 4, backgroundColor: '#ffffff15', borderRadius: 2, overflow: 'hidden' },
  miniBarFill:  { height: 4, borderRadius: 2 },
  attendeeText: { fontSize: 11, color: D.sub, fontWeight: '600' },

  // Empty state
  emptyWrap:  { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: D.text },
  emptySub:   { fontSize: 13, color: D.sub },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.full, marginTop: spacing.sm },
  emptyBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
});
