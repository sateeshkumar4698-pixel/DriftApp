import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  getCommunity,
  joinCommunity,
  leaveCommunity,
  isCommunityMember,
  createCommunityPost,
  subscribeToCommunityPosts,
  toggleCommunityPostLike,
  getCommunityComments,
  subscribeToCommunityComments,
  createCommunityComment,
} from '../../utils/firestore-helpers';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius, shadows } from '../../utils/theme';
import {
  Community,
  CommunityCategory,
  CommunityComment,
  CommunityPost,
  FeedStackParamList,
} from '../../types';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { formatRelativeTime } from '../../utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

type Route = RouteProp<FeedStackParamList, 'CommunityDetail'>;
type Nav = NativeStackNavigationProp<FeedStackParamList>;

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<CommunityCategory, { label: string; emoji: string; color: string; color2: string }> = {
  culture_caste:  { label: 'Culture & Caste',   emoji: '🏘️', color: '#FF6B6B', color2: '#FF8E53' },
  lgbtq:          { label: 'LGBTQ+',            emoji: '🌈', color: '#A855F7', color2: '#EC4899' },
  startups:       { label: 'Startups',           emoji: '🚀', color: '#3B82F6', color2: '#06B6D4' },
  employment:     { label: 'Jobs & Employment',  emoji: '💼', color: '#10B981', color2: '#059669' },
  education:      { label: 'Education',          emoji: '📚', color: '#F59E0B', color2: '#EF4444' },
  students:       { label: 'Students',           emoji: '🎓', color: '#8B5CF6', color2: '#7C3AED' },
  politics:       { label: 'Politics',           emoji: '🗳️', color: '#EF4444', color2: '#DC2626' },
  gossip:         { label: 'Gossip & Drama',     emoji: '🗣️', color: '#F97316', color2: '#EF4444' },
  gaming:         { label: 'Gaming',             emoji: '🎮', color: '#6366F1', color2: '#4F46E5' },
  fitness:        { label: 'Fitness',            emoji: '💪', color: '#22C55E', color2: '#16A34A' },
  music_arts:     { label: 'Music & Arts',       emoji: '🎵', color: '#EC4899', color2: '#BE185D' },
  tech:           { label: 'Tech & Coding',      emoji: '💻', color: '#0EA5E9', color2: '#0284C7' },
  relationships:  { label: 'Relationships',      emoji: '❤️', color: '#FF4B6E', color2: '#E11D48' },
  travel:         { label: 'Travel',             emoji: '🌍', color: '#10B981', color2: '#0891B2' },
  food_lifestyle: { label: 'Food & Lifestyle',   emoji: '🍕', color: '#F59E0B', color2: '#D97706' },
  general:        { label: 'General',            emoji: '💬', color: '#6B7280', color2: '#4B5563' },
};

function formatMemberCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Comments bottom sheet ────────────────────────────────────────────────────

function CommentsSheet({
  post,
  communityId,
  visible,
  uid,
  userName,
  userPhotoURL,
  onClose,
  onCommentAdded,
}: {
  post: CommunityPost;
  communityId: string;
  visible: boolean;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  onClose: () => void;
  onCommentAdded: () => void;
}) {
  const { C } = useTheme();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getCommunityComments(post.id)
      .then((data) => setComments(data))
      .catch(() => {})
      .finally(() => setLoading(false));
    const unsub = subscribeToCommunityComments(post.id, (data) => {
      setComments(data);
    });
    return unsub;
  }, [visible, post.id]);

  async function handleSend() {
    if (!text.trim() || !uid) return;
    setPosting(true);
    const comment: CommunityComment = {
      id: `cmt_${Date.now()}_${uid}`,
      postId: post.id,
      communityId,
      authorUid: uid,
      authorName: userName,
      authorPhotoURL: userPhotoURL,
      text: text.trim(),
      likes: [],
      createdAt: Date.now(),
    };
    try {
      await createCommunityComment(comment);
      setText('');
      onCommentAdded();
    } catch {
      Alert.alert('Error', 'Could not post comment. Try again.');
    } finally {
      setPosting(false);
    }
  }

  const sc = makeSheetStyles(C);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sc.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={sc.sheet}
            >
              <View style={sc.handle} />
              <View style={sc.sheetHeader}>
                <Text style={sc.sheetTitle}>Comments</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={C.textSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator color={C.primary} style={{ marginTop: spacing.xl }} />
              ) : comments.length === 0 ? (
                <Text style={sc.emptyText}>No comments yet — be the first! 💬</Text>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  style={sc.list}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item: c }) => (
                    <View style={sc.row}>
                      <Avatar name={c.authorName} photoURL={c.authorPhotoURL} size={32} />
                      <View style={sc.bubble}>
                        <View style={sc.bubbleTop}>
                          <Text style={sc.bubbleName}>{c.authorName}</Text>
                          <Text style={sc.bubbleTime}>{formatRelativeTime(c.createdAt)}</Text>
                        </View>
                        {c.replyTo && (
                          <Text style={[sc.replyTag, { color: C.textTertiary }]}>
                            ↩ {c.replyTo.authorName}
                          </Text>
                        )}
                        <Text style={sc.bubbleText}>{c.text}</Text>
                      </View>
                    </View>
                  )}
                />
              )}

              <View style={sc.inputRow}>
                <Avatar name={userName} photoURL={userPhotoURL} size={30} />
                <TextInput
                  ref={inputRef}
                  style={sc.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="Add a comment…"
                  placeholderTextColor={C.textSecondary}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[sc.sendBtn, { backgroundColor: C.primary }, (!text.trim() || posting) && { opacity: 0.4 }]}
                  onPress={handleSend}
                  disabled={!text.trim() || posting}
                >
                  {posting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="arrow-up" size={16} color="#fff" />}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeSheetStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
      paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: C.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    emptyText: {
      textAlign: 'center',
      color: C.textSecondary,
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
      fontSize: 14,
    },
    list: { flexGrow: 0, maxHeight: 360 },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    bubble: { flex: 1, backgroundColor: C.surface, borderRadius: radius.md, padding: spacing.sm },
    bubbleTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    bubbleName: { fontSize: 13, fontWeight: '700', color: C.text },
    bubbleTime: { fontSize: 11, color: C.textTertiary },
    replyTag: { fontSize: 11, marginBottom: 3 },
    bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    input: {
      flex: 1,
      backgroundColor: C.inputBg,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      color: C.text,
      maxHeight: 80,
    },
    sendBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

// ─── Rules modal ──────────────────────────────────────────────────────────────

function RulesModal({
  rules,
  visible,
  onClose,
}: {
  rules: string[];
  visible: boolean;
  onClose: () => void;
}) {
  const { C } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg }}>
              <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md }} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: spacing.md }}>
                📋 Community Rules
              </Text>
              {rules.map((rule, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.primary }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 20 }}>{rule}</Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={onClose}
                style={{ marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary }}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  uid,
  isPinned,
  isAnnouncement,
  onLike,
  onComment,
  onNavigate,
}: {
  post: CommunityPost;
  uid: string;
  isPinned: boolean;
  isAnnouncement: boolean;
  onLike: () => void;
  onComment: () => void;
  onNavigate: () => void;
}) {
  const { C } = useTheme();
  const liked = post.likes.includes(uid);
  const likeScale = useRef(new Animated.Value(1)).current;

  function animateLike() {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  }

  const pc = makePostCardStyles(C);

  return (
    <TouchableOpacity onPress={onNavigate} activeOpacity={0.92} style={[pc.card, isAnnouncement && pc.announcementCard]}>
      {isAnnouncement && (
        <LinearGradient
          colors={['#FF4B6E20', '#FF4B6E05']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {/* Pin / announcement indicator */}
      {(isPinned || isAnnouncement) && (
        <View style={pc.topBadgeRow}>
          {isPinned && (
            <View style={[pc.topBadge, { backgroundColor: C.gold + '20' }]}>
              <Ionicons name="pin" size={10} color={C.gold} />
              <Text style={[pc.topBadgeText, { color: C.gold }]}>Pinned</Text>
            </View>
          )}
          {isAnnouncement && (
            <View style={[pc.topBadge, { backgroundColor: C.primary + '20' }]}>
              <Ionicons name="megaphone" size={10} color={C.primary} />
              <Text style={[pc.topBadgeText, { color: C.primary }]}>Announcement</Text>
            </View>
          )}
        </View>
      )}

      {/* Author */}
      <View style={pc.header}>
        <Avatar name={post.authorName} photoURL={post.authorPhotoURL} size={38} />
        <View style={pc.meta}>
          <Text style={pc.authorName} numberOfLines={1}>{post.authorName}</Text>
          <Text style={pc.time}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
      </View>

      {/* Content */}
      <Text style={pc.content} numberOfLines={5}>{post.content}</Text>

      {/* Tags */}
      {(post.tags ?? []).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pc.tagsScroll} pointerEvents="none">
          {(post.tags ?? []).map((tag) => (
            <View key={tag} style={pc.tag}>
              <Text style={[pc.tagText, { color: C.secondary }]}>#{tag}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={pc.actions}>
        <TouchableOpacity
          style={pc.actionBtn}
          onPress={() => { animateLike(); onLike(); }}
          activeOpacity={0.75}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={21} color={liked ? '#FF4B6E' : C.textSecondary} />
          </Animated.View>
          {post.likes.length > 0 && (
            <Text style={[pc.actionCount, liked && { color: '#FF4B6E' }]}>{post.likes.length}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={pc.actionBtn} onPress={onComment} activeOpacity={0.75}>
          <Ionicons name="chatbubble-outline" size={19} color={C.textSecondary} />
          {post.commentsCount > 0 && (
            <Text style={pc.actionCount}>{post.commentsCount}</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function makePostCardStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      overflow: 'hidden',
      ...shadows.sm,
    },
    announcementCard: {
      borderColor: C.primary + '40',
    },
    topBadgeRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    topBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    topBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    meta: { flex: 1 },
    authorName: { fontSize: 14, fontWeight: '700', color: C.text },
    time: { fontSize: 11, color: C.textSecondary, marginTop: 1 },
    content: {
      fontSize: 14,
      color: C.text,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    tagsScroll: { marginBottom: spacing.sm },
    tag: {
      backgroundColor: C.secondary + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      marginRight: spacing.xs,
    },
    tagText: { fontSize: 11, fontWeight: '600' },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: C.borderLight,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    actionCount: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSecondary,
    },
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityDetailScreen() {
  const { C, isDark } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const uid = firebaseUser?.uid ?? '';
  const userName = userProfile?.name ?? 'Unknown';
  const userPhotoURL = userProfile?.photoURL;

  const { communityId } = route.params;

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [joiningLoading, setJoiningLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [commentPost, setCommentPost] = useState<CommunityPost | null>(null);

  const joinScale = useRef(new Animated.Value(1)).current;
  const unsubPostsRef = useRef<(() => void) | null>(null);

  // ── Load community ──
  async function loadCommunity() {
    try {
      const data = await getCommunity(communityId);
      setCommunity(data);
    } catch {
      Alert.alert('Error', 'Could not load community.');
    }
  }

  // ── Check membership ──
  async function checkMembership() {
    if (!uid) return;
    try {
      const isMember = await isCommunityMember(communityId, uid);
      setJoined(isMember);
    } catch {
      // non-critical
    }
  }

  // ── Subscribe to posts ──
  function subscribePosts() {
    if (unsubPostsRef.current) unsubPostsRef.current();
    unsubPostsRef.current = subscribeToCommunityPosts(communityId, (data) => {
      setPosts(data);
    });
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCommunity(), checkMembership()])
      .finally(() => setLoading(false));
    subscribePosts();
    return () => {
      if (unsubPostsRef.current) unsubPostsRef.current();
    };
  }, [communityId, uid]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadCommunity(), checkMembership()]);
    setRefreshing(false);
  }

  // ── Join / Leave ──
  function animateJoin() {
    Animated.sequence([
      Animated.timing(joinScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(joinScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  }

  async function handleJoinLeave() {
    if (!uid || !community) return;
    animateJoin();
    setJoiningLoading(true);
    try {
      if (joined) {
        Alert.alert(
          'Leave Community',
          `Are you sure you want to leave "${community.name}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                await leaveCommunity(communityId, uid);
                setJoined(false);
                setCommunity((prev) => prev ? { ...prev, memberCount: Math.max(0, prev.memberCount - 1) } : prev);
              },
            },
          ],
        );
      } else {
        await joinCommunity(communityId, {
          uid,
          role: 'member',
          joinedAt: Date.now(),
          displayName: userName,
          photoURL: userPhotoURL,
        });
        setJoined(true);
        setCommunity((prev) => prev ? { ...prev, memberCount: prev.memberCount + 1 } : prev);
      }
    } catch {
      Alert.alert('Error', 'Could not update membership. Try again.');
    } finally {
      setJoiningLoading(false);
    }
  }

  // ── Create post ──
  async function handlePost() {
    if (!composerText.trim() || !uid || !community) return;
    setPosting(true);
    const newPost: CommunityPost = {
      id: `post_${Date.now()}_${uid}`,
      communityId,
      authorUid: uid,
      authorName: userName,
      authorPhotoURL: userPhotoURL,
      content: composerText.trim(),
      likes: [],
      commentsCount: 0,
      isPinned: false,
      isAnnouncement: false,
      createdAt: Date.now(),
    };
    try {
      await createCommunityPost(newPost);
      setComposerText('');
    } catch {
      Alert.alert('Error', 'Could not create post. Try again.');
    } finally {
      setPosting(false);
    }
  }

  // ── Toggle like ──
  function handleLike(post: CommunityPost) {
    if (!uid) return;
    const liked = post.likes.includes(uid);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likes: liked ? p.likes.filter((u) => u !== uid) : [...p.likes, uid] }
          : p,
      ),
    );
    toggleCommunityPostLike(post.id, uid, liked).catch(() => {});
  }

  const sc = makeStyles(C, isDark);

  if (loading || !community) {
    return (
      <SafeAreaView style={sc.root} edges={['top']}>
        <View style={sc.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.textSecondary, marginTop: spacing.sm }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = CATEGORY_META[community.category];
  const c1 = community.coverColor || meta.color;
  const c2 = community.coverColor2 || meta.color2;

  // Sort: pinned + announcements first, then by time
  const sortedPosts = [...posts].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isAnnouncement && !b.isAnnouncement) return -1;
    if (!a.isAnnouncement && b.isAnnouncement) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <SafeAreaView style={sc.root} edges={['top']}>
      {commentPost && (
        <CommentsSheet
          post={commentPost}
          communityId={communityId}
          visible
          uid={uid}
          userName={userName}
          userPhotoURL={userPhotoURL}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() =>
            setPosts((prev) =>
              prev.map((p) =>
                p.id === commentPost.id
                  ? { ...p, commentsCount: p.commentsCount + 1 }
                  : p,
              ),
            )
          }
        />
      )}

      {community.rules && community.rules.length > 0 && (
        <RulesModal
          rules={community.rules}
          visible={showRules}
          onClose={() => setShowRules(false)}
        />
      )}

      <FlatList
        data={sortedPosts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={sc.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        ListHeaderComponent={() => (
          <>
            {/* ── Hero gradient header ── */}
            <LinearGradient
              colors={[c1, c2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={sc.hero}
            >
              {/* Back button */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={sc.backBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={sc.backBtnWrap}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* Icon */}
              <View style={sc.heroIcon}>
                <Text style={sc.heroEmoji}>{community.iconEmoji}</Text>
              </View>

              {/* Name + meta */}
              <Text style={sc.heroName}>{community.name}</Text>
              <View style={sc.heroBadgeRow}>
                <View style={sc.heroCatBadge}>
                  <Text style={sc.heroCatEmoji}>{meta.emoji}</Text>
                  <Text style={sc.heroCatLabel}>{meta.label}</Text>
                </View>
                {community.isVerified && (
                  <View style={sc.heroVerifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#fff" />
                    <Text style={sc.heroVerifiedText}>Verified</Text>
                  </View>
                )}
              </View>

              {/* Stats row */}
              <View style={sc.heroStats}>
                <View style={sc.heroStat}>
                  <Text style={sc.heroStatNum}>{formatMemberCount(community.memberCount)}</Text>
                  <Text style={sc.heroStatLabel}>Members</Text>
                </View>
                <View style={sc.heroStatDivider} />
                <View style={sc.heroStat}>
                  <Text style={sc.heroStatNum}>{community.postCount}</Text>
                  <Text style={sc.heroStatLabel}>Posts</Text>
                </View>
                {community.communityType !== 'open' && (
                  <>
                    <View style={sc.heroStatDivider} />
                    <View style={sc.heroStat}>
                      <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={sc.heroStatLabel}>
                        {community.communityType === 'request' ? 'Request' : 'Invite Only'}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Join button */}
              <Animated.View style={[sc.joinBtnWrap, { transform: [{ scale: joinScale }] }]}>
                <TouchableOpacity
                  onPress={handleJoinLeave}
                  disabled={joiningLoading}
                  activeOpacity={0.85}
                  style={[sc.joinBtn, joined && sc.joinBtnLeave]}
                >
                  {joiningLoading ? (
                    <ActivityIndicator size="small" color={joined ? C.error : '#fff'} />
                  ) : (
                    <>
                      <Ionicons
                        name={joined ? 'checkmark-circle' : 'add-circle-outline'}
                        size={18}
                        color={joined ? C.error : '#fff'}
                      />
                      <Text style={[sc.joinBtnText, joined && { color: C.error }]}>
                        {joined ? 'Leave' : 'Join Community'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </LinearGradient>

            {/* ── Description + rules button ── */}
            <View style={sc.descSection}>
              <Text style={sc.descText}>{community.description}</Text>
              <View style={sc.descActions}>
                {(community.tags ?? []).length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(community.tags ?? []).map((tag) => (
                      <View key={tag} style={sc.tag}>
                        <Text style={[sc.tagText, { color: C.secondary }]}>#{tag}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                {(community.rules ?? []).length > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowRules(true)}
                    style={sc.rulesBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="document-text-outline" size={14} color={C.primary} />
                    <Text style={[sc.rulesBtnText, { color: C.primary }]}>Community Rules</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Post composer (members only) ── */}
            {joined && (
              <View style={sc.composer}>
                <Avatar name={userName} photoURL={userPhotoURL} size={36} />
                <View style={sc.composerRight}>
                  <TextInput
                    style={sc.composerInput}
                    placeholder={`Share something with ${community.name}...`}
                    placeholderTextColor={C.textSecondary}
                    value={composerText}
                    onChangeText={setComposerText}
                    multiline
                    maxLength={1000}
                  />
                  {composerText.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={handlePost}
                      disabled={posting}
                      style={sc.composerSendBtn}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#FF4B6E', '#C2185B']}
                        style={sc.composerSendGrad}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        {posting
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={sc.composerSendText}>Post</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ── Non-member blurred CTA ── */}
            {!joined && posts.length > 0 && (
              <View style={sc.joinCta}>
                <LinearGradient
                  colors={[c1 + '20', c2 + '20']}
                  style={sc.joinCtaGrad}
                >
                  <Text style={sc.joinCtaText}>
                    Join to see all posts and participate
                  </Text>
                  <Animated.View style={{ transform: [{ scale: joinScale }] }}>
                    <TouchableOpacity onPress={handleJoinLeave} activeOpacity={0.85}>
                      <LinearGradient
                        colors={[c1, c2]}
                        style={sc.joinCtaBtn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={sc.joinCtaBtnText}>Join Now</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </LinearGradient>
              </View>
            )}

            {/* ── Posts section header ── */}
            {posts.length > 0 && (
              <View style={sc.postsHeader}>
                <Text style={sc.postsHeaderTitle}>Posts</Text>
                <Text style={sc.postsHeaderCount}>{posts.length}</Text>
              </View>
            )}
          </>
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="✍️"
            title="No posts yet"
            subtitle={
              joined
                ? 'Be the first to post something!'
                : 'Join to see and create posts'
            }
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            uid={uid}
            isPinned={item.isPinned}
            isAnnouncement={item.isAnnouncement}
            onLike={() => handleLike(item)}
            onComment={() => setCommentPost(item)}
            onNavigate={() =>
              navigation.navigate('CommunityPostDetail', {
                postId: item.id,
                communityId,
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { paddingBottom: 100 },

    // Hero
    hero: {
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    backBtn: { alignSelf: 'flex-start', marginBottom: spacing.md },
    backBtnWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    heroEmoji: { fontSize: 40 },
    heroName: {
      fontSize: 26,
      fontWeight: '800',
      color: '#fff',
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: spacing.sm,
    },
    heroBadgeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    heroCatBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    heroCatEmoji: { fontSize: 13 },
    heroCatLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
    heroVerifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    heroVerifiedText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    heroStat: { alignItems: 'center', gap: 2 },
    heroStatNum: { fontSize: 18, fontWeight: '800', color: '#fff' },
    heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
    heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.3)' },

    // Join button
    joinBtnWrap: {},
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.5)',
      paddingHorizontal: 28,
      paddingVertical: 11,
      borderRadius: radius.full,
    },
    joinBtnLeave: {
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: 'transparent',
    },
    joinBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#fff',
    },

    // Description
    descSection: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    descText: {
      fontSize: 14,
      color: C.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    descActions: {
      gap: spacing.sm,
    },
    tag: {
      backgroundColor: C.secondary + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      marginRight: spacing.xs,
    },
    tagText: { fontSize: 11, fontWeight: '600' },
    rulesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
    },
    rulesBtnText: { fontSize: 13, fontWeight: '700' },

    // Composer
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    composerRight: { flex: 1 },
    composerInput: {
      backgroundColor: C.inputBg,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      color: C.text,
      minHeight: 44,
      maxHeight: 120,
    },
    composerSendBtn: { alignSelf: 'flex-end', marginTop: spacing.sm },
    composerSendGrad: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: radius.full,
    },
    composerSendText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    // Join CTA
    joinCta: {
      margin: spacing.md,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    joinCtaGrad: {
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: radius.lg,
    },
    joinCtaText: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    joinCtaBtn: {
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: radius.full,
    },
    joinCtaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

    // Posts header
    postsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    postsHeaderTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: C.text,
    },
    postsHeaderCount: {
      fontSize: 13,
      fontWeight: '700',
      color: C.textSecondary,
      backgroundColor: C.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
  });
}
