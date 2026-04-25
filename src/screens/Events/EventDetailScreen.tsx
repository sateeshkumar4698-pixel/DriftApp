import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { rsvpEvent } from '../../utils/firestore-helpers';
import { formatDate } from '../../utils/helpers';
import Button from '../../components/Button';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { EventsStackParamList } from '../../types';

type RouteProps = RouteProp<EventsStackParamList, 'EventDetail'>;
type Nav = NativeStackNavigationProp<EventsStackParamList>;

const CATEGORY_EMOJI: Record<string, string> = {
  social: '🎉', professional: '💼', sports: '⚽', food: '🍕', other: '📌',
};

export default function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { event } = route.params;
  const { firebaseUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [attended, setAttended] = useState(
    firebaseUser ? event.attendees.includes(firebaseUser.uid) : false,
  );
  const [attendeeCount, setAttendeeCount] = useState(event.attendees.length);

  async function handleRsvp() {
    if (!firebaseUser) return;
    if (attended) { Alert.alert('Already RSVPd', "You're already attending this event!"); return; }
    if (event.maxAttendees && attendeeCount >= event.maxAttendees) {
      Alert.alert('Full', 'This event is at capacity.');
      return;
    }
    setLoading(true);
    try {
      await rsvpEvent(event.id, firebaseUser.uid);
      setAttended(true);
      setAttendeeCount((c) => c + 1);
    } catch {
      Alert.alert('Error', 'Failed to RSVP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>{CATEGORY_EMOJI[event.category] ?? '📌'}</Text>
        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>📅 Date</Text>
            <Text style={styles.metaValue}>{formatDate(event.date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>📍 Location</Text>
            <Text style={styles.metaValue}>{event.location}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>👤 Hosted by</Text>
            <Text style={styles.metaValue}>{event.hostName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>👥 Attending</Text>
            <Text style={styles.metaValue}>
              {attendeeCount}{event.maxAttendees ? `/${event.maxAttendees}` : ''} people
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this event</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{event.category}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={attended ? '✓ You\'re attending!' : 'RSVP to this Event'}
          onPress={handleRsvp}
          loading={loading}
          disabled={attended}
          variant={attended ? 'outline' : 'primary'}
        />
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => navigation.navigate('EventInvite', { event })}
        >
          <Text style={styles.inviteBtnText}>📨 Invite Friends</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backIcon: { fontSize: 22, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.lg },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  metaItem: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  metaLabel: { ...typography.small, color: colors.textSecondary, marginBottom: 4 },
  metaValue: { ...typography.caption, color: colors.text, fontWeight: '600' },
  section: { marginTop: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { ...typography.body, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 26 },
  categoryChip: {
    alignSelf: 'flex-start', backgroundColor: `${colors.secondary}15`,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg,
  },
  categoryText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  inviteBtn: {
    paddingVertical: spacing.sm, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.secondary,
    borderRadius: radius.lg,
  },
  inviteBtnText: { ...typography.body, color: colors.secondary, fontWeight: '600' },
});
