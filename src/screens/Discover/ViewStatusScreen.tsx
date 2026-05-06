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
import { DiscoverStackParamList, DriftStatus } from '../../types';
import { deleteStatus, addStatusReaction, markStatusViewed } from '../../utils/firestore-helpers';
import { useAuthStore } from '../../store/authStore';

type Nav   = NativeStackNavigationProp<DiscoverStackParamList>;
type Route = RouteProp<DiscoverStackParamList, 'ViewStatus'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { emoji: string; label: string; color: string; grad: readonly [string, string] }> = {
  vibe_check:    { emoji: '✨', label: 'Vibe Check',    color: '#6C5CE7', grad: ['#6C5CE7', '#A29BFE'] },
  location_drop: { emoji: '📍', label: 'Location Drop', color: '#00B894', grad: ['#00B894', '#00CEC9'] },
  looking_for:   { emoji: '👀', label: 'Looking For',   color: '#FF4B6E', grad: ['#FF4B6E', '#FF7A93'] },
  game_invite:   { emoji: '🎮', label: 'Game Invite',   color: '#0984E3', grad: ['#0984E3', '#74B9FF'] },
  photo_moment:  { emoji: '📸', label: 'Photo Moment',  color: '#E17055', grad: ['#E17055', '#FAB1A0'] },
  memory_share:  { emoji: '🌟', label: 'Memory Share',  color: '#FDCB6E', grad: ['#FDCB6E', '#F9CA24'] },
  event_invite:  { emoji: '🎉', label: 'Event Invite',  color: '#6C5CE7', grad: ['#6C5CE7', '#A29BFE'] },
};

const FALLBACK = { emoji: '✨', label: 'Status', color: '#6C5CE7', grad: ['#6C5CE7', '#A29BFE'] as const };

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👍', '😮', '🙌'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeLeft(expiresAt: number): { label: string; urgent: boolean } {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return { label: 'Expired', urgent: true };
  const h  = Math.floor(ms / (1000 * 60 * 60));
  const m  = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h === 0) return { label: `${m}m left`, urgent: m < 30 };
  if (h < 3)   return { label: `${h}h ${m}m left`, urgent: true };
  return { label: `${h}h left`, urgent: false };
}

// ─── Story Progress Bar ───────────────────────────────────────────────────────

function StoryProgress({ color, duration = 8000 }: { color: string; duration?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={pgStyles.track}>
      <Animated.View
        style={[pgStyles.fill, {
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]}
      />
    </View>
  );
}

const pgStyles = StyleSheet.create({
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', flex: 1 },
  fill:  { height: 3, borderRadius: 2 },
});

// ─── Reaction Button ─────────────────────────────────────────────────────────

function ReactionBtn({
  emoji,
  count,
  myReact,
  onPress,
  primaryColor,
  C,
}: {
  emoji: string;
  count: number;
  myReact: boolean;
  onPress: () => void;
  primaryColor: string;
  C: AppColors;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          rbStyles.btn,
          { borderColor: myReact ? primaryColor + '80' : 'rgba(255,255,255,0.15)' },
          myReact && { backgroundColor: primaryColor + '20' },
        ]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        {count > 0 && (
          <Text style={[rbStyles.count, { color: myReact ? primaryColor : 'rgba(255,255,255,0.6)' }]}>
            {count}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const rbStyles = StyleSheet.create({
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.07)' },
  count: { fontSize: 13, fontWeight: '700' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ViewStatusScreen() {
  const { C, isDark } = useTheme();
  const styles        = makeStyles(C, isDark);
  const navigation    = useNavigation<Nav>();
  const route         = useRoute<Route>();
  const myUid         = useAuthStore((s) => s.firebaseUser?.uid) ?? '';

  const { status, name, photoURL, isMine } = route.params;
  const meta      = TYPE_META[status.type] ?? FALLBACK;
  const timeInfo  = getTimeLeft(status.expiresAt);
  const isExpired = status.expiresAt <= Date.now();
  const viewCount = (status.views ?? []).length;

  const [localStatus, setLocalStatus] = useState<DriftStatus>(status);
  const [deleting,    setDeleting]    = useState(false);

  useEffect(() => {
    if (!isMine && myUid && !isExpired) {
      markStatusViewed(status.uid, myUid).catch(() => {});
    }
  }, []);

  async function handleReact(emoji: string) {
    if (isExpired) return;
    try {
      const reactions = { ...(localStatus.reactions ?? {}) };
      const uids   = (reactions[emoji] as unknown as string[] | undefined) ?? [];
      const already = uids.includes(myUid);
      reactions[emoji] = (already
        ? uids.filter((u) => u !== myUid)
        : [...uids, myUid]) as unknown as string;
      setLocalStatus((prev) => ({ ...prev, reactions }));
      await addStatusReaction(status.uid, myUid, emoji, already);
    } catch { /* non-critical */ }
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Status',
      'This will remove your status for everyone.',
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
              Alert.alert('Error', 'Could not delete. Try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      {/* Full-screen gradient background */}
      <LinearGradient
        colors={isDark
          ? [meta.color + '30', '#0D0D1A', '#0D0D1A']
          : [meta.color + '18', '#F8F9FA', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      {/* Decorative blobs */}
      <View style={[styles.blob1, { backgroundColor: meta.color + '20' }]} />
      <View style={[styles.blob2, { backgroundColor: meta.color + '10' }]} />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>

        {/* Story progress bar row */}
        <View style={styles.progressRow}>
          <StoryProgress color={meta.color} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={isDark ? '#fff' : C.text} />
          </TouchableOpacity>

          <View style={styles.posterInfo}>
            <LinearGradient
              colors={meta.grad}
              style={styles.avatarRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatarInner}>
                <Avatar name={name} photoURL={photoURL} size={38} />
              </View>
            </LinearGradient>
            <View>
              <Text style={styles.posterName}>{isMine ? 'Your Status' : name}</Text>
              <View style={styles.timeRow}>
                <Ionicons
                  name="time-outline"
                  size={11}
                  color={timeInfo.urgent ? '#FF4B6E' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={[
                  styles.timeText,
                  timeInfo.urgent && { color: '#FF4B6E' },
                ]}>
                  {timeInfo.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {isMine && (
              <>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.replace('StatusCreate', { initialStatus: status })}
                >
                  <Ionicons name="create-outline" size={18} color={meta.color} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Type badge */}
          <View style={styles.typeBadgeRow}>
            <LinearGradient
              colors={meta.grad}
              style={styles.typeBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
              <Text style={styles.typeBadgeLabel}>{meta.label}</Text>
            </LinearGradient>
          </View>

          {/* Main content card */}
          <View style={[styles.contentCard, { borderColor: meta.color + '30' }]}>
            <LinearGradient
              colors={[meta.color + '10', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {localStatus.text ? (
              <Text style={styles.contentText}>{localStatus.text}</Text>
            ) : localStatus.location ? (
              <View>
                <Text style={styles.contentText}>📍 {localStatus.location.venue}</Text>
                {localStatus.location.city ? (
                  <Text style={styles.locationCity}>{localStatus.location.city}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.contentText, { color: 'rgba(255,255,255,0.4)' }]}>
                {meta.label}
              </Text>
            )}
          </View>

          {/* Meta pills */}
          <View style={styles.metaRow}>
            <View style={[styles.metaPill, {
              backgroundColor: status.audience === 'everyone'
                ? C.success + '20'
                : C.secondary + '20',
            }]}>
              <Text style={{ fontSize: 12 }}>
                {status.audience === 'everyone' ? '🌍' : '🫂'}
              </Text>
              <Text style={[styles.metaPillText, {
                color: status.audience === 'everyone' ? C.success : C.secondary,
              }]}>
                {status.audience === 'everyone' ? 'Everyone' : 'Connections'}
              </Text>
            </View>

            {isMine && viewCount > 0 && (
              <View style={[styles.metaPill, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.6)" />
                <Text style={[styles.metaPillText, { color: 'rgba(255,255,255,0.6)' }]}>
                  {viewCount} {viewCount === 1 ? 'view' : 'views'}
                </Text>
              </View>
            )}
          </View>

          {/* Reactions */}
          {!isExpired ? (
            <View style={styles.reactSection}>
              <Text style={styles.reactLabel}>React</Text>
              <View style={styles.reactRow}>
                {REACTION_EMOJIS.map((emoji) => {
                  const uids     = (localStatus.reactions?.[emoji] as unknown as string[] | undefined) ?? [];
                  const myReact  = uids.includes(myUid);
                  return (
                    <ReactionBtn
                      key={emoji}
                      emoji={emoji}
                      count={uids.length}
                      myReact={myReact}
                      primaryColor={meta.color}
                      C={C}
                      onPress={() => handleReact(emoji)}
                    />
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.expiredBox}>
              <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.4)" />
              <Text style={styles.expiredText}>This status has expired</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, isDark: boolean) {
  const textColor = isDark ? '#fff' : C.text;
  const subColor  = isDark ? 'rgba(255,255,255,0.5)' : C.textSecondary;

  return StyleSheet.create({
    root:  { flex: 1, backgroundColor: isDark ? '#0D0D1A' : C.background },
    flex:  { flex: 1 },

    blob1: {
      position: 'absolute', top: -60, right: -60,
      width: 220, height: 220, borderRadius: 110,
    },
    blob2: {
      position: 'absolute', top: 140, left: -80,
      width: 180, height: 180, borderRadius: 90,
    },

    progressRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: 2,
      gap: spacing.xs,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    backBtn: {
      width: 38, height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    posterInfo: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    },
    avatarRing: {
      width: 48, height: 48, borderRadius: 24,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarInner: {
      width: 40, height: 40, borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: isDark ? '#0D0D1A' : '#fff',
    },
    posterName: {
      ...typography.body,
      fontWeight: '700',
      color: textColor,
    },
    timeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
    },
    timeText: {
      ...typography.small,
      color: subColor,
    },
    headerActions: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },

    scroll: {
      padding: spacing.lg,
      paddingBottom: 60,
      gap: spacing.lg,
    },

    typeBadgeRow: { alignItems: 'flex-start' },
    typeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingVertical: 8,
      borderRadius: radius.full,
    },
    typeBadgeLabel: { ...typography.label, fontWeight: '700', color: '#fff' },

    contentCard: {
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: spacing.xl,
      minHeight: 140,
      justifyContent: 'center',
      overflow: 'hidden',
      ...shadows.md,
    },
    contentText: {
      fontSize: 24,
      fontWeight: '700',
      color: textColor,
      lineHeight: 34,
    },
    locationCity: {
      ...typography.body,
      color: subColor,
      marginTop: spacing.xs,
    },

    metaRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    },
    metaPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: radius.full,
    },
    metaPillText: { ...typography.small, fontWeight: '600' },

    reactSection: { gap: spacing.sm },
    reactLabel: {
      ...typography.label,
      color: subColor,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    reactRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    },

    expiredBox: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      justifyContent: 'center',
      paddingVertical: spacing.md,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: radius.md,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    expiredText: { ...typography.body, color: 'rgba(255,255,255,0.4)' },
  });
}
