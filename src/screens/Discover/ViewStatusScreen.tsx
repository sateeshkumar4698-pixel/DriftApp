/**
 * ViewStatusScreen — Full-screen status viewer
 *
 * Navigated to from DiscoverScreen's StoriesBar and from ConnectionsScreen.
 * Shows the status with type-specific layout, reactions, expiry, audience.
 * Supports reaction tap (❤️ 👍 😂 🔥) and delete for own statuses.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '../../components/Avatar';
import { useTheme, AppColors, spacing, typography, radius, shadows } from '../../utils/useTheme';
import { DiscoverStackParamList, DriftStatus, UserProfile } from '../../types';
import { deleteStatus, addStatusReaction, markStatusViewed } from '../../utils/firestore-helpers';
import { useAuthStore } from '../../store/authStore';

type Nav   = NativeStackNavigationProp<DiscoverStackParamList>;
type Route = RouteProp<DiscoverStackParamList, 'ViewStatus'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TYPE_EMOJI: Record<string, string> = {
  vibe_check:    '✨',
  location_drop: '📍',
  looking_for:   '👀',
  game_invite:   '🎮',
  photo_moment:  '📸',
  memory_share:  '🌟',
  event_invite:  '🎉',
};

const STATUS_TYPE_LABEL: Record<string, string> = {
  vibe_check:    'Vibe Check',
  location_drop: 'Location Drop',
  looking_for:   'Looking For',
  game_invite:   'Game Invite',
  photo_moment:  'Photo Moment',
  memory_share:  'Memory Share',
  event_invite:  'Event Invite',
};

const STATUS_TYPE_COLOR: Record<string, string> = {
  vibe_check:    '#6C5CE7',
  location_drop: '#00B894',
  looking_for:   '#FF4B6E',
  game_invite:   '#0984E3',
  photo_moment:  '#E17055',
  memory_share:  '#FDCB6E',
  event_invite:  '#6C5CE7',
};

const STATUS_TYPE_GRAD: Record<string, readonly [string, string]> = {
  vibe_check:    ['#6C5CE7', '#A29BFE'],
  location_drop: ['#00B894', '#00CEC9'],
  looking_for:   ['#FF4B6E', '#FF7A93'],
  game_invite:   ['#0984E3', '#74B9FF'],
  photo_moment:  ['#E17055', '#FAB1A0'],
  memory_share:  ['#FDCB6E', '#F9CA24'],
  event_invite:  ['#6C5CE7', '#A29BFE'],
};

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👍', '😮', '🙌'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeLeft(expiresAt: number): string {
  const ms  = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const h   = Math.floor(ms / (1000 * 60 * 60));
  const m   = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ─── Reaction Bar ─────────────────────────────────────────────────────────────

function ReactionBar({
  status,
  myUid,
  onReact,
  C,
}: {
  status: DriftStatus;
  myUid: string;
  onReact: (emoji: string) => void;
  C: AppColors;
}) {
  const styles = makeStyles(C);
  const reactions = status.reactions ?? {};

  return (
    <View style={styles.reactionBar}>
      {REACTION_EMOJIS.map((emoji) => {
        const uids   = reactions[emoji] as unknown as string[] | undefined ?? [];
        const count  = uids.length;
        const myReact = uids.includes(myUid);
        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBtn,
              myReact && { backgroundColor: C.primary + '20', borderColor: C.primary + '60' },
            ]}
            onPress={() => onReact(emoji)}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 18 }}>{emoji}</Text>
            {count > 0 && (
              <Text style={[styles.reactionCount, myReact && { color: C.primary }]}>
                {count}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Progress bar (auto-dismiss) ─────────────────────────────────────────────

function ProgressBar({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 8000,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden', marginHorizontal: spacing.lg, marginTop: spacing.xs }}>
      <Animated.View
        style={{
          height: 3,
          backgroundColor: color,
          borderRadius: 2,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ViewStatusScreen() {
  const { C, isDark } = useTheme();
  const styles        = makeStyles(C);
  const navigation    = useNavigation<Nav>();
  const route         = useRoute<Route>();
  const myUid         = useAuthStore((s) => s.firebaseUser?.uid) ?? '';

  const { status, name, photoURL, isMine } = route.params;

  const [localStatus, setLocalStatus] = useState<DriftStatus>(status);
  const [deleting,    setDeleting]    = useState(false);

  const emoji      = STATUS_TYPE_EMOJI[status.type]  ?? '✨';
  const label      = STATUS_TYPE_LABEL[status.type]  ?? status.type;
  const color      = STATUS_TYPE_COLOR[status.type]  ?? '#6C5CE7';
  const grad       = STATUS_TYPE_GRAD[status.type]   ?? (['#6C5CE7', '#A29BFE'] as const);
  const timeLeft   = getTimeLeft(status.expiresAt);
  const isExpired  = status.expiresAt <= Date.now();
  const viewCount  = (status.views ?? []).length;

  // Mark as viewed
  useEffect(() => {
    if (!isMine && myUid && !isExpired) {
      markStatusViewed(status.uid, myUid).catch(() => {});
    }
  }, []);

  async function handleReact(emoji: string) {
    if (isExpired) return;
    try {
      const reactions = { ...(localStatus.reactions ?? {}) };
      const uids = (reactions[emoji] as unknown as string[] | undefined) ?? [];
      const already = uids.includes(myUid);
      reactions[emoji] = (already
        ? uids.filter((u) => u !== myUid)
        : [...uids, myUid]) as unknown as string;
      setLocalStatus((prev) => ({ ...prev, reactions }));
      await addStatusReaction(status.uid, myUid, emoji, already);
    } catch {
      // non-critical
    }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Status',
      'Remove your status? It will disappear for everyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteStatus(myUid);
              navigation.goBack();
            } catch {
              setDeleting(false);
              Alert.alert('Error', 'Could not delete status. Try again.');
            }
          },
        },
      ],
    );
  }

  function handleEdit() {
    navigation.replace('StatusCreate', { initialStatus: status });
  }

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={isDark ? ['#0D0D1A', '#15152A'] : ['#F8F9FA', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Progress bar */}
        <ProgressBar color={color} />

        {/* Header row */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>

          {/* Poster info */}
          <View style={styles.posterRow}>
            <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={grad}
                style={styles.avatarRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.avatarInner}>
                  <Avatar name={name} photoURL={photoURL} size={36} />
                </View>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>{isMine ? 'Your Status' : name}</Text>
              <Text style={[styles.posterTime, isExpired && { color: C.error }]}>
                {isExpired ? '⏱ Expired' : `⏱ ${timeLeft}`}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {isMine && (
              <>
                <TouchableOpacity style={styles.actionBtn} onPress={handleEdit}>
                  <Ionicons name="create-outline" size={18} color={color} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.error + '12' }]}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  <Ionicons name="trash-outline" size={18} color={C.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Type pill ── */}
          <View style={styles.typePillWrap}>
            <LinearGradient colors={grad} style={styles.typePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={{ fontSize: 16 }}>{emoji}</Text>
              <Text style={styles.typePillLabel}>{label}</Text>
            </LinearGradient>
          </View>

          {/* ── Main content card ── */}
          <LinearGradient
            colors={[color + '14', color + '06']}
            style={styles.contentCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.contentCardBorder, { borderColor: color + '35' }]}>
              {localStatus.text ? (
                <Text style={styles.contentText}>{localStatus.text}</Text>
              ) : localStatus.location ? (
                <View style={{ gap: spacing.xs }}>
                  <Text style={styles.contentText}>📍 {localStatus.location.venue}</Text>
                  {localStatus.location.city ? (
                    <Text style={styles.locationCity}>{localStatus.location.city}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.contentText, { color: C.textSecondary }]}>
                  {label}
                </Text>
              )}
            </View>
          </LinearGradient>

          {/* ── Meta info ── */}
          <View style={styles.metaRow}>
            <View style={[styles.metaPill, { backgroundColor: status.audience === 'everyone' ? C.success + '18' : C.secondary + '18' }]}>
              <Text style={{ fontSize: 12 }}>{status.audience === 'everyone' ? '🌍' : '🫂'}</Text>
              <Text style={[styles.metaPillText, { color: status.audience === 'everyone' ? C.success : C.secondary }]}>
                {status.audience === 'everyone' ? 'Everyone' : 'Connections'}
              </Text>
            </View>
            {isMine && viewCount > 0 && (
              <View style={[styles.metaPill, { backgroundColor: C.surface }]}>
                <Ionicons name="eye-outline" size={13} color={C.textSecondary} />
                <Text style={[styles.metaPillText, { color: C.textSecondary }]}>
                  {viewCount} {viewCount === 1 ? 'view' : 'views'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Reactions ── */}
          {!isExpired && (
            <>
              <Text style={styles.reactLabel}>React</Text>
              <ReactionBar
                status={localStatus}
                myUid={myUid}
                onReact={handleReact}
                C={C}
              />
            </>
          )}

          {/* ── Expired notice ── */}
          {isExpired && (
            <View style={styles.expiredBanner}>
              <Ionicons name="time-outline" size={18} color={C.textSecondary} />
              <Text style={styles.expiredText}>This status has expired</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: C.background },
    flex:  { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    posterRow: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    },
    avatarRing: {
      width: 46, height: 46, borderRadius: 23,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarInner: {
      width: 38, height: 38, borderRadius: 19,
      overflow: 'hidden', backgroundColor: C.background,
    },
    posterName: { ...typography.body, fontWeight: '700', color: C.text },
    posterTime: { ...typography.small, color: C.textSecondary, marginTop: 1 },
    actionBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },

    scrollContent: { padding: spacing.lg, paddingBottom: 60, gap: spacing.md },

    // Type pill
    typePillWrap: { alignItems: 'flex-start' },
    typePill: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full,
    },
    typePillLabel: { ...typography.caption, fontWeight: '700', color: '#fff' },

    // Content card
    contentCard: { borderRadius: radius.lg, overflow: 'hidden' },
    contentCardBorder: {
      borderWidth: 1, borderRadius: radius.lg,
      padding: spacing.lg + spacing.sm, minHeight: 120,
      justifyContent: 'center',
    },
    contentText: { fontSize: 22, fontWeight: '700', color: C.text, lineHeight: 32 },
    locationCity: { ...typography.body, color: C.textSecondary, marginTop: spacing.xs },

    // Meta
    metaRow: { flexDirection: 'row', gap: spacing.sm },
    metaPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: spacing.sm, paddingVertical: 5,
      borderRadius: radius.full,
    },
    metaPillText: { ...typography.small, fontWeight: '600' },

    // Reactions
    reactLabel: {
      ...typography.label, color: C.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },
    reactionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    reactionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.sm - 2,
      borderRadius: radius.full, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      ...shadows.xs,
    },
    reactionCount: { ...typography.small, fontWeight: '700', color: C.textSecondary },

    // Expired
    expiredBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      justifyContent: 'center', paddingVertical: spacing.md,
      backgroundColor: C.surface, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.border,
    },
    expiredText: { ...typography.body, color: C.textSecondary },
  });
}
