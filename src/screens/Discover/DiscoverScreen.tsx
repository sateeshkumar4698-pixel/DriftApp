import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import {
  getDiscoverFeed,
  getInteractedUids,
  getActiveStatuses,
  getMyStatus,
  subscribeToConnections,
  subscribeToUnreadCount,
} from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useTheme, AppColors, spacing, typography, radius, shadows } from '../../utils/useTheme';
import { Connection, DiscoverStackParamList, DriftStatus, UserProfile } from '../../types';
import { dynamicVibeMatch } from '../../utils/vibeMatch';
import { useMoodStore, MOOD_META, MoodPreset } from '../../store/moodStore';




interface StatusViewItem {
  status: DriftStatus;
  name: string;
  photoURL?: string;
  isMine?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENT_FILTERS: Array<{ key: string; label: string; emoji: string; color: string }> = [
  { key: 'All',        label: 'All',     emoji: '✨', color: '#6C5CE7' },
  { key: 'Friends',    label: 'Friends', emoji: '🤝', color: '#00B894' },
  { key: 'Networking', label: 'Network', emoji: '💼', color: '#0984E3' },
  { key: 'Events',     label: 'Events',  emoji: '🎉', color: '#E17055' },
  { key: 'Dating',     label: 'Dating',  emoji: '💘', color: '#FF4B6E' },
  { key: '🟢 Active',  label: 'Active',  emoji: '🟢', color: '#00E676' },
];

const CHIP_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#FFB347', '#87CEEB',
];

const MOODS: MoodPreset[] = ['energetic', 'chill', 'creative', 'social', 'romantic', 'focused'];

const STATUS_TYPE_EMOJI: Record<string, string> = {
  vibe_check: '✨', location_drop: '📍', looking_for: '👀',
  game_invite: '🎮', photo_moment: '📸', memory_share: '🌟', event_invite: '🎉',
};

const STATUS_TYPE_LABEL: Record<string, string> = {
  vibe_check: 'Vibe Check', location_drop: 'Location Drop', looking_for: 'Looking For',
  game_invite: 'Game Invite', photo_moment: 'Photo Moment', memory_share: 'Memory Share',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchGrad(pct: number): readonly [string, string] {
  if (pct >= 85) return ['#FF4B6E', '#FF8C42'];
  if (pct >= 70) return ['#6C5CE7', '#A855F7'];
  if (pct >= 50) return ['#0984E3', '#00B4D8'];
  return ['#636E72', '#B2BEC3'];
}

// ─── Status Viewer Modal ──────────────────────────────────────────────────────

function StatusViewerModal({
  item, onClose, onEdit,
}: {
  item: StatusViewItem | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { C } = useTheme();
  const sv = makeSvStyles(C);
  if (!item) return null;

  const { status, name, isMine } = item;
  const emoji = STATUS_TYPE_EMOJI[status.type] ?? '✨';
  const label = STATUS_TYPE_LABEL[status.type] ?? status.type;
  const typeColor: Record<string, string> = {
    vibe_check: '#6C5CE7', location_drop: '#00B894', looking_for: '#FF4B6E',
    game_invite: '#0984E3', photo_moment: '#E17055', memory_share: '#FDCB6E',
  };
  const accentColor = typeColor[status.type] ?? C.secondary;
  const timeLeft = Math.max(0, Math.round((status.expiresAt - Date.now()) / (1000 * 60 * 60)));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={sv.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={sv.sheet}>
          <View style={[sv.colorBar, { backgroundColor: accentColor }]} />
          <View style={sv.header}>
            <View style={[sv.typePill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
              <Text style={sv.typePillEmoji}>{emoji}</Text>
              <Text style={[sv.typePillLabel, { color: accentColor }]}>{label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isMine && onEdit && (
                <TouchableOpacity onPress={onEdit} style={[sv.closeBtn, sv.editBtn]}>
                  <Text style={[sv.closeBtnText, { color: accentColor }]}>✏️ Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={sv.closeBtn}>
                <Text style={sv.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={sv.posterName}>{isMine ? 'Your status' : name}</Text>
          <View style={sv.contentBox}>
            {status.text ? (
              <Text style={sv.contentText}>{status.text}</Text>
            ) : status.location ? (
              <View>
                <Text style={sv.locationVenue}>📍 {status.location.venue}</Text>
                {status.location.city ? <Text style={sv.locationCity}>{status.location.city}</Text> : null}
              </View>
            ) : null}
          </View>
          <View style={sv.footer}>
            <Text style={sv.expiryText}>⏱ Expires in {timeLeft}h</Text>
            <View style={[sv.audiencePill, { backgroundColor: status.audience === 'everyone' ? C.success + '18' : C.secondary + '18' }]}>
              <Text style={[sv.audienceText, { color: status.audience === 'everyone' ? C.success : C.secondary }]}>
                {status.audience === 'everyone' ? '🌍 Everyone' : '🫂 Connections'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function makeSvStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet:         { backgroundColor: C.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', paddingBottom: 40 },
    colorBar:      { height: 4 },
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
    typePill:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
    typePillEmoji: { fontSize: 16 },
    typePillLabel: { ...typography.caption, fontWeight: '700' },
    closeBtn:      { padding: spacing.sm },
    closeBtnText:  { fontSize: 16, color: C.textSecondary, fontWeight: '600' },
    editBtn:       { borderWidth: 1, borderColor: C.border, borderRadius: radius.full, paddingHorizontal: 10 },
    posterName:    { ...typography.body, fontWeight: '700', color: C.text, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    contentBox:    { marginHorizontal: spacing.md, padding: spacing.md, backgroundColor: C.surface, borderRadius: radius.md, marginBottom: spacing.md, minHeight: 80, justifyContent: 'center' },
    contentText:   { fontSize: 20, fontWeight: '600', color: C.text, lineHeight: 30 },
    locationVenue: { fontSize: 20, fontWeight: '700', color: C.text },
    locationCity:  { ...typography.body, color: C.textSecondary, marginTop: 4 },
    footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
    expiryText:    { ...typography.small, color: C.textSecondary },
    audiencePill:  { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
    audienceText:  { ...typography.small, fontWeight: '700' },
  });
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  const { C } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <Animated.View style={{ opacity, backgroundColor: C.background, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12 }}>
      <View style={{ height: 4, backgroundColor: C.border }} />
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.border }} />
          <View style={{ flex: 1, gap: 9, paddingTop: 4 }}>
            <View style={{ width: '75%', height: 13, borderRadius: 6, backgroundColor: C.border }} />
            <View style={{ width: '50%', height: 10, borderRadius: 5, backgroundColor: C.border }} />
          </View>
          <View style={{ width: 54, height: 46, borderRadius: 10, backgroundColor: C.border }} />
        </View>
        <View style={{ width: '88%', height: 10, borderRadius: 5, backgroundColor: C.border, marginTop: 14 }} />
        <View style={{ width: '65%', height: 10, borderRadius: 5, backgroundColor: C.border, marginTop: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {[60, 72, 55].map((w, i) => (
            <View key={i} style={{ width: w, height: 26, borderRadius: 13, backgroundColor: C.border }} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── MoodStrip — carousel pager ───────────────────────────────────────────────

function MoodStrip() {
  const { C } = useTheme();
  const { moodPreset, setMood } = useMoodStore();

  const activeIndex = MOODS.indexOf(moodPreset);
  const meta        = MOOD_META[moodPreset];

  // Slide + fade animation on mood change
  const slideX   = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevIdx  = useRef(activeIndex);

  useEffect(() => {
    if (prevIdx.current === activeIndex) return;
    const dir = activeIndex > prevIdx.current ? 1 : -1;
    prevIdx.current = activeIndex;

    Animated.parallel([
      Animated.timing(slideX,   { toValue: -dir * 36, duration: 110, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0,          duration: 90,  useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(dir * 36);
      Animated.parallel([
        Animated.spring(slideX,   { toValue: 0, useNativeDriver: true, speed: 28, bounciness: 6 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 130, useNativeDriver: true }),
      ]).start();
    });
  }, [activeIndex]);

  function goNext() { setMood(MOODS[(activeIndex + 1) % MOODS.length]); }
  function goPrev() { setMood(MOODS[(activeIndex - 1 + MOODS.length) % MOODS.length]); }

  return (
    <View style={[ms.wrapper, { borderBottomColor: C.border }]}>
      {/* Subtle colour wash behind row */}
      <LinearGradient
        colors={[meta.color + '28', meta.color + '06', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      />

      {/* ‹ Prev */}
      <TouchableOpacity onPress={goPrev} style={ms.arrow} activeOpacity={0.55}>
        <Text style={[ms.arrowTxt, { color: C.textSecondary }]}>‹</Text>
      </TouchableOpacity>

      {/* Animated mood info */}
      <Animated.View style={[ms.center, { transform: [{ translateX: slideX }], opacity: fadeAnim }]}>
        <View style={[ms.colourDot, { backgroundColor: meta.color }]} />
        <Text style={ms.emoji}>{meta.icon}</Text>
        <View style={ms.textBlock}>
          <Text style={[ms.moodName, { color: meta.color }]}>{meta.label}</Text>
          <Text style={[ms.moodDesc, { color: C.textSecondary }]} numberOfLines={1}>
            {meta.description}
          </Text>
        </View>
      </Animated.View>

      {/* Progress dots — tap to jump */}
      <View style={ms.dotsRow}>
        {MOODS.map((m, i) => (
          <TouchableOpacity key={m} onPress={() => setMood(MOODS[i])} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <View style={[ms.dot, {
              backgroundColor: i === activeIndex ? meta.color : C.border,
              width: i === activeIndex ? 14 : 5,
            }]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Next › */}
      <TouchableOpacity onPress={goNext} style={ms.arrow} activeOpacity={0.55}>
        <Text style={[ms.arrowTxt, { color: C.textSecondary }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const ms = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderBottomWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  arrow:   { width: 32, alignItems: 'center', justifyContent: 'center' },
  arrowTxt:{ fontSize: 26, lineHeight: 30, fontWeight: '300' },
  center:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  colourDot: { width: 8, height: 8, borderRadius: 4 },
  emoji:   { fontSize: 22 },
  textBlock: { flex: 1, minWidth: 0 },
  moodName:  { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },
  moodDesc:  { fontSize: 10, marginTop: 1 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  dot:     { height: 5, borderRadius: 3 },
});



// ─── StoriesBar ───────────────────────────────────────────────────────────────

function StoriesBar({
  currentUser, myStatus, statuses, onAddStatus, onViewStatus,
}: {
  currentUser: UserProfile;
  myStatus: DriftStatus | null;
  statuses: StatusViewItem[];
  onAddStatus: () => void;
  onViewStatus: (item: StatusViewItem) => void;
}) {
  const { C } = useTheme();

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: spacing.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}>

        {/* My Status bubble */}
        <TouchableOpacity
          style={{ alignItems: 'center', gap: 4, width: 70 }}
          onPress={
            myStatus
              ? () => onViewStatus({ status: myStatus, name: currentUser.name, photoURL: currentUser.photoURL, isMine: true })
              : onAddStatus
          }
          activeOpacity={0.8}
        >
          <View style={{ position: 'relative' }}>
            {myStatus ? (
              <LinearGradient colors={['#FF4B6E', '#6C5CE7']} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: C.background }}>
                  <Avatar name={currentUser.name} photoURL={currentUser.photoURL} size={56} />
                </View>
              </LinearGradient>
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Avatar name={currentUser.name} photoURL={currentUser.photoURL} size={56} />
              </View>
            )}
            {!myStatus && (
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.background }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 16 }}>+</Text>
              </View>
            )}
            {myStatus && (
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 23, height: 23, borderRadius: 12, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border }}>
                <Text style={{ fontSize: 11 }}>{STATUS_TYPE_EMOJI[myStatus.type] ?? '✨'}</Text>
              </View>
            )}
          </View>
          <Text style={{ ...typography.small, color: C.textSecondary, textAlign: 'center', maxWidth: 70 }} numberOfLines={1}>
            {myStatus ? 'My Status' : 'Add Status'}
          </Text>
        </TouchableOpacity>

        {/* Connection statuses */}
        {statuses.map((item) => (
          <TouchableOpacity
            key={item.status.uid}
            style={{ alignItems: 'center', gap: 4, width: 70 }}
            onPress={() => onViewStatus(item)}
            activeOpacity={0.8}
          >
            <View style={{ position: 'relative' }}>
              <LinearGradient colors={['#6C5CE7', '#FF4B6E']} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: C.background }}>
                  <Avatar name={item.name} photoURL={item.photoURL} size={56} />
                </View>
              </LinearGradient>
              <View style={{ position: 'absolute', bottom: -2, right: -2, width: 23, height: 23, borderRadius: 12, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border }}>
                <Text style={{ fontSize: 11 }}>{STATUS_TYPE_EMOJI[item.status.type] ?? '✨'}</Text>
              </View>
            </View>
            <Text style={{ ...typography.small, color: C.textSecondary, textAlign: 'center', maxWidth: 70 }} numberOfLines={1}>
              {item.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── NearYouStrip ─────────────────────────────────────────────────────────────

function NearYouStrip({
  nearYou, activeUids, city, onPress,
}: {
  nearYou: UserProfile[];
  activeUids: Set<string>;
  city: string;
  onPress: (u: UserProfile) => void;
}) {
  const { C, isDark } = useTheme();

  return (
    <LinearGradient
      colors={isDark ? ['#1A0A2E', '#0D1233'] : [C.surface, C.surface]}
      style={{ paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF4B6E' }} />
        <Text style={{ ...typography.small, fontWeight: '800', color: C.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Near You · {city}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {nearYou.map((u) => {
          const active = activeUids.has(u.uid);
          return (
            <TouchableOpacity key={u.uid} style={{ alignItems: 'center', gap: 4, width: 64 }} onPress={() => onPress(u)} activeOpacity={0.8}>
              <View style={{ position: 'relative' }}>
                {active ? (
                  <LinearGradient colors={['#00E676', '#00B4D8']} style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: C.background }}>
                      <Avatar name={u.name} photoURL={u.photoURL} size={50} />
                    </View>
                  </LinearGradient>
                ) : (
                  <Avatar name={u.name} photoURL={u.photoURL} size={54} />
                )}
                {active && (
                  <View style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00E676', borderWidth: 2, borderColor: C.background }} />
                )}
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: C.text, textAlign: 'center', maxWidth: 64 }} numberOfLines={1}>
                {u.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────

function ProfileCard({
  user, currentUser, isActive, onPress, onConnect, mood,
}: {
  user: UserProfile;
  currentUser: UserProfile;
  isActive: boolean;
  onPress: () => void;
  onConnect: () => void;
  onMeet: () => void;
  onEvent: () => void;
  mood: MoodPreset;
}) {
  const { C, isDark } = useTheme();
  const { score: matchPct } = dynamicVibeMatch(currentUser, user, mood);
  const grad      = matchGrad(matchPct);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const interests = (user.interests ?? []).slice(0, 3);

  function handlePressIn() {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.968, useNativeDriver: true, speed: 30 }),
      Animated.timing(glowAnim,  { toValue: 1, duration: 120, useNativeDriver: false }),
    ]).start();
  }
  function handlePressOut() {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 24 }),
      Animated.timing(glowAnim,  { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }

  const borderColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', grad[0] + 'BB'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Animated.View style={[cs.glowWrap, { borderColor, backgroundColor: isDark ? '#15152A' : '#FFFFFF' }]}>
        <TouchableOpacity
          style={cs.card}
          activeOpacity={1}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {/* Left gradient stripe — score indicator */}
          <LinearGradient colors={grad} style={cs.stripe} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />

          {/* Avatar with active ring */}
          <View style={cs.avatarWrap}>
            {isActive ? (
              <LinearGradient colors={['#00E676', '#00CEC9']} style={cs.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={[cs.avatarInner, { backgroundColor: isDark ? '#15152A' : '#FFFFFF' }]}>
                  <Avatar name={user.name} photoURL={user.photoURL} size={50} />
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={[grad[0] + '55', grad[1] + '33']}
                style={cs.avatarRing}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <View style={[cs.avatarInner, { backgroundColor: isDark ? '#15152A' : '#FFFFFF' }]}>
                  <Avatar name={user.name} photoURL={user.photoURL} size={50} />
                </View>
              </LinearGradient>
            )}
            {isActive && <View style={cs.activeDot} />}
          </View>

          {/* Info block */}
          <View style={cs.info}>
            {/* Row 1: name + age + verified + live */}
            <View style={cs.row1}>
              <Text style={[cs.name, { color: C.text }]} numberOfLines={1}>
                {user.name}
                {user.age ? <Text style={[cs.age, { color: C.textSecondary }]}>,  {user.age}</Text> : null}
              </Text>
              {user.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginLeft: 2 }} />
              )}
              {isActive && (
                <View style={cs.livePill}>
                  <View style={cs.liveDot} />
                  <Text style={cs.liveText}>Live</Text>
                </View>
              )}
            </View>

            {/* Row 2: city */}
            {user.city ? (
              <Text style={[cs.cityText, { color: C.textSecondary }]} numberOfLines={1}>
                📍 {user.city}
              </Text>
            ) : null}

            {/* Row 3: interest chips */}
            {interests.length > 0 && (
              <View style={cs.chipsRow}>
                {interests.map((t, i) => (
                  <View
                    key={t}
                    style={[cs.chip, {
                      borderColor: CHIP_PALETTE[i % CHIP_PALETTE.length] + '60',
                      backgroundColor: CHIP_PALETTE[i % CHIP_PALETTE.length] + '1A',
                    }]}
                  >
                    <Text style={[cs.chipTxt, { color: CHIP_PALETTE[i % CHIP_PALETTE.length] }]}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Right column: match % + connect */}
          <View style={cs.right}>
            {matchPct > 0 && (
              <LinearGradient
                colors={matchPct >= 50 ? grad : ['rgba(120,120,120,0.35)', 'rgba(80,80,80,0.35)']}
                style={cs.scorePill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <Text style={cs.scoreText}>{matchPct}%</Text>
              </LinearGradient>
            )}

            <TouchableOpacity onPress={onConnect} activeOpacity={0.8} style={cs.connectBtnWrap}>
              <LinearGradient
                colors={['#FF4B6E', '#C2185B']}
                style={cs.connectBtn}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
                  style={cs.shine}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                />
                <Ionicons name="person-add-outline" size={15} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const cs = StyleSheet.create({
  glowWrap: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 110,
    paddingRight: 12,
    paddingVertical: 10,
    gap: 10,
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
  },

  avatarWrap:  { position: 'relative', marginLeft: 6 },
  avatarRing:  { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden' },
  activeDot:   { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#00E676', borderWidth: 2.5, borderColor: 'rgba(0,0,0,0.5)' },

  info:     { flex: 1, gap: 5, minWidth: 0 },
  row1:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap' },

  name:     { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  age:      { fontSize: 13, fontWeight: '500' },
  cityText: { fontSize: 12, fontWeight: '500' },

  livePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#00E67622', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  liveDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#00E676' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#00E676' },

  chip:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  chipTxt: { fontSize: 10, fontWeight: '700' },

  right:          { alignItems: 'center', gap: 8, paddingLeft: 4 },
  scorePill:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, minWidth: 44, alignItems: 'center' },
  scoreText:      { fontSize: 11.5, fontWeight: '900', color: '#fff' },
  connectBtnWrap: {},
  connectBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.55,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  shine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    borderRadius: 18,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { C, isDark } = useTheme();
  const sc            = makeMainStyles(C);
  const navigation    = useNavigation<NativeStackNavigationProp<DiscoverStackParamList>>();
  const uid           = useAuthStore((s) => s.firebaseUser?.uid);
  const userProfile   = useAuthStore((s) => s.userProfile);
  const moodPreset    = useMoodStore((s) => s.moodPreset);

  const [users, setUsers]               = useState<UserProfile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [feedError, setFeedError]       = useState(false);
  const [search, setSearch]             = useState('');
  const [showSearch, setShowSearch]     = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [myStatus, setMyStatus]         = useState<DriftStatus | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<StatusViewItem[]>([]);
  const [viewingStatus, setViewingStatus] = useState<StatusViewItem | null>(null); // kept for legacy, now navigates to screen
  const [activeUids, setActiveUids]     = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount]   = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeToUnreadCount(uid, setUnreadCount);
  }, [uid]);

  const lastDocRef = useRef<any>(null);
  const hasMoreRef = useRef(true);

  const loadFeed = useCallback(async (reset = false) => {
    if (!uid) return;
    if (reset) {
      setLoading(true);
      setFeedError(false);
      lastDocRef.current = null;
      hasMoreRef.current = true;
    }
    if (!hasMoreRef.current) return;
    try {
      const blockedUids = userProfile?.blockedUsers ?? [];
      const excludeUids = reset ? [...await getInteractedUids(uid), ...blockedUids] : [];
      const { users: newUsers, lastDoc } = await getDiscoverFeed(
        uid, excludeUids, reset ? undefined : lastDocRef.current, 20, userProfile, moodPreset,
      );
      lastDocRef.current = lastDoc;
      hasMoreRef.current = newUsers.length === 20;
      setUsers((prev) => (reset ? newUsers : [...prev, ...newUsers]));
    } catch {
      setFeedError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [uid, userProfile, moodPreset]);

  useEffect(() => { loadFeed(true); }, [loadFeed]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getMyStatus(uid).then(setMyStatus).catch(() => {});
    }, [uid]),
  );

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToConnections(uid, async (connections: Connection[]) => {
      if (connections.length === 0) {
        setConnectionStatuses([]);
        setActiveUids(new Set());
        return;
      }
      const otherUids = connections
        .map((c) => (c.users[0] === uid ? c.users[1] : c.users[0]))
        .slice(0, 15);
      try {
        const statuses = await getActiveStatuses(otherUids);
        setActiveUids(new Set(statuses.map((s) => s.uid)));
        const statusMap = new Map(statuses.map((s) => [s.uid, s]));
        // Only put users WITH an active status into connectionStatuses (for the story ring)
        setConnectionStatuses(
          statuses.map((s) => {
            const found = users.find((u) => u.uid === s.uid);
            return { status: s, name: found?.name ?? s.uid.slice(0, 8), photoURL: found?.photoURL };
          }),
        );
      } catch { /* non-critical */ }
    });
    return unsub;
  }, [uid, users]);


  function handleLoadMore() {
    if (loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    loadFeed(false);
  }

  const filtered = users
    .filter((u) => {
      const interests  = u.interests  ?? [];
      const lookingFor = u.lookingFor ?? [];
      const matchesSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        interests.some((i) => i.toLowerCase().includes(search.toLowerCase())) ||
        (u.vibeProfile?.primaryVibes ?? []).some((v) => v.toLowerCase().includes(search.toLowerCase()));
      let matchesFilter = true;
      if (activeFilter === '🟢 Active') {
        matchesFilter = activeUids.has(u.uid);
      } else if (activeFilter !== 'All') {
        matchesFilter = lookingFor.includes(activeFilter.toLowerCase() as any);
      }
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (!userProfile) return 0;
      return dynamicVibeMatch(userProfile, b, moodPreset).score - dynamicVibeMatch(userProfile, a, moodPreset).score;
    });

  const nearYou = userProfile?.city
    ? users.filter((u) => u.city && u.city.toLowerCase() === (userProfile.city ?? '').toLowerCase()).slice(0, 12)
    : [];

  function handleConnect(user: UserProfile) { navigation.navigate('ConnectRequest', { user }); }
  function handleMeet(user: UserProfile)    { (navigation as any).navigate('MeetupSuggest', { connectedUser: user, connectionId: '' }); }
  function handleEvent(_user: UserProfile)  { (navigation as any).navigate('Events'); }

  return (
    <View style={sc.root}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}
      <SafeAreaView style={sc.flex} edges={['top']}>

        {/* ViewStatus is now a dedicated screen — modal kept for backward compat but unused */}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : [C.background, C.surface]}
          style={sc.header}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          {showSearch ? (
            <View style={sc.searchRow}>
              <View style={sc.searchBox}>
                <Ionicons name="search-outline" size={16} color={C.textSecondary} />
                <TextInput
                  style={sc.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Name, interest or vibe..."
                  placeholderTextColor={C.textSecondary}
                  autoFocus
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={C.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearch(''); }} style={{ paddingLeft: spacing.sm }}>
                <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14 }}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View>
                <Text style={sc.headerTitle}>Drift</Text>
                <Text style={sc.headerSub}>Discover your people</Text>
              </View>
              <View style={sc.headerActions}>
                <TouchableOpacity style={sc.iconBtn} onPress={() => setShowSearch(true)}>
                  <Ionicons name="search-outline" size={20} color={C.text} />
                </TouchableOpacity>
                <TouchableOpacity style={sc.iconBtn} onPress={() => navigation.navigate('ShakeShare')}>
                  <Ionicons name="people-outline" size={20} color={C.text} />
                </TouchableOpacity>
                <TouchableOpacity style={sc.iconBtn} onPress={() => navigation.navigate('QRScanner')}>
                  <Ionicons name="qr-code-outline" size={20} color={C.text} />
                </TouchableOpacity>
                <TouchableOpacity style={sc.bellBtn} onPress={() => navigation.navigate('Notifications')}>
                  <Ionicons name="notifications-outline" size={22} color={C.text} />
                  {unreadCount > 0 && (
                    <View style={sc.bellBadge}>
                      <Text style={sc.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={sc.iconBtn} onPress={() => navigation.navigate('Connections')}>
                  <Ionicons name="git-network-outline" size={20} color={C.text} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </LinearGradient>

        {/* ── Stories + Mood ─────────────────────────────────────────────────── */}
        {userProfile && (
          <StoriesBar
            currentUser={userProfile}
            myStatus={myStatus}
            statuses={connectionStatuses}
            onAddStatus={() => navigation.navigate('StatusCreate', undefined)}
            onViewStatus={(item) => navigation.navigate('ViewStatus', {
              status: item.status,
              name: item.name,
              photoURL: item.photoURL,
              isMine: item.isMine ?? false,
            })}
          />
        )}
        <MoodStrip />

        {/* ── Filter chips ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingVertical: 10, alignItems: 'center' }}
          style={{ borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.background }}
        >
          {INTENT_FILTERS.map(({ key, label, emoji, color }) => {
            const active = activeFilter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveFilter(key)}
                activeOpacity={0.75}
                style={{
                  height: 36,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  backgroundColor: active ? color : C.surface,
                  borderWidth: 1.5,
                  borderColor: active ? color : C.border,
                }}
              >
                <Text style={{ fontSize: 14, lineHeight: 18 }}>{emoji}</Text>
                <Text style={{
                  fontSize: 13,
                  fontWeight: active ? '700' : '500',
                  color: active ? '#fff' : C.textSecondary,
                  letterSpacing: -0.1,
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Near You ───────────────────────────────────────────────────────── */}
        {!loading && nearYou.length > 0 && !search && (
          <NearYouStrip
            nearYou={nearYou}
            activeUids={activeUids}
            city={userProfile?.city ?? ''}
            onPress={(u) => navigation.navigate('ProfileDetail', { user: u })}
          />
        )}

        {/* ── Feed ───────────────────────────────────────────────────────────── */}
        {loading ? (
          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </ScrollView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={sc.feedList}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeed(true); }} tintColor={C.primary} colors={[C.primary]} />
            }
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListEmptyComponent={
              feedError ? (
                <EmptyState emoji="📡" title="Could not load people" subtitle="Check your connection and tap retry.">
                  <TouchableOpacity style={sc.retryBtn} onPress={() => loadFeed(true)}>
                    <Text style={sc.retryText}>Try Again</Text>
                  </TouchableOpacity>
                </EmptyState>
              ) : (
                <EmptyState emoji="🌊" title="No one here yet" subtitle="Check back soon — more people are joining Drift every day." />
              )
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={C.primary} style={{ paddingVertical: spacing.lg }} /> : null}
            renderItem={({ item }) =>
              userProfile ? (
                <ProfileCard
                  user={item}
                  currentUser={userProfile}
                  isActive={activeUids.has(item.uid)}
                  mood={moodPreset}
                  onPress={() => navigation.navigate('ProfileDetail', { user: item })}
                  onConnect={() => handleConnect(item)}
                  onMeet={() => handleMeet(item)}
                  onEvent={() => handleEvent(item)}
                />
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeMainStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.background },
    flex:    { flex: 1 },
    feedList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 100 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: '#ffffff10',
    },
    headerTitle:   { ...typography.h2, color: C.primary, fontWeight: '800', letterSpacing: -1 },
    headerSub:     { ...typography.small, color: C.textSecondary, marginTop: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    bellBtn: { position: 'relative', padding: 4 },
    bellBadge: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: C.background },
    bellBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },

    searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: C.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 9, borderWidth: 1, borderColor: C.border },
    searchInput: { flex: 1, ...typography.body, color: C.text, padding: 0 },

    retryBtn: { marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, backgroundColor: C.primary, borderRadius: radius.full, alignSelf: 'center' },
    retryText: { ...typography.body, color: '#fff', fontWeight: '600' },
  });
}
