import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { rsvpEvent, cancelRsvp, cancelEvent } from '../../utils/firestore-helpers';
import { formatDate } from '../../utils/helpers';
import { spacing, radius, shadows } from '../../utils/theme';
import { EventsStackParamList } from '../../types';
import { useTheme, AppColors } from '../../utils/useTheme';

type RouteProps = RouteProp<EventsStackParamList, 'EventDetail'>;
type Nav        = NativeStackNavigationProp<EventsStackParamList>;

// ─── Category config ──────────────────────────────────────────────────────────

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

// ─── Info tile ────────────────────────────────────────────────────────────────

function InfoTile({ icon, grad, label, value, C }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
  label: string;
  value: string;
  C: AppColors;
}) {
  const s = StyleSheet.create({
    tile: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: spacing.md, borderWidth: 1, borderColor: C.border, gap: 6, ...shadows.card },
    iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    lbl:  { fontSize: 11, color: C.textTertiary, fontWeight: '500' },
    val:  { fontSize: 13, color: C.text, fontWeight: '700', lineHeight: 18 },
  });
  return (
    <View style={s.tile}>
      <LinearGradient colors={grad} style={s.iconWrap}>
        <Ionicons name={icon} size={16} color="#fff" />
      </LinearGradient>
      <Text style={s.lbl}>{label}</Text>
      <Text style={s.val}>{value}</Text>
    </View>
  );
}

// ─── Attendee count ring ──────────────────────────────────────────────────────

function AttendeeRing({ count, max, grad, full, C }: {
  count: number; max?: number; grad: readonly [string, string]; full: boolean; C: AppColors;
}) {
  const pct = max ? Math.min(count / max, 1) : 0;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="people-outline" size={16} color={C.secondary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
            {count}{max ? `/${max}` : ''} Attending
          </Text>
        </View>
        {full && (
          <View style={{ backgroundColor: C.error + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: C.error + '40' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.error }}>Full</Text>
          </View>
        )}
        {!full && max && (
          <Text style={{ fontSize: 12, color: C.textSecondary }}>{max - count} spots left</Text>
        )}
      </View>
      {max ? (
        <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' }}>
          <LinearGradient
            colors={full ? ['#EF4444', '#C62828'] : grad}
            style={{ height: 8, borderRadius: 4, width: `${pct * 100}%` as `${number}%` }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteProps>();
  const { event }  = route.params;
  const { firebaseUser } = useAuthStore();
  const { C, isDark } = useTheme();
  const sc = makeStyles(C, isDark);

  const [rsvpLoading,    setRsvpLoading]    = useState(false);
  const [cancelLoading,  setCancelLoading]  = useState(false);
  const [attended,       setAttended]       = useState(
    firebaseUser ? event.attendees.includes(firebaseUser.uid) : false,
  );
  const [attendeeCount,  setAttendeeCount]  = useState(event.attendees.length);
  const [isCancelled,    setIsCancelled]    = useState(event.cancelled ?? false);

  const cfg    = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.other;
  const full   = event.maxAttendees != null && attendeeCount >= event.maxAttendees;
  const isHost = firebaseUser?.uid === event.hostId;
  const isPast = event.date < Date.now();

  // ── RSVP ──
  async function handleRsvp() {
    if (!firebaseUser) return;
    if (full && !attended) { Alert.alert('Full', 'This event is at capacity.'); return; }
    setRsvpLoading(true);
    try {
      if (attended) {
        await cancelRsvp(event.id, firebaseUser.uid);
        setAttended(false);
        setAttendeeCount((c) => c - 1);
      } else {
        await rsvpEvent(event.id, firebaseUser.uid);
        setAttended(true);
        setAttendeeCount((c) => c + 1);
      }
    } catch {
      Alert.alert('Error', 'Could not update RSVP. Try again.');
    } finally {
      setRsvpLoading(false);
    }
  }

  // ── Host: Cancel event ──
  function handleHostCancel() {
    Alert.alert(
      'Cancel Event',
      'Are you sure you want to cancel this event? Attendees will see it as cancelled.',
      [
        { text: 'Keep Event', style: 'cancel' },
        {
          text: 'Cancel Event',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try {
              await cancelEvent(event.id);
              setIsCancelled(true);
              Alert.alert('Event Cancelled', 'Your event has been marked as cancelled.');
            } catch {
              Alert.alert('Error', 'Could not cancel event. Try again.');
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ],
    );
  }

  // ── Share ──
  async function handleShare() {
    try {
      await Share.share({
        message: `${event.title} on ${formatDate(event.date)} at ${event.location} — join me on Drift!`,
        title: event.title,
      });
    } catch {
      // user cancelled share
    }
  }

  return (
    <View style={sc.root}>
      <SafeAreaView style={sc.flex}>

        {/* ── Header ── */}
        <View style={sc.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={sc.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={sc.headerTitle} numberOfLines={1}>{event.title}</Text>
          <View style={sc.headerRight}>
            <TouchableOpacity onPress={handleShare} style={sc.iconBtn}>
              <Ionicons name="share-outline" size={22} color={C.text} />
            </TouchableOpacity>
            {isHost && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CreateEvent')}
                style={sc.iconBtn}
              >
                <Ionicons name="create-outline" size={22} color={C.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={sc.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero gradient card ── */}
          <LinearGradient
            colors={isCancelled ? ['#6B7280', '#9CA3AF'] : [...cfg.grad, cfg.grad[1] + 'BB']}
            style={sc.heroCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {/* Category badge */}
            <View style={sc.heroBadge}>
              <Text style={sc.heroBadgeEmoji}>{cfg.emoji}</Text>
              <Text style={sc.heroBadgeText}>{cfg.label}</Text>
            </View>

            {/* Status badges */}
            {isCancelled && (
              <View style={sc.cancelledBanner}>
                <Ionicons name="close-circle" size={14} color="#fff" />
                <Text style={sc.cancelledBannerText}>This event has been cancelled</Text>
              </View>
            )}

            <Text style={sc.heroTitle}>{event.title}</Text>
            <View style={sc.heroHostRow}>
              <Ionicons name="person-circle-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={sc.heroHost}>Hosted by {event.hostName}</Text>
            </View>

            {/* Tags */}
            {(event.tags ?? []).length > 0 && (
              <View style={sc.heroTags}>
                {(event.tags ?? []).map((tag) => (
                  <View key={tag} style={sc.heroTag}>
                    <Text style={sc.heroTagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>

          {/* ── Info grid ── */}
          <View style={sc.infoGrid}>
            <InfoTile icon="calendar-outline"  grad={['#6C5CE7', '#4834D4']} label="Date & Time"  value={formatDate(event.date)}  C={C} />
            <InfoTile icon="location-outline"  grad={['#00D2FF', '#0077FF']} label="Location"     value={event.location}          C={C} />
          </View>

          {/* ── Attendees card ── */}
          <View style={sc.glassCard}>
            <AttendeeRing
              count={attendeeCount}
              max={event.maxAttendees}
              grad={cfg.grad}
              full={full}
              C={C}
            />
          </View>

          {/* ── Description ── */}
          <View style={sc.glassCard}>
            <View style={sc.sectionHeader}>
              <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.sectionIcon}>
                <Ionicons name="document-text-outline" size={14} color="#fff" />
              </LinearGradient>
              <Text style={sc.sectionTitle}>About this event</Text>
            </View>
            <Text style={sc.description}>{event.description}</Text>
          </View>

          {/* ── Host controls (host only) ── */}
          {isHost && !isCancelled && (
            <View style={sc.glassCard}>
              <View style={sc.sectionHeader}>
                <LinearGradient colors={['#FFD700', '#FF8C00']} style={sc.sectionIcon}>
                  <Ionicons name="settings-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={sc.sectionTitle}>Host Controls</Text>
              </View>
              <View style={sc.hostActions}>
                <TouchableOpacity
                  style={sc.hostActionBtn}
                  onPress={() => navigation.navigate('EventInvite', { event })}
                >
                  <LinearGradient colors={['#6C5CE7', '#4834D4']} style={sc.hostActionGrad}>
                    <Ionicons name="paper-plane-outline" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={sc.hostActionText}>Invite Friends</Text>
                </TouchableOpacity>
                {!isPast && (
                  <TouchableOpacity
                    style={[sc.hostActionBtn, sc.hostCancelBtn]}
                    onPress={handleHostCancel}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? (
                      <ActivityIndicator size="small" color={C.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={16} color={C.error} />
                    )}
                    <Text style={[sc.hostActionText, { color: C.error }]}>Cancel Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>

        {/* ── Footer ── */}
        <View style={sc.footer}>
          {/* Invite button (for attendees or host) */}
          {!isCancelled && (
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
          )}

          {/* RSVP / Cancel RSVP button */}
          {!isHost && !isCancelled && (
            <TouchableOpacity
              onPress={handleRsvp}
              activeOpacity={0.85}
              disabled={rsvpLoading || (full && !attended) || isPast}
            >
              <LinearGradient
                colors={
                  attended        ? [C.success + '30', C.success + '20'] :
                  full            ? [C.error + '20',   C.error + '15'] :
                  isPast          ? [C.border, C.border] :
                  ['#FF4B6E', '#C2185B']
                }
                style={sc.rsvpBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {rsvpLoading ? (
                  <ActivityIndicator color={attended ? C.success : '#fff'} size="small" />
                ) : attended ? (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={C.success} />
                    <Text style={[sc.rsvpBtnText, { color: C.success }]}>You're Going · Tap to Cancel</Text>
                  </>
                ) : full ? (
                  <>
                    <Ionicons name="close-circle-outline" size={20} color={C.error} />
                    <Text style={[sc.rsvpBtnText, { color: C.error }]}>Event Full</Text>
                  </>
                ) : isPast ? (
                  <>
                    <Ionicons name="time-outline" size={20} color={C.textSecondary} />
                    <Text style={[sc.rsvpBtnText, { color: C.textSecondary }]}>Event Ended</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="ticket-outline" size={20} color="#fff" />
                    <Text style={sc.rsvpBtnText}>RSVP to this Event</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Host — show invite only (cancel is in host controls card) */}
          {isHost && isCancelled && (
            <View style={[sc.rsvpBtn, { backgroundColor: C.error + '20', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }]}>
              <Ionicons name="close-circle" size={20} color={C.error} />
              <Text style={[sc.rsvpBtnText, { color: C.error }]}>Event Cancelled</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border,
      backgroundColor: C.background,
      gap: spacing.sm,
    },
    backBtn:     { padding: 4 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text },
    headerRight: { flexDirection: 'row', gap: 4 },
    iconBtn:     { padding: spacing.xs },

    scroll: { padding: spacing.lg, paddingTop: spacing.md },

    heroCard: { borderRadius: 20, padding: spacing.lg, marginBottom: spacing.md },
    heroBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, marginBottom: spacing.sm,
    },
    heroBadgeEmoji: { fontSize: 14 },
    heroBadgeText:  { fontSize: 12, fontWeight: '700', color: '#fff' },

    cancelledBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: radius.md, marginBottom: spacing.sm, alignSelf: 'flex-start',
    },
    cancelledBannerText: { fontSize: 12, fontWeight: '700', color: '#fff' },

    heroTitle:   { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: -0.3 },
    heroHostRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    heroHost:    { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

    heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    heroTag:  { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
    heroTagText: { fontSize: 11, fontWeight: '600', color: '#fff' },

    infoGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

    glassCard: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
      borderColor: C.border, padding: spacing.md, marginBottom: spacing.md,
      ...shadows.card,
    },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
    sectionIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.text },
    description:   { fontSize: 14, color: C.textSecondary, lineHeight: 22 },

    hostActions: { gap: spacing.sm },
    hostActionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      backgroundColor: C.inputBg, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.border,
    },
    hostActionGrad: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    hostActionText: { fontSize: 14, fontWeight: '600', color: C.text },
    hostCancelBtn:  { borderColor: C.error + '40', backgroundColor: C.error + '08' },

    footer: {
      padding: spacing.lg,
      borderTopWidth: 1, borderTopColor: C.border,
      backgroundColor: C.background,
      gap: spacing.sm,
      ...shadows.modal,
    },
    inviteBtn:     {},
    inviteBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.lg },
    inviteBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    rsvpBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border },
    rsvpBtnText:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  });
}
