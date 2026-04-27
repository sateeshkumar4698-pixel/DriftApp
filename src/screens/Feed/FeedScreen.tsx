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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the effective post type, accounting for legacy `postType` field */
function resolvePostType(post: Post): PostType {
  const t = post.type ?? post.postType;
  if (t === 'moment' || t === 'memory' || t === 'vibe' || t === 'question' || t === 'achievement') {
    // Map legacy types to canonical ones
    if (post.mediaURL) return 'image';
    if (t === 'question') return 'text';
    return 'text';
  }
  return (t as PostType) ?? 'text';
}

function resolveCommentCount(post: Post): number {
  return (post.commentCount ?? post.comments) ?? 0;
}

// ─── Post type config ─────────────────────────────────────────────────────────

interface PostTypeConfig {
  label: string;
  emoji: string;
  color: string;
}

const POST_TYPE_CONFIG: Record<string, PostTypeConfig> = {
  text:   { label: 'Text',   emoji: '📝', color: '#6C5CE7' },
  image:  { label: 'Photo',  emoji: '📷', color: '#0984E3' },
  thread: { label: 'Thread', emoji: '🧵', color: '#E17055' },
  poll:   { label: 'Poll',   emoji: '📊', color: '#00B894' },
};

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
  { id: 'arjun',  name: 'Arjun',  initial: 'A', color: '#FF4B6E', hasStory: true },
];

// ─── Stories bar ──────────────────────────────────────────────────────────────

function StoriesBar({ userName, userPhotoURL }: { userName: string; userPhotoURL?: string }) {
  const items: StoryItem[] = [
    {
      id: 'me',
      name: 'Your Story',
      initial: userName ? userName[0].toUpperCase() : '?',
      color: colors.primary,
      hasStory: false,
      isUser: true,
    },
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
            <View style={[sb.ring, item.hasStory ? sb.ringActive : sb.ringInactive]}>
              <View style={[sb.circle, { backgroundColor: item.color }]}>
                {item.isUser && userPhotoURL ? (
                  <Image source={{ uri: userPhotoURL }} style={sb.photo} />
                ) : (
                  <Text style={sb.initial}>{item.initial}</Text>
                )}
                {item.isUser && (
                  <View style={sb.addBadge}>
                    <Ionicons name="add" size={10} color="#fff" />
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
  item: { alignItems: 'center', width: 66 },
  ring: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, padding: 2,
  },
  ringActive:   { borderColor: colors.primary },
  ringInactive: { borderColor: colors.border },
  circle: {
    flex: 1, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photo:   { width: '100%', height: '100%' },
  initial: { fontSize: 20, fontWeight: '700', color: '#fff' },
  addBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  name: {
    ...typography.small, color: colors.textSecondary,
    marginTop: spacing.xs, textAlign: 'center', maxWidth: 62,
  },
});

// ─── Hashtag-highlighted caption ──────────────────────────────────────────────

function HighlightedCaption({
  text,
  style,
  numberOfLines,
}: {
  text: string;
  style?: object;
  numberOfLines?: number;
}) {
  // Split on hashtags so we can colour them
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <Text key={i} style={{ color: colors.primary, fontWeight: '600' }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

// ─── Poll content ─────────────────────────────────────────────────────────────

function PollContent({ post, uid }: { post: Post; uid: string }) {
  const rawOptions = post.pollOptions ?? [];

  // Normalise: legacy options may lack an `id` field
  const [localOptions, setLocalOptions] = useState(
    rawOptions.map((o, i) => ({
      id: 'id' in o ? (o as { id: string }).id : String(i),
      text: o.text,
      votes: [...o.votes],
    })),
  );

  const totalVotes = localOptions.reduce((s, o) => s + o.votes.length, 0);
  const hasVoted   = localOptions.some((o) => o.votes.includes(uid));

  function handleVote(idx: number) {
    if (!uid) return;
    setLocalOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) {
          // single-choice: clear votes from other options
          return { ...opt, votes: opt.votes.filter((u) => u !== uid) };
        }
        const alreadyVoted = opt.votes.includes(uid);
        return {
          ...opt,
          votes: alreadyVoted
            ? opt.votes.filter((u) => u !== uid)
            : [...opt.votes, uid],
        };
      }),
    );
  }

  return (
    <View style={poll.container}>
      {localOptions.map((opt, idx) => {
        const pct    = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
        const voted  = opt.votes.includes(uid);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[poll.option, voted && poll.optionVoted]}
            onPress={() => handleVote(idx)}
            activeOpacity={0.8}
          >
            {/* fill bar */}
            <View style={[poll.bar, { width: `${pct}%` as `${number}%` }]} />
            <Text style={[poll.optionText, voted && poll.optionTextVoted]}>
              {opt.text}
            </Text>
            {hasVoted && (
              <Text style={poll.pct}>{pct}%</Text>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={poll.meta}>
        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        {post.pollEndsAt && post.pollEndsAt > Date.now()
          ? ` · ends ${formatRelativeTime(post.pollEndsAt)}`
          : ''}
      </Text>
    </View>
  );
}

const poll = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  option: {
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    overflow: 'hidden', position: 'relative', minHeight: 46,
    justifyContent: 'center', backgroundColor: colors.surface,
  },
  optionVoted: { borderColor: colors.primary },
  bar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: colors.primary + '1A',
  },
  optionText: { ...typography.body, color: colors.text, fontWeight: '500', zIndex: 1 },
  optionTextVoted: { color: colors.primary, fontWeight: '700' },
  pct: {
    position: 'absolute', right: spacing.md,
    ...typography.small, color: colors.textSecondary, fontWeight: '600',
  },
  meta: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});

// ─── Thread content ───────────────────────────────────────────────────────────

function ThreadContent({ lines, caption }: { lines?: string[]; caption: string }) {
  const [expanded, setExpanded] = useState(false);
  const allLines = lines && lines.length > 0 ? lines : [caption];
  const visibleLines = expanded ? allLines : allLines.slice(0, 3);
  const hasMore = allLines.length > 3;

  return (
    <View style={thread.container}>
      {/* Drift "wave" connector */}
      <View style={thread.waveBar} />
      <View style={thread.content}>
        {visibleLines.map((line, i) => (
          <View key={i} style={thread.segment}>
            <Text style={thread.line}>{line}</Text>
          </View>
        ))}
        {hasMore && !expanded && (
          <TouchableOpacity onPress={() => setExpanded(true)} style={thread.readMore}>
            <Text style={thread.readMoreText}>Read more →</Text>
          </TouchableOpacity>
        )}
        {expanded && hasMore && (
          <TouchableOpacity onPress={() => setExpanded(false)} style={thread.readMore}>
            <Text style={thread.readMoreText}>Show less</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const thread = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  waveBar: {
    width: 3, borderRadius: 2,
    backgroundColor: colors.primary + '40',
    marginRight: spacing.sm,
  },
  content: { flex: 1 },
  segment: { marginBottom: spacing.sm },
  line: { ...typography.body, color: colors.text, lineHeight: 26, fontSize: 16 },
  readMore: { marginTop: spacing.xs },
  readMoreText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});

// ─── Comments modal ───────────────────────────────────────────────────────────

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
    maxHeight: '80%', paddingBottom: 28,
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
  title:      { ...typography.body, fontWeight: '700', color: colors.text },
  empty:      { ...typography.body, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl },
  list:       { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: 360 },
  row:        { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'flex-start' },
  bubble:     { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
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

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  uid,
  onLike,
  onBookmark,
  onCommentOpen,
}: {
  post: Post;
  uid: string;
  onLike: () => void;
  onBookmark: () => void;
  onCommentOpen: () => void;
}) {
  const liked        = post.likes.includes(uid);
  const saved        = (post.savedBy ?? []).includes(uid);
  const effectiveType = resolvePostType(post);
  const typeCfg      = POST_TYPE_CONFIG[effectiveType] ?? POST_TYPE_CONFIG.text;
  const commentCount = resolveCommentCount(post);

  // Like animation
  const likeScale = useRef(new Animated.Value(1)).current;
  function animateLike() {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  }

  // Double-tap heart overlay (image posts)
  const lastTapRef       = useRef(0);
  const heartOpacity     = useRef(new Animated.Value(0)).current;
  const heartScale       = useRef(new Animated.Value(0)).current;

  function handleImagePress() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) { onLike(); animateLike(); }
      heartOpacity.setValue(1);
      heartScale.setValue(0.4);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 80 }),
        Animated.delay(500),
        Animated.timing(heartOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
    lastTapRef.current = now;
  }

  const imageHeight = SCREEN_WIDTH * (effectiveType === 'image' ? 0.8 : 0.6);

  return (
    <View style={card.container}>
      {/* ── Header ── */}
      <View style={card.header}>
        <Avatar name={post.userName} photoURL={post.userPhotoURL} size={38} />
        <View style={card.headerMeta}>
          <Text style={card.username}>{post.userName}</Text>
          <Text style={card.time}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
        {/* Type badge */}
        <View style={[card.badge, { backgroundColor: typeCfg.color + '15', borderColor: typeCfg.color + '35' }]}>
          <Text style={card.badgeEmoji}>{typeCfg.emoji}</Text>
          <Text style={[card.badgeLabel, { color: typeCfg.color }]}>{typeCfg.label}</Text>
        </View>
        <TouchableOpacity style={card.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {effectiveType === 'thread' ? (
        <ThreadContent lines={post.threadLines} caption={post.caption} />
      ) : effectiveType === 'poll' ? (
        <>
          {!!post.caption && (
            <HighlightedCaption
              text={post.caption}
              style={card.caption}
              numberOfLines={4}
            />
          )}
          <PollContent post={post} uid={uid} />
        </>
      ) : effectiveType === 'image' ? (
        <>
          {!!post.caption && (
            <HighlightedCaption
              text={post.caption}
              style={card.caption}
              numberOfLines={3}
            />
          )}
          {!!post.mediaURL && (
            <TouchableWithoutFeedback onPress={handleImagePress}>
              <View style={[card.imageWrap, { height: imageHeight }]}>
                <Image
                  source={{ uri: post.mediaURL }}
                  style={card.image}
                  resizeMode="cover"
                />
                <Animated.View
                  style={[card.heartOverlay, { opacity: heartOpacity }]}
                  pointerEvents="none"
                >
                  <Animated.Text style={[card.heartEmoji, { transform: [{ scale: heartScale }] }]}>
                    ❤️
                  </Animated.Text>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          )}
        </>
      ) : (
        /* text post */
        !!post.caption && (
          <HighlightedCaption
            text={post.caption}
            style={card.caption}
            numberOfLines={6}
          />
        )
      )}

      {/* ── Tags ── */}
      {(post.tags ?? []).length > 0 && (
        <View style={card.tagsRow}>
          {(post.tags ?? []).map((tag) => (
            <View key={tag} style={card.tag}>
              <Text style={card.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Likes count ── */}
      <View style={card.likesRow}>
        {post.likes.length > 0 && (
          <Text style={card.likesText}>
            ❤️ {post.likes.length} {post.likes.length === 1 ? 'like' : 'likes'}
          </Text>
        )}
        {commentCount > 0 && (
          <TouchableOpacity onPress={onCommentOpen}>
            <Text style={card.viewComments}>
              View all {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Action bar ── */}
      <View style={card.actions}>
        {/* Heart */}
        <TouchableOpacity
          style={card.actionBtn}
          onPress={() => { animateLike(); onLike(); }}
          activeOpacity={0.75}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
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
          {commentCount > 0 && (
            <Text style={card.actionCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={card.actionBtn}
          onPress={() => Alert.alert('Share', 'Share — coming soon!')}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-redo-outline" size={22} color={colors.textSecondary} />
          {(post.shareCount ?? 0) > 0 && (
            <Text style={card.actionCount}>{post.shareCount}</Text>
          )}
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Bookmark */}
        <TouchableOpacity onPress={onBookmark} activeOpacity={0.75}>
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
  headerMeta: { flex: 1 },
  username:   { ...typography.caption, fontWeight: '700', color: colors.text },
  time:       { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  badgeEmoji: { fontSize: 11 },
  badgeLabel: { ...typography.small, fontWeight: '700', letterSpacing: 0.2, fontSize: 11 },
  moreBtn:    { padding: spacing.xs },
  caption: {
    ...typography.body, color: colors.text, lineHeight: 24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs, paddingBottom: spacing.sm,
  },
  imageWrap: {
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.xs,
  },
  image:       { width: '100%', height: '100%' },
  heartOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  heartEmoji: { fontSize: 80 },
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
  likesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  likesText:    { ...typography.small, color: colors.text, fontWeight: '700' },
  viewComments: { ...typography.small, color: colors.textSecondary, fontWeight: '500' },
  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.md,
  },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
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
  const [pageLoading, setPageLoading] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);

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

  // ── Optimistic bookmark ──
  function handleBookmark(post: Post) {
    if (!uid) return;
    const saved = (post.savedBy ?? []).includes(uid);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              savedBy: saved
                ? (p.savedBy ?? []).filter((u) => u !== uid)
                : [...(p.savedBy ?? []), uid],
            }
          : p,
      ),
    );
    toggleBookmark(post.id, uid, saved).catch(() => load(true));
  }

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
              prev.map((p) =>
                p.id === commentPost.id
                  ? {
                      ...p,
                      commentCount: (p.commentCount ?? p.comments ?? 0) + 1,
                      comments: (p.commentCount ?? p.comments ?? 0) + 1,
                    }
                  : p,
              ),
            )
          }
        />
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>Drift</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('CreatePost')}
          >
            <Ionicons name="camera-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stories ── */}
      <StoriesBar userName={userName} userPhotoURL={userPhotoURL} />

      {/* ── Feed ── */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={colors.primary}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          // Pagination hook — extend with cursor when backend supports it
          if (!pageLoading) {
            setPageLoading(true);
            setTimeout(() => setPageLoading(false), 500);
          }
        }}
        ListEmptyComponent={
          <EmptyState
            emoji="🌊"
            title="No posts yet"
            subtitle="Be the first to share something amazing!"
          />
        }
        ListFooterComponent={
          pageLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: spacing.lg }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            uid={uid}
            onLike={() => handleLike(item)}
            onBookmark={() => handleBookmark(item)}
            onCommentOpen={() => setCommentPost(item)}
          />
        )}
      />

      {/* ── FAB ── */}
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
  flex:    { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  wordmark: { fontSize: 26, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.sm },
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
