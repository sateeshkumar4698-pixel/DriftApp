import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  getPosts,
  togglePostLike,
  togglePostReaction,
  toggleBookmark,
  addPostComment,
  getPostComments,
} from '../../utils/firestore-helpers';
import { formatRelativeTime } from '../../utils/helpers';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { FeedStackParamList, Post, PostComment, PostType } from '../../types';

type Nav = NativeStackNavigationProp<FeedStackParamList>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_HEIGHT = (SCREEN_WIDTH - spacing.md * 2) * 0.75;

// ─── Post type config ─────────────────────────────────────────────────────────

interface PostTypeConfig {
  label: string;
  emoji: string;
  color: string;
  bg: string;
}

const POST_TYPE_CONFIG: Record<PostType, PostTypeConfig> = {
  moment:      { label: 'Moment',      emoji: '📸', color: '#0984E3', bg: '#0984E306' },
  memory:      { label: 'Memory',      emoji: '🌟', color: '#FDCB6E', bg: '#FDCB6E06' },
  vibe:        { label: 'Vibe',        emoji: '✨', color: '#6C5CE7', bg: '#6C5CE706' },
  question:    { label: 'Question',    emoji: '🤔', color: '#00B894', bg: '#00B89406' },
  achievement: { label: 'Achievement', emoji: '🏆', color: '#FF4B6E', bg: '#FF4B6E06' },
  thread:      { label: 'Thread',      emoji: '💭', color: '#E17055', bg: '#E1705506' },
  poll:        { label: 'Poll',        emoji: '📊', color: '#0984E3', bg: '#0984E306' },
};

// ─── Reactions ────────────────────────────────────────────────────────────────

const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏'];

// ─── Trending topics ──────────────────────────────────────────────────────────

const TRENDING = ['#vibecheck', '#memories', '#goodvibes', '#drifters', '#connections'];

// ─── Mock stories ─────────────────────────────────────────────────────────────

interface StoryItem {
  id: string;
  name: string;
  initial: string;
  color: string;
  hasStory: boolean;
  isUser?: boolean;
}

const MOCK_STORIES: StoryItem[] = [
  { id: 'priya',  name: 'Priya',  initial: 'P', color: '#E17055', hasStory: true },
  { id: 'rahul',  name: 'Rahul',  initial: 'R', color: '#0984E3', hasStory: true },
  { id: 'anjali', name: 'Anjali', initial: 'A', color: '#6C5CE7', hasStory: true },
  { id: 'dev',    name: 'Dev',    initial: 'D', color: '#00B894', hasStory: false },
  { id: 'mia',    name: 'Mia',    initial: 'M', color: '#FDCB6E', hasStory: true },
];

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS: { key: PostType | 'all'; label: string }[] = [
  { key: 'all',         label: 'For You' },
  { key: 'moment',      label: 'Moments 📸' },
  { key: 'vibe',        label: 'Vibes ✨' },
  { key: 'thread',      label: 'Thoughts 💭' },
  { key: 'question',    label: 'Questions 🤔' },
];

// ─── Stories bar ──────────────────────────────────────────────────────────────

function StoriesBar({ userName, userPhotoURL }: { userName: string; userPhotoURL?: string }) {
  const items: StoryItem[] = [
    { id: 'me', name: 'Your Story', initial: userName ? userName[0].toUpperCase() : '?', color: colors.primary, hasStory: false, isUser: true },
    ...MOCK_STORIES,
  ];

  return (
    <View style={sb.wrap}>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sb.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={sb.item} activeOpacity={0.8}>
            <View style={[sb.ring, item.hasStory && sb.ringActive]}>
              <View style={[sb.circle, { backgroundColor: item.color }]}>
                {item.isUser && userPhotoURL ? (
                  <Image source={{ uri: userPhotoURL }} style={sb.photo} />
                ) : (
                  <Text style={sb.initial}>{item.initial}</Text>
                )}
                {item.isUser && (
                  <View style={sb.addIcon}>
                    <Ionicons name="add" size={12} color="#fff" />
                  </View>
                )}
              </View>
            </View>
            <Text style={sb.name} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  list: { paddingHorizontal: spacing.md, gap: spacing.md },
  item: { alignItems: 'center', width: 70 },
  ring: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2, borderColor: colors.border,
    padding: 2,
  },
  ringActive: { borderColor: colors.primary },
  circle: {
    flex: 1, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  initial: { fontSize: 22, fontWeight: '700', color: '#fff' },
  addIcon: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  name: { ...typography.small, color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 64 },
});

// ─── Comment modal ────────────────────────────────────────────────────────────

function CommentsModal({
  post,
  visible,
  uid,
  userName,
  userPhotoURL,
  onClose,
  onCommentAdded,
}: {
  post: Post;
  visible: boolean;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  onClose: () => void;
  onCommentAdded: () => void;
}) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [posting, setPosting]   = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getPostComments(post.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, post.id]);

  async function handleSend() {
    if (!text.trim()) return;
    setPosting(true);
    const comment: PostComment = {
      id: `cmt_${Date.now()}_${uid}`,
      userId: uid,
      userName,
      userPhotoURL,
      text: text.trim(),
      createdAt: Date.now(),
    };
    try {
      await addPostComment(post.id, comment);
      setComments((prev) => [comment, ...prev]);
      setText('');
      onCommentAdded();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <View style={cm.header}>
            <Text style={cm.title}>Comments</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : comments.length === 0 ? (
            <Text style={cm.empty}>No comments yet — be the first! 💬</Text>
          ) : (
            <ScrollView style={cm.list} showsVerticalScrollIndicator={false}>
              {comments.map((c) => (
                <View key={c.id} style={cm.row}>
                  <Avatar name={c.userName} photoURL={c.userPhotoURL} size={34} />
                  <View style={cm.bubble}>
                    <Text style={cm.bubbleName}>{c.userName}</Text>
                    <Text style={cm.bubbleText}>{c.text}</Text>
                    <Text style={cm.bubbleTime}>{formatRelativeTime(c.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={cm.inputRow}>
            <Avatar name={userName} photoURL={userPhotoURL} size={32} />
            <TextInput
              style={cm.input}
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[cm.sendBtn, (!text.trim() || posting) && cm.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || posting}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    maxHeight: '80%', paddingBottom: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { ...typography.body, fontWeight: '700', color: colors.text },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: 360 },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  bubble: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.sm,
  },
  bubbleName: { ...typography.small, fontWeight: '700', color: colors.text },
  bubbleText: { ...typography.body, color: colors.text, marginTop: 2, lineHeight: 22 },
  bubbleTime: { ...typography.small, color: colors.textSecondary, marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, ...typography.body, color: colors.text,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border, maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});

// ─── Poll card content ────────────────────────────────────────────────────────

function PollContent({
  post,
  uid,
}: {
  post: Post;
  uid: string;
}) {
  const [localOptions, setLocalOptions] = useState(
    (post.pollOptions ?? []).map((o) => ({ ...o, votes: [...o.votes] })),
  );

  const totalVotes = localOptions.reduce((s, o) => s + o.votes.length, 0);
  const hasVoted   = localOptions.some((o) => o.votes.includes(uid));

  function toggleVote(idx: number) {
    if (!uid) return;
    setLocalOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) {
          // If single-choice: remove vote from all others
          return { ...opt, votes: opt.votes.filter((u) => u !== uid) };
        }
        const alreadyVoted = opt.votes.includes(uid);
        return {
          ...opt,
          votes: alreadyVoted ? opt.votes.filter((u) => u !== uid) : [...opt.votes, uid],
        };
      }),
    );
  }

  return (
    <View style={pc.container}>
      {localOptions.map((opt, idx) => {
        const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
        const voted = opt.votes.includes(uid);
        return (
          <TouchableOpacity
            key={idx}
            style={[pc.option, voted && pc.optionVoted]}
            onPress={() => toggleVote(idx)}
            activeOpacity={0.8}
          >
            <View style={[pc.bar, { width: `${pct}%` as `${number}%` }]} />
            <Text style={[pc.optionText, voted && pc.optionTextVoted]}>{opt.text}</Text>
            {hasVoted && (
              <Text style={pc.pct}>{pct}%</Text>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={pc.meta}>{totalVotes} votes</Text>
    </View>
  );
}

const pc = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  option: {
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    overflow: 'hidden', position: 'relative', minHeight: 44,
    justifyContent: 'center',
  },
  optionVoted: { borderColor: colors.primary },
  bar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: colors.primary + '18', borderRadius: radius.md,
  },
  optionText: { ...typography.body, color: colors.text, fontWeight: '500', zIndex: 1 },
  optionTextVoted: { color: colors.primary, fontWeight: '700' },
  pct: { position: 'absolute', right: spacing.md, ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  meta: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  uid,
  userName,
  userPhotoURL,
  onLike,
  onReaction,
  onBookmark,
  onCommentOpen,
}: {
  post: Post;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  onLike: () => void;
  onReaction: (emoji: string) => void;
  onBookmark: () => void;
  onCommentOpen: () => void;
}) {
  const liked   = post.likes.includes(uid);
  const saved   = (post.savedBy ?? []).includes(uid);
  const typeCfg = post.postType ? POST_TYPE_CONFIG[post.postType] : POST_TYPE_CONFIG.moment;
  const isThread = post.postType === 'thread';
  const isPoll   = post.postType === 'poll';

  // Reaction state
  const reactions = post.reactions ?? {};
  const reactionEntries = Object.entries(reactions)
    .map(([emoji, uids]) => ({ emoji, count: uids.length }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const myReaction = REACTIONS.find((e) => (reactions[e] ?? []).includes(uid));

  // Double-tap to like
  const lastTapRef = useRef<number>(0);
  const heartOverlayAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim   = useRef(new Animated.Value(0)).current;

  function handleImageDoubleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap!
      if (!liked) {
        onLike();
      }
      // Animate heart overlay
      heartOverlayAnim.setValue(1);
      heartScaleAnim.setValue(0);
      Animated.sequence([
        Animated.spring(heartScaleAnim, { toValue: 1.4, useNativeDriver: true, speed: 60 }),
        Animated.delay(500),
        Animated.timing(heartOverlayAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    lastTapRef.current = now;
  }

  // Like button scale
  const likeScale = useRef(new Animated.Value(1)).current;
  function animateLike() {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, speed: 60 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }

  const totalLikes = post.likes.length;

  return (
    <View style={[card.container, isThread && { backgroundColor: typeCfg.bg }]}>
      {/* Header row */}
      <View style={card.header}>
        <Avatar name={post.userName} photoURL={post.userPhotoURL} size={36} />
        <View style={card.headerInfo}>
          <Text style={card.username}>{post.userName}</Text>
          <Text style={card.time}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
        {/* Type badge pill */}
        <View style={[card.typeBadge, { backgroundColor: typeCfg.color + '18', borderColor: typeCfg.color + '40' }]}>
          <Text style={card.typeBadgeEmoji}>{typeCfg.emoji}</Text>
          <Text style={[card.typeBadgeLabel, { color: typeCfg.color }]}>{typeCfg.label}</Text>
        </View>
        <TouchableOpacity style={card.menuBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Caption / thread text */}
      {!!post.caption && (
        <Text
          style={[card.caption, isThread && card.threadCaption]}
          numberOfLines={isThread ? undefined : 4}
        >
          {post.caption}
        </Text>
      )}

      {/* Tags */}
      {!isPoll && (post.tags ?? []).length > 0 && (
        <View style={card.tagsRow}>
          {(post.tags ?? []).map((tag) => (
            <View key={tag} style={card.tag}>
              <Text style={card.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Image (photo posts) */}
      {!!post.mediaURL && !isPoll && (
        <TouchableWithoutFeedback onPress={handleImageDoubleTap}>
          <View style={card.imageWrap}>
            <Image
              source={{ uri: post.mediaURL }}
              style={card.image}
              resizeMode="cover"
            />
            {/* Heart overlay on double-tap */}
            <Animated.View
              style={[card.heartOverlay, { opacity: heartOverlayAnim }]}
              pointerEvents="none"
            >
              <Animated.Text
                style={[card.heartEmoji, { transform: [{ scale: heartScaleAnim }] }]}
              >
                ❤️
              </Animated.Text>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Poll content */}
      {isPoll && post.pollOptions && post.pollOptions.length > 0 && (
        <PollContent post={post} uid={uid} />
      )}

      {/* Reactions strip */}
      {reactionEntries.length > 0 && (
        <View style={card.reactionsStrip}>
          {reactionEntries.map(({ emoji, count }) => (
            <TouchableOpacity
              key={emoji}
              style={[
                card.reactionPill,
                (reactions[emoji] ?? []).includes(uid) && card.reactionPillActive,
              ]}
              onPress={() => onReaction(emoji)}
              activeOpacity={0.75}
            >
              <Text style={card.reactionEmoji}>{emoji}</Text>
              <Text style={card.reactionCount}>{count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Likes count + view comments */}
      <View style={card.likesRow}>
        {totalLikes > 0 && (
          <Text style={card.likesText}>❤️ {totalLikes} {totalLikes === 1 ? 'like' : 'likes'}</Text>
        )}
        {post.comments > 0 && (
          <TouchableOpacity onPress={onCommentOpen}>
            <Text style={card.viewComments}>View {post.comments} comments →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action bar */}
      <View style={card.actions}>
        {/* Like */}
        <TouchableOpacity
          style={card.actionBtn}
          onPress={() => { animateLike(); onLike(); }}
          activeOpacity={0.75}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? colors.primary : colors.textSecondary}
            />
          </Animated.View>
          {post.likes.length > 0 && (
            <Text style={[card.actionCount, liked && { color: colors.primary }]}>
              {post.likes.length}
            </Text>
          )}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={card.actionBtn} onPress={onCommentOpen} activeOpacity={0.75}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.textSecondary} />
          {post.comments > 0 && (
            <Text style={card.actionCount}>{post.comments}</Text>
          )}
        </TouchableOpacity>

        {/* Repost */}
        <TouchableOpacity
          style={card.actionBtn}
          onPress={() => Alert.alert('Repost', 'Repost — coming soon!')}
          activeOpacity={0.75}
        >
          <Ionicons name="repeat-outline" size={22} color={colors.textSecondary} />
          {(post.repostCount ?? 0) > 0 && (
            <Text style={card.actionCount}>{post.repostCount}</Text>
          )}
        </TouchableOpacity>

        {/* Emoji reactions strip trigger */}
        <View style={card.reactionsBtnRow}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => onReaction(emoji)}
              style={card.emojiTap}
              activeOpacity={0.7}
            >
              <Text style={card.emojiTapText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bookmark */}
        <TouchableOpacity style={card.bookmarkBtn} onPress={onBookmark} activeOpacity={0.75}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={saved ? colors.secondary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
    paddingBottom: spacing.xs, gap: spacing.sm,
  },
  headerInfo: { flex: 1 },
  username: { ...typography.body, fontWeight: '700', color: colors.text, fontSize: 14 },
  time: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  typeBadgeEmoji: { fontSize: 11 },
  typeBadgeLabel: { ...typography.small, fontWeight: '700', letterSpacing: 0.2, fontSize: 11 },
  menuBtn: { padding: spacing.xs },

  caption: {
    ...typography.body, color: colors.text, lineHeight: 24,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm, paddingTop: spacing.xs,
  },
  threadCaption: {
    fontSize: 18, lineHeight: 26, fontWeight: '400',
  },

  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.secondary + '12',
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.full,
  },
  tagText: { ...typography.small, color: colors.secondary, fontWeight: '600' },

  imageWrap: {
    marginHorizontal: 0,
    height: IMAGE_HEIGHT,
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  image: { width: '100%', height: '100%', borderRadius: radius.md },
  heartOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  heartEmoji: { fontSize: 80 },

  reactionsStrip: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xs,
  },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  reactionPillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { ...typography.small, color: colors.text, fontWeight: '600' },

  likesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  likesText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  viewComments: { ...typography.small, color: colors.primary, fontWeight: '600' },

  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  reactionsBtnRow: { flex: 1, flexDirection: 'row', gap: 2, justifyContent: 'center' },
  emojiTap: { padding: 2 },
  emojiTapText: { fontSize: 16 },
  bookmarkBtn: { marginLeft: 'auto' },
});

// ─── Main Feed Screen ─────────────────────────────────────────────────────────

export default function FeedScreen() {
  const navigation   = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const uid          = firebaseUser?.uid ?? '';
  const userName     = userProfile?.name ?? '';
  const userPhotoURL = userProfile?.photoURL;

  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PostType | 'all'>('all');
  const [commentPost, setCommentPost]   = useState<Post | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await getPosts();
      setPosts(data);
    } catch {
      Alert.alert('Error', 'Failed to load feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(true); }, []));
  useEffect(() => { load(); }, []);

  // ── Optimistic like ──
  function handleLike(post: Post) {
    if (!uid) return;
    const liked = post.likes.includes(uid);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likes: liked ? p.likes.filter((u) => u !== uid) : [...p.likes, uid] }
          : p,
      ),
    );
    togglePostLike(post.id, uid, liked).catch(() => load(true));
  }

  // ── Optimistic reaction ──
  function handleReaction(post: Post, emoji: string) {
    if (!uid) return;
    const current    = (post.reactions ?? {})[emoji] ?? [];
    const hasReacted = current.includes(uid);
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== post.id) return p;
        const rxns = { ...(p.reactions ?? {}) };
        rxns[emoji] = hasReacted
          ? (rxns[emoji] ?? []).filter((u) => u !== uid)
          : [...(rxns[emoji] ?? []), uid];
        return { ...p, reactions: rxns };
      }),
    );
    togglePostReaction(post.id, uid, emoji, hasReacted).catch(() => load(true));
  }

  // ── Optimistic bookmark ──
  function handleBookmark(post: Post) {
    if (!uid) return;
    const saved = (post.savedBy ?? []).includes(uid);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, savedBy: saved ? (p.savedBy ?? []).filter((u) => u !== uid) : [...(p.savedBy ?? []), uid] }
          : p,
      ),
    );
    toggleBookmark(post.id, uid, saved).catch(() => load(true));
  }

  const filtered = activeFilter === 'all'
    ? posts
    : posts.filter((p) => (p.postType ?? 'moment') === activeFilter);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Comments modal */}
      {commentPost && (
        <CommentsModal
          post={commentPost}
          visible={!!commentPost}
          uid={uid}
          userName={userName}
          userPhotoURL={userPhotoURL}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() =>
            setPosts((prev) =>
              prev.map((p) => p.id === commentPost.id ? { ...p, comments: p.comments + 1 } : p),
            )
          }
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>Drift</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories bar */}
      <StoriesBar userName={userName} userPhotoURL={userPhotoURL} />

      {/* Filter tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabBtn}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabLabel, activeFilter === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {activeFilter === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Feed list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            emoji="✨"
            title={activeFilter === 'all' ? 'Nothing here yet' : `No ${activeFilter} posts yet`}
            subtitle="Be the first to share something amazing!"
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            uid={uid}
            userName={userName}
            userPhotoURL={userPhotoURL}
            onLike={() => handleLike(item)}
            onReaction={(emoji) => handleReaction(item, emoji)}
            onBookmark={() => handleBookmark(item)}
            onCommentOpen={() => setCommentPost(item)}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  wordmark: {
    fontSize: 26, fontWeight: '800', color: colors.primary, letterSpacing: -0.5,
  },
  headerIcons: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.sm },

  tabsWrap: {
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabs: { paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: 'flex-end' },
  tabBtn: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 0, alignItems: 'center' },
  tabLabel: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, paddingBottom: spacing.sm },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  tabUnderline: {
    height: 2, borderRadius: 1, backgroundColor: colors.primary,
    width: '100%', marginTop: -1,
  },

  list:           { paddingTop: spacing.md, paddingBottom: 120 },
  emptyContainer: { flex: 1 },

  fab: {
    position: 'absolute', bottom: 90, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
