import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { rsvpEvent } from '../../utils/firestore-helpers';
import { formatDate } from '../../utils/helpers';
import { spacing, radius, shadows } from '../../utils/theme';
import { EventsStackParamList } from '../../types';

type RouteProps = RouteProp<EventsStackParamList, 'EventDetail'>;
type Nav        = NativeStackNavigationProp<EventsStackParamList>;

// ─── Dark tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:     '#0D0D1A',
  card:   '#15152A',
  border: '#2A2A4A',
  text:   '#FFFFFF',
  sub:    '#8888BB',
  muted:  '#555580',
  pink:   '#FF4B6E',
  purple: '#6C5CE7',
  cyan:   '#00D2FF',
  gold:   '#FFD700',
  green:  '#00E676',
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

export default function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteProps>();
  const { event }  = route.params;
  const { firebaseUser } = useAuthStore();

  const [rsvpLoading,  setRsvpLoading]  = useState(false);
  const [attended,     setAttended]     = useState(
    firebaseUser ? event.attendees.includes(firebaseUser.uid) : false,
  );
  const [attendeeCount, setAttendeeCount] = useState(event.attendees.length);

  const cfg  = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.other;
  const full = event.maxAttendees != null && attendeeCount >= event.maxAttendees;
  const pct  = event.maxAttendees ? attendeeCount / event.maxAttendees : 0;
  const isHost = firebaseUser?.uid === event.hostId;

  async function handleRsvp() {
    if (!firebaseUser) return;
    if (attended)  { Alert.alert('Already RSVPd', "You're already attending!"); return; }
    if (full)      { Alert.alert('Full', 'This event is at capacity.'); return; }
    setRsvpLoading(true);
    try {
      await rsvpEvent(event.id, firebaseUser.uid);
      setAttended(true);
      setAttendeeCount((c) => c + 1);
    } catch {
      Alert.alert('Error', 'Failed to RSVP.');
    } finally {
      setRsvpLoading(false);
    }
  }

  return (
    <View style={sc.root}>
      <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={sc.flex}>

        {/* Header */}
        <View style={sc.header}>
          <TouchableOpacity style={sc.backBtn} onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#ffffff18', '#ffffff0A']} style={sc.backBtnGrad}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={sc.headerTitle}>Event Details</Text>
          {isHost ? (
            <View style={sc.hostTag}>
              <Ionicons name="star" size={11} color={D.gold} />
              <Text style={sc.hostTagText}>Host</Text>
            </View>
          ) : <View style={{ width: 44 }} />}
        </View>

        <ScrollView contentContainerStyle={sc.scroll} showsVerticalScrollIndicator={false}>

          {/* Hero card */}
          <LinearGradient colors={[...cfg.grad, '#0D0D1A']} style={sc.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={sc.heroBadge}>
              <Ionicons name={cfg.icon} size={16} color="#fff" />
              <Text style={sc.heroBadgeText}>{cfg.label}</Text>
            </View>
            <Text style={sc.heroTitle}>{event.title}</Text>
            <View style={sc.heroHostRow}>
              <Ionicons name="person-circle-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={sc.heroHost}>Hosted by {event.hostName}</Text>
            </View>
          </LinearGradient>

          {/* Info grid */}
          <View style={sc.infoGrid}>
            <View style={sc.infoCard}>
              <LinearGradient colors={['#6C5CE7', '#4834D4']} style={sc.infoIcon}>
                <Ionicons name="calendar-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={sc.infoLabel}>Date & Time</Text>
              <Text style={sc.infoValue}>{formatDate(event.date)}</Text>
            </View>
            <View style={sc.infoCard}>
              <LinearGradient colors={['#00D2FF', '#0077FF']} style={sc.infoIcon}>
                <Ionicons name="location-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={sc.infoLabel}>Location</Text>
              <Text style={sc.infoValue}>{event.location}</Text>
            </View>
          </View>

          {/* Attendees card */}
          <View style={sc.glassCard}>
            <View style={sc.attendeeHeader}>
              <View style={sc.attendeeLeft}>
                <Ionicons name="people-outline" size={16} color={D.cyan} />
                <Text style={sc.attendeeTitle}>
                  {attendeeCount}{event.maxAttendees ? `/${event.maxAttendees}` : ''} Attending
                </Text>
              </View>
              {full && (
                <View style={sc.fullBadge}>
                  <Text style={sc.fullText}>Full</Text>
                </View>
              )}
            </View>
            {event.maxAttendees ? (
              <View style={sc.barBg}>
                <LinearGradient
                  colors={full ? ['#EF4444', '#C62828'] : cfg.grad}
                  style={[sc.barFill, { width: `${Math.min(pct * 100, 100)}%` as any }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
              </View>
            ) : null}
          </View>

          {/* Description */}
          <View style={sc.glassCard}>
            <View style={sc.sectionHeader}>
              <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.sectionIcon}>
                <Ionicons name="document-text-outline" size={14} color="#fff" />
              </LinearGradient>
              <Text style={sc.sectionTitle}>About this event</Text>
            </View>
            <Text style={sc.description}>{event.description}</Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Footer actions */}
        <View style={sc.footer}>
          {/* Invite button */}
          <TouchableOpacity
            style={sc.inviteBtn}
            onPress={() => navigation.navigate('EventInvite', { event })}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#6C5CE7', '#4834D4']} style={sc.inviteBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={sc.inviteBtnText}>Invite Friends</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* RSVP button */}
          <TouchableOpacity
            onPress={handleRsvp}
            activeOpacity={0.85}
            disabled={attended || full || rsvpLoading}
            style={sc.rsvpBtnWrap}
          >
            <LinearGradient
              colors={attended ? ['#1C2A1C', '#1C2A1C'] : full ? ['#2A1A1A', '#2A1A1A'] : ['#FF4B6E', '#C2185B']}
              style={[sc.rsvpBtn, (attended || full) && sc.rsvpBtnDim]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              {rsvpLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : attended ? (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#00E676" />
                  <Text style={[sc.rsvpBtnText, { color: '#00E676' }]}>You're Attending!</Text>
                </>
              ) : full ? (
                <>
                  <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                  <Text style={[sc.rsvpBtnText, { color: '#EF4444' }]}>Event Full</Text>
                </>
              ) : (
                <>
                  <Ionicons name="ticket-outline" size={20} color="#fff" />
                  <Text style={sc.rsvpBtnText}>RSVP to this Event</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#ffffff10',
  },
  backBtn:     {},
  backBtnGrad: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff20' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  hostTag:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFD70022', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: '#FFD70044' },
  hostTagText: { fontSize: 11, fontWeight: '700', color: D.gold },

  scroll: { padding: spacing.lg },

  heroCard: { borderRadius: 20, padding: spacing.lg, marginBottom: spacing.md },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff22', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, marginBottom: spacing.md },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
  heroHostRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroHost: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  infoGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  infoCard: {
    flex: 1, backgroundColor: D.card, borderRadius: 16, padding: spacing.md,
    borderWidth: 1, borderColor: D.border, gap: 6,
    ...shadows.card, shadowColor: '#000', shadowOpacity: 0.4,
  },
  infoIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, color: D.muted, fontWeight: '500' },
  infoValue: { fontSize: 13, color: D.text, fontWeight: '700', lineHeight: 18 },

  glassCard: {
    backgroundColor: D.card, borderRadius: 16, borderWidth: 1,
    borderColor: D.border, padding: spacing.md, marginBottom: spacing.md,
    ...shadows.card, shadowColor: '#000', shadowOpacity: 0.4,
  },
  attendeeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  attendeeLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attendeeTitle:  { fontSize: 15, fontWeight: '700', color: D.text },
  fullBadge:      { backgroundColor: '#EF444422', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: '#EF444444' },
  fullText:       { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  barBg:  { height: 8, backgroundColor: '#ffffff15', borderRadius: 4, overflow: 'hidden' },
  barFill:{ height: 8, borderRadius: 4 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  sectionIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: D.text },
  description:   { fontSize: 14, color: D.sub, lineHeight: 22 },

  footer: {
    padding: spacing.lg, paddingBottom: spacing.lg,
    borderTopWidth: 1, borderTopColor: '#ffffff10',
    gap: spacing.sm, backgroundColor: '#0D0D1AEE',
  },
  inviteBtn:      {},
  inviteBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.xl },
  inviteBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
  rsvpBtnWrap:    {},
  rsvpBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: radius.xl, ...shadows.md },
  rsvpBtnDim:     { opacity: 0.9 },
  rsvpBtnText:    { fontSize: 16, fontWeight: '800', color: '#fff' },
});
