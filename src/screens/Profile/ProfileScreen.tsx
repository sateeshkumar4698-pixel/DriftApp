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
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../../components/Avatar';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { ProfileStackParamList, Post, PostType } from '../../types';
import { getPosts } from '../../utils/firestore-helpers';

const SCREEN_W = Dimensions.get('window').width;
const GRID_CELL = (SCREEN_W - spacing.lg * 2 - spacing.xs * 2) / 3;

const POST_TYPE_EMOJI: Record<PostType, string> = {
  text: '✏️', image: '📸', thread: '🧵', poll: '📊',
  moment: '📸', memory: '🌟', vibe: '✨', question: '🤔', achievement: '🏆',
};

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

const LOOKING_FOR_LABELS: Record<string, string> = {
  friends: '👫 Friends',
  dating: '💘 Dating',
  networking: '💼 Networking',
  events: '🎉 Events',
};

const NIGHTLIFE_LABEL: Record<string, string> = {
  homebody: '🏠 Homebody',
  lounge: '🥂 Lounge',
  houseparty: '🎶 House Party',
  club: '🕺 Club',
  outdoor: '🔥 Outdoor',
};

// ─── Stat Widget ──────────────────────────────────────────────────────────────

function StatWidget({ emoji, value, label, color }: { emoji: string; value: string | number; label: string; color?: string }) {
  return (
    <View style={[styles.statWidget, color ? { borderColor: `${color}30`, backgroundColor: `${color}08` } : {}]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Profile Completeness Bar ─────────────────────────────────────────────────

function CompletenessBar({ pct: rawPct }: { pct: number }) {
  // Guard NaN/Infinity — can arrive if Firestore doc has a missing/corrupt field
  const pct   = Math.round(Math.max(0, Math.min(100, isFinite(rawPct) ? rawPct : 60)));
  const color = pct >= 80 ? colors.success : pct >= 50 ? '#FDCB6E' : colors.primary;
  return (
    <View style={styles.completenessContainer}>
      <View style={styles.completenessHeader}>
        <Text style={styles.completenessLabel}>Profile Completeness</Text>
        <Text style={[styles.completenessValue, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.completenessTrack}>
        <View style={[styles.completenessFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      {pct < 80 && (
        <Text style={styles.completenessTip}>
          {pct < 40 ? '📸 Add photos to get 3× more connections' :
           pct < 60 ? '✨ Complete vibe quiz to improve discovery' :
           '💫 Add your city/college for better local matches'}
        </Text>
      )}
    </View>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({ emoji, label, onPress, color }: { emoji: string; label: string; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickActionIcon, color ? { backgroundColor: `${color}15` } : {}]}>
        <Text style={styles.quickActionEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { userProfile, firebaseUser, reset } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut(auth);
            reset();
          } catch {
            Alert.alert('Error', 'Failed to sign out.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  // ── My posts ──────────────────────────────────────────────────────────────
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const uid = firebaseUser?.uid ?? '';

  useEffect(() => {
    if (!uid) return;
    setPostsLoading(true);
    getPosts(uid).then((p) => { setMyPosts(p); setPostsLoading(false); }).catch(() => setPostsLoading(false));
  }, [uid]);

  if (!userProfile) return null;

  const streak             = userProfile.streak ?? { current: 0, longest: 0, lastLoginDate: '' };
  const coins              = userProfile.coins ?? 0;
  const vibeProfile        = userProfile.vibeProfile;
  const profileCompleteness = userProfile.profileCompleteness ?? 40;
  const hasVibe = !!vibeProfile?.primaryVibes?.length;

  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('ProfileShare')} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>🔗 Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.editBtn}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + name ── */}
        <View style={styles.profileTop}>
          <View style={styles.avatarWrapper}>
            <Avatar name={userProfile.name} photoURL={userProfile.photoURL} size={96} />
            {userProfile.isVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{userProfile.name}, {userProfile.age}</Text>
          {userProfile.city && <Text style={styles.location}>📍 {userProfile.city}</Text>}
          {(userProfile.college || userProfile.work) && (
            <Text style={styles.subInfo}>{userProfile.college ?? userProfile.work}</Text>
          )}
          <View style={styles.lookingForRow}>
            {(userProfile.lookingFor ?? []).map((item) => (
              <View key={item} style={styles.lfChip}>
                <Text style={styles.lfChipText}>{LOOKING_FOR_LABELS[item] ?? item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatWidget emoji="💰" value={coins} label="Coins" color="#FDCB6E" />
          <StatWidget emoji="🔥" value={streak.current} label={`Day streak`} color="#FF4B6E" />
          <StatWidget emoji="🏆" value={streak.longest} label="Best streak" color="#6C5CE7" />
        </View>

        {/* ── Completeness bar ── */}
        <CompletenessBar pct={profileCompleteness ?? 60} />

        {/* ── Quick actions ── */}
        <View style={styles.quickActionsRow}>
          <QuickAction
            emoji="✨"
            label="Post Status"
            onPress={() => navigation.navigate('StatusCreate')}
            color={colors.primary}
          />
          <QuickAction
            emoji="🌌"
            label="Memories"
            onPress={() => navigation.navigate('ViewMemories')}
            color="#6C5CE7"
          />
          <QuickAction
            emoji={hasVibe ? '🔥' : '🎯'}
            label={hasVibe ? 'Retake Quiz' : 'Vibe Quiz'}
            onPress={() => navigation.navigate('VibeQuiz')}
            color="#00B894"
          />
        </View>

        {/* ── Profile Share action ── */}
        <TouchableOpacity
          style={[styles.shareActionsRow, styles.shareActionBtn]}
          onPress={() => navigation.navigate('ProfileShare')}
          activeOpacity={0.85}
        >
          <Text style={styles.shareActionEmoji}>🪪</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareActionTitle}>Share Profile</Text>
            <Text style={styles.shareActionSub}>QR code · link · WhatsApp · @handle</Text>
          </View>
          <Text style={styles.shareActionArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Vibe Profile (if completed) ── */}
        {hasVibe && vibeProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Drift Vibe</Text>
            <View style={styles.vibeChipsRow}>
              {(vibeProfile.primaryVibes ?? []).map((v) => (
                <View key={v} style={styles.vibeChip}>
                  <Text style={styles.vibeChipText}>{v}</Text>
                </View>
              ))}
            </View>
            {(vibeProfile.musicTaste ?? []).length > 0 && (
              <Text style={styles.vibeExtra}>
                🎵 {(vibeProfile.musicTaste ?? []).join(' · ')}
              </Text>
            )}
            {vibeProfile.nightlifeStyle && (
              <Text style={styles.vibeExtra}>
                {NIGHTLIFE_LABEL[vibeProfile.nightlifeStyle] ?? vibeProfile.nightlifeStyle}
              </Text>
            )}
          </View>
        )}

        {/* ── Vibe quiz CTA (if not done) ── */}
        {!hasVibe && (
          <TouchableOpacity
            style={styles.quizCta}
            onPress={() => navigation.navigate('VibeQuiz')}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.quizCtaTitle}>Take the Vibe Quiz 🎯</Text>
              <Text style={styles.quizCtaSubtitle}>7 quick questions • unlocks better matches</Text>
            </View>
            <Text style={styles.quizCtaArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Bio ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{userProfile.bio}</Text>
        </View>

        {/* ── Interests ── */}
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

        {/* ── My Posts ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Posts</Text>
            <Text style={styles.sectionCount}>{myPosts.length}</Text>
          </View>
          {postsLoading ? (
            <ActivityIndicator color={colors.primary} size="small" style={{ marginTop: spacing.sm }} />
          ) : myPosts.length === 0 ? (
            <TouchableOpacity
              style={styles.noPostsCta}
              onPress={() => (navigation as any).navigate('Feed', { screen: 'CreatePost' })}
              activeOpacity={0.85}
            >
              <Text style={styles.noPostsEmoji}>📸</Text>
              <Text style={styles.noPostsText}>Share your first moment</Text>
              <Text style={styles.noPostsArrow}>→</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.postsGrid}>
              {myPosts.slice(0, 9).map((post) => (
                <View key={post.id} style={styles.postCell}>
                  {post.mediaURL ? (
                    <Image source={{ uri: post.mediaURL }} style={styles.postCellImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.postCellText, { backgroundColor: `${colors.primary}12` }]}>
                      <Text style={styles.postTypeEmoji}>{POST_TYPE_EMOJI[post.postType ?? 'moment']}</Text>
                      <Text style={styles.postCellCaption} numberOfLines={3}>{post.caption}</Text>
                    </View>
                  )}
                  {/* Reaction count badge */}
                  {(post.likes?.length ?? 0) > 0 && (
                    <View style={styles.postBadge}>
                      <Text style={styles.postBadgeText}>❤️ {post.likes.length}</Text>
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
            <Text style={styles.coinsTitle}>💰 Drift Coins</Text>
            <Text style={styles.coinsBalance}>{coins} coins</Text>
          </View>
          <Text style={styles.coinsDesc}>Earn free coins by using Drift daily. Spend on voice calls and boosts.</Text>
          <View style={styles.earnHints}>
            <Text style={styles.earnHint}>+10 daily login</Text>
            <Text style={styles.earnHint}>+75 weekly streak</Text>
            <Text style={styles.earnHint}>+20 first connection</Text>
          </View>
        </View>

        {/* ── Settings links ── */}
        <View style={styles.settingsCard}>
          {([
            { emoji: '💰', label: 'Coin History', screen: 'CoinHistory' },
            { emoji: '🔒', label: 'Privacy Settings', screen: 'PrivacySettings' },
            { emoji: '📄', label: 'Terms & Privacy', screen: 'Terms' },
          ] as const).map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.settingsRow}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.settingsEmoji}>{item.emoji}</Text>
              <Text style={styles.settingsLabel}>{item.label}</Text>
              <Text style={styles.settingsArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Text style={styles.logoutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:  { ...typography.heading, color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shareBtn: {
    backgroundColor: `${colors.primary}12`,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1, borderColor: `${colors.primary}30`,
  },
  shareBtnText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  editBtn: { ...typography.body, color: colors.primary, fontWeight: '600' },

  shareActionsRow: { marginBottom: spacing.lg, gap: spacing.sm },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  shareActionEmoji: { fontSize: 26 },
  shareActionTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  shareActionSub:   { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  shareActionArrow: { fontSize: 22, color: colors.textSecondary, marginLeft: 'auto' },

  container: { padding: spacing.lg, paddingBottom: spacing.xxl },

  profileTop: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  avatarWrapper: { position: 'relative' },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  verifiedText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  name: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  location: { ...typography.caption, color: colors.textSecondary },
  subInfo: { ...typography.caption, color: colors.textSecondary },
  lookingForRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xs },
  lfChip: { backgroundColor: `${colors.primary}12`, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  lfChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statWidget: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statEmoji: { fontSize: 20 },
  statValue: { ...typography.heading, color: colors.text, fontWeight: '700' },
  statLabel: { ...typography.small, color: colors.textSecondary },

  completenessContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completenessHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  completenessLabel: { ...typography.caption, fontWeight: '600', color: colors.text },
  completenessValue: { ...typography.caption, fontWeight: '700' },
  completenessTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  completenessFill: { height: 6, borderRadius: 3 },
  completenessTip: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },

  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickAction: { flex: 1, alignItems: 'center', gap: spacing.xs },
  quickActionIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  quickActionEmoji: { fontSize: 24 },
  quickActionLabel: { ...typography.small, color: colors.text, fontWeight: '500', textAlign: 'center' },

  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  sectionCount: {
    ...typography.small, fontWeight: '700', color: colors.primary,
    backgroundColor: `${colors.primary}12`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full,
  },

  postsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  postCell: {
    width: GRID_CELL, height: GRID_CELL, borderRadius: radius.sm,
    overflow: 'hidden', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  postCellImage: { width: '100%', height: '100%' },
  postCellText: { flex: 1, padding: 6, justifyContent: 'center', alignItems: 'center', gap: 4 },
  postTypeEmoji: { fontSize: 20 },
  postCellCaption: { ...typography.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 14 },
  postBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  postBadgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  moreCellOverlay: {
    backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: `${colors.primary}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  moreCellText: { ...typography.heading, color: colors.primary, fontWeight: '700' },
  moreCellSub: { ...typography.small, color: colors.primary },

  noPostsCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  noPostsEmoji: { fontSize: 22 },
  noPostsText: { flex: 1, ...typography.body, color: colors.textSecondary, marginLeft: spacing.sm },
  noPostsArrow: { fontSize: 18, color: colors.primary },
  bio: { ...typography.body, color: colors.textSecondary, lineHeight: 26 },

  vibeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  vibeChip: {
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.full, backgroundColor: `${colors.secondary}15`,
  },
  vibeChipText: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  vibeExtra: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },

  quizCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1, borderColor: `${colors.primary}30`,
  },
  quizCtaTitle: { ...typography.body, fontWeight: '700', color: colors.primary },
  quizCtaSubtitle: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  quizCtaArrow: { fontSize: 20, color: colors.primary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surface },
  chipText: { ...typography.caption, color: colors.textSecondary },

  coinsCard: {
    backgroundColor: `#FDCB6E10`,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FDCB6E30',
  },
  coinsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  coinsTitle: { ...typography.body, fontWeight: '700', color: colors.text },
  coinsBalance: { ...typography.body, fontWeight: '700', color: '#D4A017' },
  coinsDesc: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  earnHints: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  earnHint: {
    ...typography.small, color: '#D4A017', fontWeight: '600',
    backgroundColor: '#FDCB6E20', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },

  settingsCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  settingsEmoji: { fontSize: 18, marginRight: spacing.md },
  settingsLabel: { flex: 1, ...typography.body, color: colors.text },
  settingsArrow: { fontSize: 22, color: colors.textSecondary },

  logoutBtn: {
    marginTop: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5,
    borderColor: colors.error, paddingVertical: spacing.md, alignItems: 'center',
  },
  logoutText: { ...typography.body, color: colors.error, fontWeight: '600' },
});
