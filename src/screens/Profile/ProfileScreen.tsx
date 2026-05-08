import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../../components/Avatar';
import { spacing, typography, radius } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { ProfileStackParamList, Post, PostType } from '../../types';
import { getPosts, subscribeToConnections, checkDailyLoginAndUpdateStreak } from '../../utils/firestore-helpers';
import { hapticSuccess } from '../../utils/haptics';

const SCREEN_W   = Dimensions.get('window').width;
const GRID_CELL  = (SCREEN_W - spacing.lg * 2 - spacing.xs * 2) / 3;
const COVER_H    = 168;
const AVATAR_SZ  = 112;

const HERO_GRADS: ReadonlyArray<readonly [string, string]> = [
  ['#FF4B6E', '#FF8C42'],
  ['#6C5CE7', '#A855F7'],
  ['#0984E3', '#00B4D8'],
  ['#00B894', '#00CEC9'],
  ['#E17055', '#FDCB6E'],
  ['#FF6B81', '#C2185B'],
  ['#A29BFE', '#6C5CE7'],
  ['#55EFC4', '#0984E3'],
];

function nameToHeroGrad(name: string): readonly [string, string, string] {
  let hash = 0;
  for (let i = 0; i < (name ?? '').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const [a, b] = HERO_GRADS[Math.abs(hash) % HERO_GRADS.length];
  return [a, b, '#00000066'] as const;
}

const POST_TYPE_ICON: Record<PostType, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  text:        { name: 'text-outline',         color: '#6C5CE7' },
  image:       { name: 'image-outline',         color: '#0984E3' },
  thread:      { name: 'list-outline',          color: '#E17055' },
  poll:        { name: 'stats-chart-outline',   color: '#00B894' },
  moment:      { name: 'camera-outline',        color: '#0984E3' },
  memory:      { name: 'star-outline',          color: '#FDCB6E' },
  vibe:        { name: 'sparkles-outline' as any, color: '#6C5CE7' },
  question:    { name: 'help-circle-outline',   color: '#E17055' },
  achievement: { name: 'trophy-outline',        color: '#FDCB6E' },
};

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

const LOOKING_FOR_LABELS: Record<string, string> = {
  friends:    'Friends',
  dating:     'Dating',
  networking: 'Networking',
  events:     'Events',
};

const LOOKING_FOR_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  friends:    'people-outline',
  dating:     'heart-outline',
  networking: 'briefcase-outline',
  events:     'calendar-outline',
};

// ─── Profile strength criteria ────────────────────────────────────────────────

interface StrengthCriterion {
  key: string;
  label: string;
  description: string;
  points: number;
  done: boolean;
  action: string;
  screen?: keyof ProfileStackParamList;
}

function buildCriteria(profile: NonNullable<import('../../types').UserProfile>): StrengthCriterion[] {
  return [
    {
      key: 'name',
      label: 'Real name',
      description: 'Add your full name so people know who you are',
      points: 10,
      done: (profile.name ?? '').trim().length >= 2,
      action: 'Edit Profile',
      screen: 'EditProfile',
    },
    {
      key: 'bio',
      label: 'Write a bio',
      description: 'At least 20 characters — make it interesting!',
      points: 10,
      done: (profile.bio ?? '').trim().length >= 20,
      action: 'Add Bio',
      screen: 'EditProfile',
    },
    {
      key: 'photo',
      label: 'Add a photo',
      description: 'Profiles with photos get 3× more connections',
      points: 15,
      done: (profile.photos ?? []).length >= 1,
      action: 'Upload Photo',
      screen: 'EditProfile',
    },
    {
      key: 'photos3',
      label: '3+ photos',
      description: 'More photos = more trust and connections',
      points: 10,
      done: (profile.photos ?? []).length >= 3,
      action: 'Add More Photos',
      screen: 'EditProfile',
    },
    {
      key: 'city',
      label: 'Add your city',
      description: 'Find people near you for local meetups',
      points: 8,
      done: !!(profile.city ?? '').trim(),
      action: 'Add City',
      screen: 'EditProfile',
    },
    {
      key: 'college',
      label: 'College or workplace',
      description: 'Connect with people from your institution',
      points: 7,
      done: !!(profile.college ?? '').trim() || !!(profile.work ?? '').trim(),
      action: 'Add Details',
      screen: 'EditProfile',
    },
    {
      key: 'interests',
      label: '3+ interests',
      description: 'Better matches are made through shared interests',
      points: 10,
      done: (profile.interests ?? []).length >= 3,
      action: 'Pick Interests',
      screen: 'EditProfile',
    },
    {
      key: 'vibe',
      label: 'Complete Vibe Quiz',
      description: 'Unlocks personality-based matching',
      points: 10,
      done: !!profile.vibeProfile?.primaryVibes?.length,
      action: 'Take Quiz',
      screen: 'VibeQuiz',
    },
    {
      key: 'driftId',
      label: 'Set your @handle',
      description: 'Custom Drift ID makes your profile shareable',
      points: 10,
      done: !!(profile.driftId ?? '').trim(),
      action: 'Set Handle',
      screen: 'DriftId',
    },
  ];
}

function calcLiveCompleteness(profile: NonNullable<import('../../types').UserProfile>): number {
  return buildCriteria(profile).reduce((acc, c) => acc + (c.done ? c.points : 0), 10);
}

// ─── Profile Strength Modal ───────────────────────────────────────────────────

function ProfileStrengthModal({
  visible,
  onClose,
  pct,
  criteria,
  onNavigate,
  C,
}: {
  visible: boolean;
  onClose: () => void;
  pct: number;
  criteria: StrengthCriterion[];
  onNavigate: (screen: keyof ProfileStackParamList) => void;
  C: AppColors;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY     = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => g.dy > 0,
      onMoveShouldSetPanResponder:  (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.8) {
          onClose();
          dragY.setValue(0);
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 14 }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const color = pct >= 80 ? C.success : pct >= 50 ? '#FDCB6E' : C.primary;
  const label = pct >= 80 ? 'Strong' : pct >= 50 ? 'Good' : 'Getting started';
  const totalPossible = criteria.reduce((s, c) => s + c.points, 10);
  const earned = criteria.reduce((s, c) => s + (c.done ? c.points : 0), 10);
  const pending = criteria.filter((c) => !c.done);
  const done = criteria.filter((c) => c.done);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} accessibilityViewIsModal>
      <TouchableOpacity style={ms.backdrop} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <Animated.View
        style={[
          ms.sheet,
          { backgroundColor: C.surface, borderColor: C.border },
          {
            transform: [
              { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
              { translateY: dragY },
            ],
          },
        ]}
      >
        {/* Handle + drag zone */}
        <Animated.View {...panResponder.panHandlers} style={ms.dragZone}>
          <View style={ms.handle} />
        </Animated.View>

        {/* Header */}
        <View style={ms.sheetHeader}>
          <View>
            <Text style={[ms.sheetTitle, { color: C.text }]}>Profile Strength</Text>
            <Text style={[ms.sheetSub, { color: C.textSecondary }]}>
              {earned + 10} / {totalPossible + 10} points · {label}
            </Text>
          </View>
          <View style={[ms.pctCircle, { borderColor: color }]}>
            <Text style={[ms.pctText, { color }]}>{pct}%</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[ms.track, { backgroundColor: C.border }]}>
          <View style={[ms.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>

        <ScrollView style={ms.scroll} showsVerticalScrollIndicator={false}>
          {/* Pending items */}
          {pending.length > 0 && (
            <>
              <Text style={[ms.groupLabel, { color: C.textSecondary }]}>Complete to boost your score</Text>
              {pending.map((c) => (
                <View key={c.key} style={[ms.criterionRow, { borderBottomColor: C.border }]}>
                  <View style={[ms.dotPending, { backgroundColor: `${C.primary}20`, borderColor: `${C.primary}40` }]}>
                    <Ionicons name="add" size={14} color={C.primary} />
                  </View>
                  <View style={ms.criterionInfo}>
                    <Text style={[ms.criterionLabel, { color: C.text }]}>{c.label}
                      <Text style={[ms.criterionPoints, { color: C.primary }]}>  +{c.points} pts</Text>
                    </Text>
                    <Text style={[ms.criterionDesc, { color: C.textSecondary }]}>{c.description}</Text>
                  </View>
                  {c.screen && (
                    <TouchableOpacity
                      style={[ms.fixBtn, { backgroundColor: `${C.primary}15`, borderColor: `${C.primary}30` }]}
                      onPress={() => { onClose(); setTimeout(() => onNavigate(c.screen!), 300); }}
                    >
                      <Text style={[ms.fixBtnText, { color: C.primary }]}>{c.action}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Done items */}
          {done.length > 0 && (
            <>
              <Text style={[ms.groupLabel, { color: C.textSecondary, marginTop: spacing.md }]}>Completed</Text>
              {done.map((c) => (
                <View key={c.key} style={[ms.criterionRow, { borderBottomColor: C.border, opacity: 0.6 }]}>
                  <View style={[ms.dotDone, { backgroundColor: `${C.success}20` }]}>
                    <Ionicons name="checkmark" size={14} color={C.success} />
                  </View>
                  <View style={ms.criterionInfo}>
                    <Text style={[ms.criterionLabel, { color: C.text }]}>{c.label}</Text>
                  </View>
                  <Text style={[ms.donePoints, { color: C.success }]}>+{c.points}</Text>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  dragZone: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ccc' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.sm,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSub:   { fontSize: 13, marginTop: 2 },
  pctCircle: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  pctText: { fontSize: 18, fontWeight: '900' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.lg },
  fill:  { height: 8, borderRadius: 4 },
  scroll: { flex: 1 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs },
  criterionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dotPending: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  dotDone: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  criterionInfo: { flex: 1 },
  criterionLabel: { fontSize: 14, fontWeight: '600' },
  criterionPoints: { fontSize: 13, fontWeight: '700' },
  criterionDesc: { fontSize: 12, marginTop: 2 },
  fixBtn: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.full, borderWidth: 1,
    minHeight: 44, justifyContent: 'center',
  },
  fixBtnText: { fontSize: 12, fontWeight: '700' },
  donePoints: { fontSize: 13, fontWeight: '700' },
});

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, color, onPress, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string | number;
  label: string;
  color: string;
  onPress?: () => void;
  C: AppColors;
}) {
  const styles = makeStyles(C);
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderColor: `${color}25`, backgroundColor: `${color}08` }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({
  icon, label, onPress, color, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color: string;
  C: AppColors;
}) {
  const styles = makeStyles(C);
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}15`, borderColor: `${color}25` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Settings Row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, onPress, tint, danger, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  tint?: string;
  danger?: boolean;
  C: AppColors;
}) {
  const styles = makeStyles(C);
  const c = danger ? C.error : (tint ?? C.text);
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingsIconBox, { backgroundColor: `${c}12` }]}>
        <Ionicons name={icon} size={18} color={c} />
      </View>
      <Text style={[styles.settingsLabel, danger && { color: C.error }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />}
    </TouchableOpacity>
  );
}

// ─── Daily Streak Banner ──────────────────────────────────────────────────────

function DailyStreakBanner({
  coins, streak, onDismiss, C,
}: {
  coins: number; streak: number; onDismiss: () => void; C: AppColors;
}) {
  const slideY = useRef(new Animated.Value(-80)).current;
  const styles = makeStyles(C);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
  }, []);

  function dismiss() {
    Animated.timing(slideY, { toValue: -80, duration: 250, useNativeDriver: true }).start(onDismiss);
  }

  const isStreak7  = streak > 0 && streak % 7 === 0;
  const bonusCoins = isStreak7 ? 75 : 0;

  return (
    <Animated.View style={[styles.streakBanner, { transform: [{ translateY: slideY }] }]}>
      <LinearGradient colors={['#FF4B6E', '#FF8C42']} style={styles.streakBannerGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={styles.streakBannerLeft}>
          <Ionicons name="flame" size={22} color="#fff" />
          <View>
            <Text style={styles.streakBannerTitle}>Day {streak} Streak!</Text>
            <Text style={styles.streakBannerSub}>
              +{coins} coins earned{bonusCoins > 0 ? ` · ${bonusCoins} streak bonus!` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { userProfile, firebaseUser, reset, setUserProfile: setStoreProfile } = useAuthStore();
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [loggingOut,       setLoggingOut]       = useState(false);
  const [myPosts,          setMyPosts]          = useState<Post[]>([]);
  const [postsLoading,     setPostsLoading]     = useState(false);
  const [connCount,        setConnCount]        = useState(0);
  const [strengthVisible,  setStrengthVisible]  = useState(false);
  const [streakReward,     setStreakReward]      = useState<{ coins: number; streak: number } | null>(null);

  const uid = firebaseUser?.uid ?? '';

  useEffect(() => {
    if (!uid || !userProfile) return;
    setPostsLoading(true);
    getPosts(uid)
      .then((p) => setMyPosts(p))
      .catch(() => {})
      .finally(() => setPostsLoading(false));

    const unsub = subscribeToConnections(uid, (list) => setConnCount(list.length));

    // Daily streak check — only runs if last login wasn't today
    const today = new Date().toISOString().slice(0, 10);
    if (userProfile.streak?.lastLoginDate !== today) {
      checkDailyLoginAndUpdateStreak(uid, {
        coins: userProfile.coins ?? 0,
        streak: userProfile.streak ?? { current: 0, longest: 0, lastLoginDate: '' },
      }).then(({ coins, streak }) => {
        setStoreProfile({ ...userProfile, coins, streak });
        hapticSuccess();
        setStreakReward({ coins: coins - (userProfile.coins ?? 0), streak: streak.current });
      }).catch(() => {});
    }

    return unsub;
  }, [uid]);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await signOut(auth); reset(); }
          catch { Alert.alert('Error', 'Failed to sign out.'); }
          finally { setLoggingOut(false); }
        },
      },
    ]);
  }

  if (!userProfile) return null;

  const insets   = useSafeAreaInsets();
  const streak   = userProfile.streak ?? { current: 0, longest: 0, lastLoginDate: '' };
  const coins    = userProfile.coins ?? 0;
  const hasVibe  = !!userProfile.vibeProfile?.primaryVibes?.length;
  const liveCompleteness = calcLiveCompleteness(userProfile);
  const criteria = buildCriteria(userProfile);
  const color    = liveCompleteness >= 80 ? C.success : liveCompleteness >= 50 ? '#FDCB6E' : C.primary;
  const isPremium = !!userProfile.isPremium;
  const heroGrad  = nameToHeroGrad(userProfile.name ?? 'Drift');

  return (
    <View style={styles.flex}>
      {/* ── Daily streak banner ── */}
      {streakReward && (
        <DailyStreakBanner
          coins={streakReward.coins}
          streak={streakReward.streak}
          onDismiss={() => setStreakReward(null)}
          C={C}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── Hero Cover ── */}
        <View style={styles.heroCoverWrap}>
          <LinearGradient
            colors={heroGrad}
            style={[styles.heroCover, { paddingTop: insets.top + 8 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Top-right action buttons */}
            <View style={styles.heroTopActions}>
              <TouchableOpacity
                style={styles.heroIconBtn}
                onPress={() => navigation.navigate('ProfileShare')}
                accessibilityLabel="Share profile"
              >
                <Ionicons name="share-social-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroIconBtn}
                onPress={() => navigation.navigate('Settings')}
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Floating avatar — overlaps cover bottom */}
          <View style={styles.heroAvatarWrap}>
            <Avatar
              name={userProfile.name}
              photoURL={userProfile.photoURL}
              size={AVATAR_SZ}
              frame={isPremium ? 'premium' : 'glow'}
              showStatus
              statusColor="#00B894"
            />
            {userProfile.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* ── Identity info ── */}
        <View style={styles.heroInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {userProfile.name}{userProfile.age ? `, ${userProfile.age}` : ''}
            </Text>
            {isPremium && <Ionicons name="star" size={15} color="#FFD700" style={{ marginLeft: 4 }} />}
          </View>

          {userProfile.driftId && (
            <TouchableOpacity onPress={() => navigation.navigate('DriftId')}>
              <Text style={[styles.driftHandle, { color: C.primary }]}>@{userProfile.driftId}</Text>
            </TouchableOpacity>
          )}

          {/* Location / college meta row */}
          <View style={styles.metaRow}>
            {!!userProfile.city && (
              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={12} color={C.textSecondary} />
                <Text style={styles.metaText}>{userProfile.city}</Text>
              </View>
            )}
            {!!(userProfile.college || userProfile.work) && (
              <View style={styles.metaChip}>
                <Ionicons
                  name={userProfile.college ? 'school-outline' : 'briefcase-outline'}
                  size={12}
                  color={C.textSecondary}
                />
                <Text style={styles.metaText}>{userProfile.college ?? userProfile.work}</Text>
              </View>
            )}
          </View>

          {/* Looking-for chips */}
          {(userProfile.lookingFor ?? []).length > 0 && (
            <View style={styles.lookingForRow}>
              {(userProfile.lookingFor ?? []).map((item) => (
                <View key={item} style={styles.lfChip}>
                  <Ionicons name={LOOKING_FOR_ICONS[item] ?? 'heart-outline'} size={12} color={C.primary} />
                  <Text style={styles.lfChipText}>{LOOKING_FOR_LABELS[item] ?? item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Edit + Share buttons */}
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.heroActionBtn, { backgroundColor: C.primary }]}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={15} color="#fff" />
              <Text style={styles.heroActionBtnTextPrimary}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroActionBtn, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}
              onPress={() => navigation.navigate('ProfileShare')}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social-outline" size={15} color={C.text} />
              <Text style={[styles.heroActionBtnText, { color: C.text }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Premium banner ── */}
        {isPremium && (
          <View style={styles.premiumBanner}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.premiumBannerText}>Drift Premium · Active</Text>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>PRO</Text>
            </View>
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCard icon="flame"   value={streak.current} label="Streak"      color="#FF4B6E" C={C} />
          <StatCard icon="people"  value={connCount}      label="Connections" color="#6C5CE7" C={C} />
          <StatCard
            icon="flash"
            value={coins}
            label="Coins"
            color="#FDCB6E"
            C={C}
            onPress={() => navigation.navigate('CoinShop')}
          />
          <StatCard icon="trophy"  value={streak.longest} label="Best"        color="#00B894" C={C} />
        </View>

        {/* ── Profile Strength (clickable) ── */}
        <TouchableOpacity
          style={styles.completenessCard}
          onPress={() => setStrengthVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.completenessTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.completenessTitle}>Profile Strength</Text>
              <Text style={styles.completenessTip}>
                {liveCompleteness >= 80
                  ? 'You\'re fully set up — looking great!'
                  : `${criteria.filter((c) => !c.done).length} steps left to max out`}
              </Text>
            </View>
            <View style={styles.completenessRight}>
              <Text style={[styles.completenessPct, { color }]}>{liveCompleteness}%</Text>
              <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
            </View>
          </View>
          <View style={styles.completenessTrack}>
            <View style={[styles.completenessFill, { width: `${liveCompleteness}%`, backgroundColor: color }]} />
          </View>
          <Text style={[styles.completenessHint, { color: C.textSecondary }]}>
            Tap to see improvement steps
          </Text>
        </TouchableOpacity>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="add-circle-outline"
            label="Post"
            onPress={() => (navigation as any).navigate('Feed', { screen: 'CreatePost' })}
            color={C.primary}
            C={C}
          />
          <QuickAction
            icon="images-outline"
            label="Memories"
            onPress={() => navigation.navigate('ViewMemories')}
            color="#6C5CE7"
            C={C}
          />
          <QuickAction
            icon={hasVibe ? 'refresh-outline' : 'sparkles-outline' as any}
            label={hasVibe ? 'Vibe' : 'Vibe Quiz'}
            onPress={() => navigation.navigate('VibeQuiz')}
            color="#00B894"
            C={C}
          />
          <QuickAction
            icon="flash-outline"
            label="Get Coins"
            onPress={() => navigation.navigate('CoinShop')}
            color="#FDCB6E"
            C={C}
          />
          <QuickAction
            icon="qr-code-outline"
            label="Share"
            onPress={() => navigation.navigate('ProfileShare')}
            color="#E17055"
            C={C}
          />
        </View>

        {/* ── Vibe Profile ── */}
        {hasVibe && userProfile.vibeProfile ? (
          <View style={styles.vibeCard}>
            <View style={styles.vibeCardHeader}>
              <Ionicons name="pulse-outline" size={18} color={C.secondary} />
              <Text style={styles.vibeCardTitle}>Your Drift Vibe</Text>
              <TouchableOpacity onPress={() => navigation.navigate('VibeQuiz')} style={styles.vibeRetake}>
                <Text style={styles.vibeRetakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.vibeChipsRow}>
              {(userProfile.vibeProfile.primaryVibes ?? []).map((v) => (
                <View key={v} style={styles.vibeChip}>
                  <Text style={styles.vibeChipText}>{v}</Text>
                </View>
              ))}
            </View>
            {(userProfile.vibeProfile.musicTaste ?? []).length > 0 && (
              <View style={styles.vibeExtraRow}>
                <Ionicons name="musical-notes-outline" size={14} color={C.textSecondary} />
                <Text style={styles.vibeExtraText}>
                  {(userProfile.vibeProfile.musicTaste ?? []).join(' · ')}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.quizCta} onPress={() => navigation.navigate('VibeQuiz')} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={28} color={C.primary} />
            <View style={styles.quizCtaText}>
              <Text style={styles.quizCtaTitle}>Take the Vibe Quiz</Text>
              <Text style={styles.quizCtaSub}>7 quick questions · unlocks better matches</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.primary} />
          </TouchableOpacity>
        )}

        {/* ── Bio ── */}
        {!!userProfile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{userProfile.bio}</Text>
          </View>
        )}

        {/* ── Interests ── */}
        {(userProfile.interests ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.chips}>
              {(userProfile.interests ?? []).map((interest) => (
                <View key={interest} style={styles.chip}>
                  <Text style={styles.chipText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── My Posts ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Posts</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{myPosts.length}</Text>
            </View>
          </View>
          {postsLoading ? (
            <ActivityIndicator color={C.primary} size="small" style={{ marginVertical: spacing.md }} />
          ) : myPosts.length === 0 ? (
            <TouchableOpacity
              style={styles.noPostsCta}
              onPress={() => (navigation as any).navigate('Feed', { screen: 'CreatePost' })}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={22} color={C.textSecondary} />
              <Text style={styles.noPostsText}>Share your first moment</Text>
              <Ionicons name="chevron-forward" size={18} color={C.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.postsGrid}>
              {myPosts.slice(0, 9).map((post) => (
                <View key={post.id} style={styles.postCell}>
                  {post.mediaURL ? (
                    <Image source={{ uri: post.mediaURL }} style={styles.postCellImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.postCellText, { backgroundColor: `${C.primary}10` }]}>
                      <Ionicons
                        name={POST_TYPE_ICON[post.type ?? post.postType ?? 'text']?.name ?? 'text-outline'}
                        size={20}
                        color={POST_TYPE_ICON[post.type ?? post.postType ?? 'text']?.color ?? C.primary}
                      />
                      <Text style={styles.postCellCaption} numberOfLines={3}>{post.caption}</Text>
                    </View>
                  )}
                  {(post.likes?.length ?? 0) > 0 && (
                    <View style={styles.postBadge}>
                      <Ionicons name="heart" size={9} color="#fff" />
                      <Text style={styles.postBadgeText}>{post.likes.length}</Text>
                    </View>
                  )}
                </View>
              ))}
              {myPosts.length > 9 && (
                <View style={[styles.postCell, styles.moreCellOverlay]}>
                  <Text style={styles.moreCellText}>+{myPosts.length - 9}</Text>
                  <Text style={styles.moreCellSub}>more</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Drift Coins Card ── */}
        <TouchableOpacity
          style={styles.coinsCard}
          onPress={() => navigation.navigate('CoinShop')}
          activeOpacity={0.88}
        >
          <View style={styles.coinsRow}>
            <View style={styles.coinsLeft}>
              <Ionicons name="flash" size={20} color="#D4A017" />
              <Text style={styles.coinsTitle}>Drift Coins</Text>
            </View>
            <View style={styles.coinsBadge}>
              <Text style={styles.coinsBalance}>{coins} coins</Text>
            </View>
          </View>
          <Text style={styles.coinsDesc}>
            Earn free coins daily. Spend on boosts, super likes, and story highlights.
          </Text>
          <View style={styles.earnRow}>
            {[
              { icon: 'sunny-outline' as const, text: '+10 daily',    color: '#FDCB6E' },
              { icon: 'flame-outline' as const, text: '+75 streak',   color: '#FF4B6E' },
              { icon: 'people-outline' as const,text: '+20 connect',  color: '#6C5CE7' },
              { icon: 'game-controller-outline' as const, text: '+15 game win', color: '#00B894' },
            ].map((h) => (
              <View key={h.text} style={[styles.earnChip, { backgroundColor: `${h.color}15` }]}>
                <Ionicons name={h.icon} size={11} color={h.color} />
                <Text style={[styles.earnChipText, { color: h.color }]}>{h.text}</Text>
              </View>
            ))}
          </View>
          <View style={styles.coinsShopBtn}>
            <Ionicons name="storefront-outline" size={14} color={C.primary} />
            <Text style={[styles.coinsShopText, { color: C.primary }]}>Open Coin Shop →</Text>
          </View>
        </TouchableOpacity>

        {/* ── Drift Premium upsell (if not premium) ── */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.premiumCard}
            onPress={() => navigation.navigate('CoinShop')}
            activeOpacity={0.88}
          >
            <View style={styles.premiumCardLeft}>
              <Ionicons name="star" size={22} color="#FFD700" />
              <View>
                <Text style={styles.premiumCardTitle}>Drift Premium</Text>
                <Text style={styles.premiumCardSub}>Unlimited boosts · Super likes · No ads</Text>
              </View>
            </View>
            <View style={styles.premiumCardBadge}>
              <Text style={styles.premiumCardBadgeText}>₹149/mo</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Settings ── */}
        <View style={styles.settingsCard}>
          <SettingsRow icon="settings-outline"            label="Settings"        tint={C.secondary}  onPress={() => navigation.navigate('Settings')}        C={C} />
          <SettingsRow icon="time-outline"                label="Coin History"    tint="#FDCB6E"       onPress={() => navigation.navigate('CoinHistory')}     C={C} />
          <SettingsRow icon="shield-checkmark-outline"    label="Privacy"         tint="#6C5CE7"       onPress={() => navigation.navigate('PrivacySettings')} C={C} />
          <SettingsRow icon="chatbubble-ellipses-outline" label="Send Feedback"   tint="#00E676"       onPress={() => navigation.navigate('Feedback')}        C={C} />
          <SettingsRow icon="log-out-outline"             label={loggingOut ? 'Signing out…' : 'Sign Out'} danger onPress={handleLogout} C={C} />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Profile Strength Modal ── */}
      <ProfileStrengthModal
        visible={strengthVisible}
        onClose={() => setStrengthVisible(false)}
        pct={liveCompleteness}
        criteria={criteria}
        onNavigate={(screen) => navigation.navigate(screen as any)}
        C={C}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: C.border,
      backgroundColor: C.background,
    },
    headerTitle:   { ...typography.heading, color: C.text },
    headerActions: { flexDirection: 'row', gap: spacing.sm },
    headerIconBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    editIconBtn: {
      backgroundColor: `${C.primary}10`,
      borderColor: `${C.primary}30`,
    },

    container: { paddingHorizontal: spacing.lg, paddingBottom: 100 },

    // ── Hero cover ──
    heroCoverWrap: {
      marginHorizontal: -spacing.lg,
      marginBottom: AVATAR_SZ / 2,
    },
    heroCover: {
      height: COVER_H,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
    },
    heroTopActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    heroIconBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.28)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroAvatarWrap: {
      position: 'absolute',
      bottom: -AVATAR_SZ / 2,
      left: 0, right: 0,
      alignItems: 'center',
    },
    verifiedBadge: {
      position: 'absolute',
      bottom: AVATAR_SZ / 2 - 14,
      right: SCREEN_W / 2 - AVATAR_SZ / 2 - 2,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#00B894',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: C.background,
    },
    heroInfo: {
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: 4,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: 2,
    },
    metaChip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
    },
    metaText: { ...typography.caption, color: C.textSecondary, fontSize: 12 },
    heroActions: {
      flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm,
    },
    heroActionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderRadius: radius.full,
      minHeight: 44, justifyContent: 'center',
    },
    heroActionBtnTextPrimary: { fontSize: 14, fontWeight: '700', color: '#fff' },
    heroActionBtnText:        { fontSize: 14, fontWeight: '700' },

    // Streak banner
    streakBanner: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    },
    streakBannerGrad: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    streakBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    streakBannerTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
    streakBannerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

    // Premium banner
    premiumBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      backgroundColor: '#FFD70018', borderWidth: 1, borderColor: '#FFD70040',
      borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    premiumBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#D4A017' },
    premiumBadge: {
      backgroundColor: '#FFD700', paddingHorizontal: 8,
      paddingVertical: 2, borderRadius: radius.full,
    },
    premiumBadgeText: { fontSize: 10, fontWeight: '900', color: '#000' },

    nameRow:     { flexDirection: 'row', alignItems: 'center' },
    name:        { ...typography.title, color: C.text, fontWeight: '800', fontSize: 22 },
    driftHandle: { fontSize: 14, fontWeight: '600', marginTop: -2 },
    lookingForRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xs },
    lfChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: `${C.primary}12`,
      paddingHorizontal: spacing.sm, paddingVertical: 4,
      borderRadius: radius.full, borderWidth: 1, borderColor: `${C.primary}25`,
    },
    lfChipText: { ...typography.small, color: C.primary, fontWeight: '600' },

    // Stats
    statsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
    statCard: {
      flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
      borderRadius: radius.md, borderWidth: 1, gap: 2,
    },
    statValue: { ...typography.body, fontWeight: '800', fontSize: 18 },
    statLabel: { ...typography.small, color: C.textSecondary, fontSize: 10 },

    // Completeness
    completenessCard: {
      backgroundColor: C.surface, borderRadius: radius.md,
      padding: spacing.md, marginBottom: spacing.md,
      borderWidth: 1, borderColor: C.border,
    },
    completenessTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
    completenessTitle:{ ...typography.caption, fontWeight: '700', color: C.text },
    completenessTip:  { ...typography.small, color: C.textSecondary, marginTop: 2 },
    completenessRight:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
    completenessPct:  { ...typography.heading, fontWeight: '800', fontSize: 22 },
    completenessTrack:{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
    completenessFill: { height: 6, borderRadius: 3 },
    completenessHint: { ...typography.small, marginTop: 6, textAlign: 'right' },

    // Quick actions
    quickActionsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' },
    quickAction:     { flex: 1, minWidth: 56, alignItems: 'center', gap: spacing.xs },
    quickActionIcon: {
      width: 52, height: 52, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1,
    },
    quickActionLabel: { ...typography.small, color: C.text, fontWeight: '500', textAlign: 'center', fontSize: 11 },

    // Vibe card
    vibeCard: {
      backgroundColor: `${C.secondary}08`,
      borderRadius: radius.md, borderWidth: 1, borderColor: `${C.secondary}25`,
      padding: spacing.md, marginBottom: spacing.md,
    },
    vibeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    vibeCardTitle:  { ...typography.body, fontWeight: '700', color: C.text, flex: 1 },
    vibeRetake:     { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, backgroundColor: `${C.secondary}15` },
    vibeRetakeText: { ...typography.small, color: C.secondary, fontWeight: '600' },
    vibeChipsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
    vibeChip:       { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full, backgroundColor: `${C.secondary}20` },
    vibeChipText:   { ...typography.small, color: C.secondary, fontWeight: '600' },
    vibeExtraRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    vibeExtraText:  { ...typography.small, color: C.textSecondary },

    quizCta: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md,
      backgroundColor: `${C.primary}08`, borderWidth: 1, borderColor: `${C.primary}25`,
    },
    quizCtaText:  { flex: 1 },
    quizCtaTitle: { ...typography.body, fontWeight: '700', color: C.primary },
    quizCtaSub:   { ...typography.small, color: C.textSecondary, marginTop: 2 },

    // Sections
    section:       { marginBottom: spacing.md },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    sectionTitle:  { ...typography.body, fontWeight: '700', color: C.text },
    sectionBadge:  {
      backgroundColor: `${C.primary}12`, paddingHorizontal: spacing.sm,
      paddingVertical: 2, borderRadius: radius.full,
    },
    sectionBadgeText: { ...typography.small, color: C.primary, fontWeight: '700' },
    bio:   { ...typography.body, color: C.textSecondary, lineHeight: 26 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip:  {
      paddingHorizontal: spacing.md, paddingVertical: 5,
      borderRadius: radius.full, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
    },
    chipText: { ...typography.small, color: C.textSecondary },

    // Posts grid
    postsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    postCell:       {
      width: GRID_CELL, height: GRID_CELL, borderRadius: radius.sm,
      overflow: 'hidden', backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
    },
    postCellImage:  { width: '100%', height: '100%' },
    postCellText:   { flex: 1, padding: 6, justifyContent: 'center', alignItems: 'center', gap: 4 },
    postCellCaption:{ ...typography.small, color: C.textSecondary, textAlign: 'center', lineHeight: 14, fontSize: 10 },
    postBadge: {
      position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2,
      backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full,
      paddingHorizontal: 5, paddingVertical: 2,
    },
    postBadgeText:  { fontSize: 10, color: '#fff', fontWeight: '600' },
    moreCellOverlay:{ backgroundColor: `${C.primary}15`, alignItems: 'center', justifyContent: 'center' },
    moreCellText:   { ...typography.heading, color: C.primary, fontWeight: '700' },
    moreCellSub:    { ...typography.small, color: C.primary },
    noPostsCta: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.md, borderRadius: radius.md,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    noPostsText: { flex: 1, ...typography.body, color: C.textSecondary },

    // Coins card
    coinsCard: {
      backgroundColor: '#FDCB6E08', borderRadius: radius.md,
      padding: spacing.md, marginBottom: spacing.md,
      borderWidth: 1, borderColor: '#FDCB6E30',
    },
    coinsRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    coinsLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    coinsTitle:    { ...typography.body, fontWeight: '700', color: C.text },
    coinsBadge:    { backgroundColor: '#FDCB6E20', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
    coinsBalance:  { ...typography.body, fontWeight: '800', color: '#D4A017' },
    coinsDesc:     { ...typography.small, color: C.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
    earnRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    earnChip:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.full },
    earnChipText:  { ...typography.small, fontWeight: '600', fontSize: 11 },
    coinsShopBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
    coinsShopText: { fontSize: 13, fontWeight: '700' },

    // Premium upsell card
    premiumCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: '#FFD70010', borderWidth: 1, borderColor: '#FFD70030',
      borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
    },
    premiumCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    premiumCardTitle:  { fontSize: 15, fontWeight: '800', color: '#D4A017' },
    premiumCardSub:    { fontSize: 12, color: C.textSecondary, marginTop: 1 },
    premiumCardBadge:  { backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
    premiumCardBadgeText: { fontSize: 12, fontWeight: '900', color: '#000' },

    // Settings
    settingsCard: {
      borderRadius: radius.md, borderWidth: 1, borderColor: C.border,
      overflow: 'hidden', backgroundColor: C.surface,
    },
    settingsRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    settingsIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    settingsLabel:   { flex: 1, ...typography.body, color: C.text },
  });
}
