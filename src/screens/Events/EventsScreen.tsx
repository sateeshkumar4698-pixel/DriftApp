import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEventStore } from '../../store/eventStore';
import { getEvents } from '../../utils/firestore-helpers';
import { formatDate } from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { Event, EventsStackParamList } from '../../types';

const CATEGORY_EMOJI: Record<string, string> = {
  social: '🎉',
  professional: '💼',
  sports: '⚽',
  food: '🍕',
  other: '📌',
};

export default function EventsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const { events, setEvents } = useEventStore();
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch {
      Alert.alert('Error', 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(); }, []);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateEvent')}
        >
          <Text style={styles.createBtnText}>+ Host</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState emoji="📅" title="No events yet" subtitle="Be the first to host one!" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EventDetail', { event: item })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[item.category] ?? '📌'}</Text>
              <View style={styles.cardInfo}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.eventMeta}>{formatDate(item.date)} · {item.location}</Text>
              </View>
            </View>
            <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.hostText}>By {item.hostName}</Text>
              <Text style={styles.attendeesText}>
                👥 {item.attendees.length}{item.maxAttendees ? `/${item.maxAttendees}` : ''} attending
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={events.length === 0 ? { flex: 1 } : styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.heading, color: colors.text },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  createBtnText: { ...typography.caption, color: colors.background, fontWeight: '600' },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  categoryEmoji: { fontSize: 28 },
  cardInfo: { flex: 1 },
  eventTitle: { ...typography.body, fontWeight: '600', color: colors.text, marginBottom: 2 },
  eventMeta: { ...typography.caption, color: colors.textSecondary },
  eventDesc: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  hostText: { ...typography.small, color: colors.textSecondary },
  attendeesText: { ...typography.small, color: colors.secondary, fontWeight: '500' },
});
