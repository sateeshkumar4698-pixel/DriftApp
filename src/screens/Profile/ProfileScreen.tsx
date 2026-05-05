import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../../components/Avatar';
import { spacing, typography, radius, shadows } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { ProfileStackParamList, Post, PostType } from '../../types';
import { getPosts, subscribeToConnections } from '../../utils/firestore-helpers';

const SCREEN_W  = Dimensions.get('window').width;
const GRID_CELL = (SCREEN_W - spacing.lg * 2 - spacing.xs * 2) / 3;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLiveCompleteness(profile: NonNullable<import('../../types').UserProfile>): number {
  let score = 20;
  if ((profile.name ?? '').trim().length >= 2)  score += 10;
  if ((profile.bio  ?? '').trim().length >= 20)  score += 10;
  if ((profile.city ?? '').trim())               score += 8;
  if ((profile.college ?? '').trim() || (profile.work ?? '').trim()) score += 7;
  if ((profile.interests ?? []).length >= 3)     score += 10;
  if ((profile.photos ?? []).length >= 1)        score += 15;
  if ((profile.photos ?? []).length >= 3)        score += 10;
  if (!!profile.vibeProfile?.primaryVibes?.length) score += 10;
  return Math.min(100, score);
}

// ─── Completeness Bar ─────────────────────────────────────────────────────────

function CompletenessBar({ pct: rawPct, C }: { pct: number; C: AppColors }) {
  const styles = makeStyles(C);
  const pct   = Math.round(Math.max(0, Math.min(100, isFinite(rawPct) ? rawPct : 60)));
  const color = pct >= 80 ? C.success : pct >= 50 ? '#FDCB6E' : C.primary;

  const tip =
    pct < 40 ? 'Add photos to get 3× more connections' :
    pct < 60 ? 'Complete vibe quiz to improve discovery' :
    pct < 80 ? 'Add your city/college for better local matches' :
    'Looking great! You\'re fully set up 🎉';

  return (
    <View style={styles.completenessCard}>
      <View style={styles.completenessTop}>
        <View>
          <Text style={styles.completenessTitle}>Profile Strength</Text>
          <Text style={styles.completenessTip}>{tip}</Text>
        </View>
        <Text style={[styles.completenessPct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.completenessTrack}>
        <View style={[styles.completenessFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, color, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string | number;
  label: string;
  color: string;
  C: AppColors;
}) {
  const styles = makeStyles(C);
  return (
    <View style={[styles.statCard, { borderColor: `${color}25`, backgroundColor: `${color}08` }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { userProfile, firebaseUser, reset } = useAuthStore();
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);
  const [loggingOut,    setLoggingOut]    = useState(false);
  const [myPosts,       setMyPosts]       = useState<Post[]>([]);
  const [postsLoading,  setPostsLoading]  = useState(false);
  const [connCount,     setConnCount]     = useState(0);

  const uid = firebaseUser?.uid ?? '';

  useEffect(() => {
    if (!uid) return;
    setPostsLoading(true);
    getPosts(uid)
      .then((p) => setMyPosts(p))
      .catch(() => {})
      .finally(() => setPostsLoading(false));

    const unsub = subscribeToConnections(uid, (list) => setConnCount(list.length));
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

  const streak   = userProfile.streak ?? { current: 0, longest: 0, lastLoginDate: '' };
  const coins    = userProfile.coins ?? 0;
  const hasVibe  = !!userProfile.vibeProfile?.primaryVibes?.length;
  const liveCompleteness = calcLiveCompleteness(userProfile);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('ProfileShare')}
          >
            <Ionicons name="share-social-outline" size={22} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, styles.editIconBtn]}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Ionicons name="create-outline" size={22} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + Identity ── */}
        <View style={styles.profileTop}>
          <View style={styles.avatarWrapper}>
            <Avatar name={userProfile.name} photoURL={userProfile.photoURL} size={96} />
            {userProfile.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            )}
          </View>

          <Text style={styles.name}>
            {userProfile.name}{userProfile.age ? `, ${userProfile.age}` : ''}
          </Text>

          {userProfile.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={C.textSecondary} />
              <Text style={styles.locationText}>{userProfile.city}</Text>
            </View>
          )}

          {(userProfile.college || userProfile.work) && (
            <View style={styles.locationRow}>
              <Ionicons
                name={userProfile.college ? 'school-outline' : 'briefcase-outline'}
                size={14}
                color={C.textSecondary}
              />
              <Text style={styles.locationText}>
                {userProfile.college ?? userProfile.work}
              </Text>
            </View>
          )}

          {/* Looking for chips */}
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
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCard icon="flame"          value={streak.current}  label="Day Streak"  color="#FF4B6E" C={C} />
          <StatCard icon="people"         value={connCount}       label="Connections" color="#6C5CE7" C={C} />
          <StatCard icon="flash"          value={coins}           label="Coins"       color="#FDCB6E" C={C} />
          <StatCard icon="trophy"         value={streak.longest}  label="Best"        color="#00B894" C={C} />
        </View>

        {/* ── Profile Strength ── */}
        <CompletenessBar pct={liveCompleteness} C={C} />

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
            label={hasVibe ? 'Retake Vibe' : 'Vibe Quiz'}
            onPress={() => navigation.navigate('VibeQuiz')}
            color="#00B894"
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
              <Text style={styles.quizCtaSub}>7 quick questions • unlocks better matches</Text>
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

        {/* ── Coins info ── */}
        <View style={styles.coinsCard}>
          <View style={styles.coinsRow}>
            <View style={styles.coinsLeft}>
              <Ionicons name="flash" size={20} color="#D4A017" />
              <Text style={styles.coinsTitle}>Drift Coins</Text>
            </View>
            <View style={styles.coinsBadge}>
              <Text style={styles.coinsBalance}>{coins}</Text>
            </View>
          </View>
          <Text style={styles.coinsDesc}>Earn coins daily. Use on voice calls and profile boosts.</Text>
          <View style={styles.earnRow}>
            {[
              { icon: 'sunny-outline' as const, text: '+10 daily', color: '#FDCB6E' },
              { icon: 'flame-outline' as const, text: '+75 streak×7', color: '#FF4B6E' },
              { icon: 'people-outline' as const, text: '+20 connect', color: '#6C5CE7' },
            ].map((h) => (
              <View key={h.text} style={[styles.earnChip, { backgroundColor: `${h.color}15` }]}>
                <Ionicons name={h.icon} size={13} color={h.color} />
                <Text style={[styles.earnChipText, { color: h.color }]}>{h.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Settings ── */}
        <View style={styles.settingsCard}>
          <SettingsRow
            icon="settings-outline"
            label="Settings"
            tint={C.secondary}
            onPress={() => navigation.navigate('Settings')}
            C={C}
          />
          <SettingsRow
            icon="time-outline"
            label="Coin History"
            tint="#FDCB6E"
            onPress={() => navigation.navigate('CoinHistory')}
            C={C}
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            label="Send Feedback"
            tint="#00E676"
            onPress={() => navigation.navigate('Feedback')}
            C={C}
          />
          <SettingsRow
            icon="log-out-outline"
            label={loggingOut ? 'Signing out…' : 'Sign Out'}
            danger
            onPress={handleLogout}
            C={C}
          />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },

    // Header
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

    container: { padding: spacing.lg, paddingBottom: 100 },

    // Profile top
    profileTop: { alignItems: 'center', paddingVertical: spacing.md, gap: 6 },
    avatarWrapper: { position: 'relative', marginBottom: 4 },
    verifiedBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.success,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: C.background,
    },
    name:         { ...typography.title, color: C.text, fontWeight: '700' },
    locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { ...typography.caption, color: C.textSecondary },
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
    completenessTip:  { ...typography.small, color: C.textSecondary, marginTop: 2, maxWidth: '85%' },
    completenessPct:  { ...typography.heading, fontWeight: '800', fontSize: 22 },
    completenessTrack:{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
    completenessFill: { height: 6, borderRadius: 3 },

    // Quick actions
    quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    quickAction:     { flex: 1, alignItems: 'center', gap: spacing.xs },
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

    // Vibe CTA
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

    // Coins
    coinsCard: {
      backgroundColor: '#FDCB6E08', borderRadius: radius.md,
      padding: spacing.md, marginBottom: spacing.md,
      borderWidth: 1, borderColor: '#FDCB6E30',
    },
    coinsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    coinsLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    coinsTitle:  { ...typography.body, fontWeight: '700', color: C.text },
    coinsBadge:  { backgroundColor: '#FDCB6E20', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
    coinsBalance:{ ...typography.body, fontWeight: '800', color: '#D4A017' },
    coinsDesc:   { ...typography.small, color: C.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
    earnRow:     { flexDirection: 'row', gap: spacing.xs },
    earnChip:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 5, borderRadius: radius.full },
    earnChipText:{ ...typography.small, fontWeight: '600', fontSize: 11 },

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
