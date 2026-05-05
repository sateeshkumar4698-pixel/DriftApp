import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  useWindowDimensions,
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
  toggleBookmark,
  addPostComment,
  getPostComments,
  castPollVote,
  subscribeToConnections,
  getUserProfile,
  getActiveStatuses,
  sendMessage,
} from '../../utils/firestore-helpers';
import { formatRelativeTime } from '../../utils/helpers';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius, typography, shadows } from '../../utils/theme';
import { Connection, FeedStackParamList, Message, Post, PostComment, PostType, UserProfile } from '../../types';

type Nav = NativeStackNavigationProp<FeedStackParamList>;

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

// ─── Connection story item ────────────────────────────────────────────────────

interface ConnectionStoryItem {
  uid: string;
  name: string;
  photoURL?: string;
  hasStatus: boolean;
}

// ─── Stories bar ──────────────────────────────────────────────────────────────

function StoriesBar({
  userName,
  userPhotoURL,
  connectionStories,
}: {
  userName: string;
  userPhotoURL?: string;
  connectionStories: ConnectionStoryItem[];
}) {
  const { C } = useTheme();
  const sb = makeSbStyles(C);

  const items: Array<{ id: string; name: string; initial: string; color: string; hasStory: boolean; isUser?: boolean; photoURL?: string }> = [
    {
      id: 'me',
      name: 'Your Story',
      initial: userName ? userName[0].toUpperCase() : '?',
      color: C.primary,
      hasStory: false,
      isUser: true,
      photoURL: userPhotoURL,
    },
    ...connectionStories.map((s) => ({
      id: s.uid,
      name: s.name.split(' ')[0],
      initial: s.name ? s.name[0].toUpperCase() : '?',
      color: C.secondary,
      hasStory: s.hasStatus,
      photoURL: s.photoURL,
    })),
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
                {item.isUser && item.photoURL ? (
                  <Image source={{ uri: item.photoURL }} style={sb.photo} />
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

function makeSbStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: C.background,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingVertical: spacing.sm,
    },
    list: { paddingHorizontal: spacing.md, gap: spacing.md },
    item: { alignItems: 'center', width: 66 },
    ring: {
      width: 64, height: 64, borderRadius: 32,
      borderWidth: 2.5, padding: 2,
    },
    ringActive:   { borderColor: C.primary },
    ringInactive: { borderColor: C.border },
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
      backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: '#fff',
    },
    name: {
      ...typography.small, color: C.textSecondary,
      marginTop: spacing.xs, textAlign: 'center', maxWidth: 62,
    },
  });
}

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
  const { C } = useTheme();
  // Split on hashtags so we can colour them
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <Text key={i} style={{ color: C.primary, fontWeight: '600' }}>
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
  const { C } = useTheme();
  const poll = makePollStyles(C);

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
    const nextOptions = localOptions.map((opt, i) => {
      if (i !== idx) {
        return { ...opt, votes: opt.votes.filter((u) => u !== uid) };
      }
      const alreadyVoted = opt.votes.includes(uid);
      return {
        ...opt,
        votes: alreadyVoted ? opt.votes.filter((u) => u !== uid) : [...opt.votes, uid],
      };
    });
    setLocalOptions(nextOptions);
    castPollVote(post.id, nextOptions).catch(() => {
      // Revert on failure
      setLocalOptions(localOptions);
    });
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

function makePollStyles(C: AppColors) {
  return StyleSheet.create({
    container: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
    option: {
      borderRadius: radius.md, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: spacing.md, paddingVertical: 12,
      overflow: 'hidden', position: 'relative', minHeight: 46,
      justifyContent: 'center', backgroundColor: C.surface,
    },
    optionVoted: { borderColor: C.primary },
    bar: {
      position: 'absolute', left: 0, top: 0, bottom: 0,
      backgroundColor: C.primary + '1A',
    },
    optionText: { ...typography.body, color: C.text, fontWeight: '500', zIndex: 1 },
    optionTextVoted: { color: C.primary, fontWeight: '700' },
    pct: {
      position: 'absolute', right: spacing.md,
      ...typography.small, color: C.textSecondary, fontWeight: '600',
    },
    meta: { ...typography.small, color: C.textSecondary, marginTop: spacing.xs },
  });
}

// ─── Thread content ───────────────────────────────────────────────────────────

function ThreadContent({ lines, caption }: { lines?: string[]; caption: string }) {
  const { C } = useTheme();
  const thread = makeThreadStyles(C);

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

function makeThreadStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    waveBar: {
      width: 3, borderRadius: 2,
      backgroundColor: C.primary + '40',
      marginRight: spacing.sm,
    },
    content: { flex: 1 },
    segment: { marginBottom: spacing.sm },
    line: { ...typography.body, color: C.text, lineHeight: 26, fontSize: 16 },
    readMore: { marginTop: spacing.xs },
    readMoreText: { ...typography.caption, color: C.primary, fontWeight: '700' },
  });
}

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
  const { C } = useTheme();
  const cm = makeCmStyles(C);

  const [comments, setComments]       = useState<PostComment[]>([]);
  const [text, setText]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [posting, setPosting]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [replyingTo, setReplyingTo]   = useState<{ id: string; userName: string } | null>(null);
  const inputRef                       = useRef<TextInput>(null);
  const lastTimestampRef               = useRef<number | null>(null);
  const PAGE_SIZE = 30;

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setHasMore(false);
    lastTimestampRef.current = null;
    getPostComments(post.id, PAGE_SIZE)
      .then(({ comments: data, hasMore: more, lastTimestamp }) => {
        setComments(data);
        setHasMore(more);
        lastTimestampRef.current = lastTimestamp;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, post.id]);

  async function loadMore() {
    if (loadingMore || !hasMore || lastTimestampRef.current === null) return;
    setLoadingMore(true);
    try {
      const { comments: more, hasMore: stillMore, lastTimestamp } = await getPostComments(
        post.id,
        PAGE_SIZE,
        lastTimestampRef.current,
      );
      if (!stillMore) setHasMore(false);
      lastTimestampRef.current = lastTimestamp;
      setComments((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !existing.has(c.id))];
      });
    } catch {/* silent */} finally {
      setLoadingMore(false);
    }
  }

  function startReply(c: PostComment) {
    setReplyingTo({ id: c.id, userName: c.userName });
    setText(`@${c.userName} `);
    inputRef.current?.focus();
  }

  function cancelReply() {
    setReplyingTo(null);
    setText('');
  }

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
      ...(replyingTo ? { replyTo: replyingTo } : {}),
    };
    try {
      await addPostComment(post.id, comment);
      setComments((prev) => [...prev, comment]);
      setText('');
      setReplyingTo(null);
      onCommentAdded();
    } catch (err) {
      console.error('[CommentsModal] addPostComment failed:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not post comment. Check your connection.');
    } finally {
      setPosting(false);
    }
  }



  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={cm.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <View style={cm.header}>
            <Text style={cm.title}>Comments ({comments.length})</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: spacing.lg }} />
          ) : comments.length === 0 ? (
            <Text style={cm.empty}>No comments yet — be the first! 💬</Text>
          ) : (
            <FlatList
              data={comments.filter((c) => !c.replyTo)}
              keyExtractor={(c) => c.id}
              style={cm.list}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loadingMore ? (
                  <ActivityIndicator color={C.primary} style={{ marginVertical: spacing.sm }} />
                ) : hasMore ? (
                  <TouchableOpacity onPress={loadMore} style={cm.loadMoreBtn}>
                    <Text style={cm.loadMoreText}>Load more comments</Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item: c }) => {
                const cReplies = comments.filter((r) => r.replyTo?.id === c.id);
                return (
                  <View>
                    {/* Top-level comment */}
                    <View style={cm.row}>
                      <Avatar name={c.userName} photoURL={c.userPhotoURL} size={34} />
                      <View style={cm.bubble}>
                        <View style={cm.bubbleTop}>
                          <Text style={cm.bubbleName}>{c.userName}</Text>
                          <Text style={cm.bubbleTime}>{formatRelativeTime(c.createdAt)}</Text>
                        </View>
                        <Text style={cm.bubbleText}>{c.text}</Text>
                        <TouchableOpacity onPress={() => startReply(c)} style={cm.replyBtn}>
                          <Ionicons name="return-down-forward-outline" size={13} color={C.primary} />
                          <Text style={cm.replyBtnText}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* Replies */}
                    {cReplies.map((r) => (
                      <View key={r.id} style={cm.replyRow}>
                        <View style={cm.replyLine} />
                        <Avatar name={r.userName} photoURL={r.userPhotoURL} size={26} />
                        <View style={[cm.bubble, { flex: 1 }]}>
                          <View style={cm.bubbleTop}>
                            <Text style={cm.bubbleName}>{r.userName}</Text>
                            <Text style={cm.bubbleTime}>{formatRelativeTime(r.createdAt)}</Text>
                          </View>
                          <Text style={cm.replyTag}>↩ {r.replyTo!.userName}</Text>
                          <Text style={cm.bubbleText}>{r.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              }}
            />
          )}

          {/* Reply banner */}
          {replyingTo && (
            <View style={cm.replyBanner}>
              <Text style={cm.replyBannerText}>
                Replying to <Text style={{ fontWeight: '700' }}>@{replyingTo.userName}</Text>
              </Text>
              <TouchableOpacity onPress={cancelReply}>
                <Ionicons name="close-circle" size={18} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={cm.inputRow}>
            <Avatar name={userName} photoURL={userPhotoURL} size={32} />
            <TextInput
              ref={inputRef}
              style={cm.input}
              value={text}
              onChangeText={setText}
              placeholder={replyingTo ? `Reply to @${replyingTo.userName}…` : 'Add a comment…'}
              placeholderTextColor={C.textSecondary}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[cm.sendBtn, (!text.trim() || posting) && cm.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || posting}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeCmStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.background,
      borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
      maxHeight: '85%', paddingBottom: 28,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
      alignSelf: 'center', marginTop: spacing.sm,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    title:       { ...typography.body, fontWeight: '700', color: C.text },
    empty:       { ...typography.body, color: C.textSecondary, textAlign: 'center', padding: spacing.xl },
    list:        { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: 380 },
    row:         { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
    replyRow:    { flexDirection: 'row', gap: spacing.xs, marginLeft: 44, marginBottom: spacing.sm, alignItems: 'flex-start' },
    replyLine:   { width: 2, backgroundColor: C.border, alignSelf: 'stretch', marginRight: 4, borderRadius: 1 },
    bubble:      { flex: 1, backgroundColor: C.surface, borderRadius: radius.md, padding: spacing.sm },
    bubbleTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bubbleName:  { ...typography.small, fontWeight: '700', color: C.text },
    bubbleText:  { ...typography.body, color: C.text, marginTop: 2, lineHeight: 22 },
    bubbleTime:  { ...typography.small, color: C.textSecondary },
    replyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.xs },
    replyBtnText:{ ...typography.small, color: C.primary, fontWeight: '600' },
    replyTag:    { ...typography.small, color: C.primary, fontWeight: '600', marginBottom: 2 },
    replyBanner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: `${C.primary}10`,
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderTopWidth: 1, borderTopColor: `${C.primary}20`,
    },
    replyBannerText: { ...typography.small, color: C.textSecondary },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
      paddingHorizontal: spacing.md, paddingTop: spacing.sm,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    input: {
      flex: 1, ...typography.body, color: C.text,
      backgroundColor: C.surface, borderRadius: radius.lg,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderWidth: 1, borderColor: C.border, maxHeight: 100,
    },
    sendBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { opacity: 0.4 },
    loadMoreBtn:     { alignItems: 'center', paddingVertical: spacing.sm },
    loadMoreText:    { ...typography.small, color: C.primary, fontWeight: '700' },
  });
}

// ─── Share to connections modal ───────────────────────────────────────────────

function ShareModal({
  post,
  visible,
  uid,
  onClose,
}: {
  post: Post;
  visible: boolean;
  uid: string;
  onClose: () => void;
}) {
  const { C } = useTheme();
  const sh = makeShStyles(C);

  const [connections, setConnections]   = useState<Connection[]>([]);
  const [profiles, setProfiles]         = useState<Record<string, UserProfile>>({});
  const [sending, setSending]           = useState<string | null>(null);
  const [sent, setSent]                 = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !uid) return;
    const unsub = subscribeToConnections(uid, setConnections);
    return unsub;
  }, [visible, uid]);

  useEffect(() => {
    if (connections.length === 0) return;
    connections.forEach((c) => {
      const otherUid = c.users.find((u) => u !== uid)!;
      if (!profiles[otherUid]) {
        getUserProfile(otherUid).then((p) => {
          if (p) setProfiles((prev) => ({ ...prev, [otherUid]: p }));
        });
      }
    });
  }, [connections]);

  async function handleSend(connection: Connection) {
    const otherUid = connection.users.find((u) => u !== uid)!;
    if (sent.has(otherUid) || sending) return;
    setSending(otherUid);
    const msg: Message = {
      id: `msg_${Date.now()}_${uid}`,
      senderId: uid,
      text: `📝 Shared a post: "${post.caption.slice(0, 80)}${post.caption.length > 80 ? '…' : ''}"`,
      createdAt: Date.now(),
    };
    try {
      await sendMessage(connection.id, msg);
      setSent((prev) => new Set([...prev, otherUid]));
    } catch {
      Alert.alert('Error', 'Could not send. Try again.');
    } finally {
      setSending(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sh.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
        <View style={sh.sheet}>
          <View style={sh.handle} />
          <View style={sh.header}>
            <Text style={sh.title}>Share to Connections</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          {connections.length === 0 ? (
            <Text style={sh.empty}>No connections yet. Connect with people on Discover!</Text>
          ) : (
            <FlatList
              data={connections}
              keyExtractor={(c) => c.id}
              contentContainerStyle={sh.list}
              renderItem={({ item }) => {
                const otherUid = item.users.find((u) => u !== uid)!;
                const profile  = profiles[otherUid];
                if (!profile) return null;
                const isSent    = sent.has(otherUid);
                const isSending = sending === otherUid;
                return (
                  <View style={sh.row}>
                    <Avatar name={profile.name} photoURL={profile.photoURL} size={44} />
                    <View style={sh.rowInfo}>
                      <Text style={sh.rowName}>{profile.name}</Text>
                      <Text style={sh.rowMeta}>{profile.city ?? ''}</Text>
                    </View>
                    <TouchableOpacity
                      style={[sh.sendBtn, isSent && sh.sendBtnSent]}
                      onPress={() => handleSend(item)}
                      disabled={isSent || !!isSending}
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : isSent ? (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      ) : (
                        <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeShStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet:        { backgroundColor: C.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '70%', paddingBottom: 32 },
    handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: spacing.sm },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: C.border },
    title:        { ...typography.body, fontWeight: '700', color: C.text },
    empty:        { ...typography.body, color: C.textSecondary, textAlign: 'center', padding: spacing.xl },
    list:         { padding: spacing.md },
    row:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    rowInfo:      { flex: 1 },
    rowName:      { ...typography.body, fontWeight: '600', color: C.text },
    rowMeta:      { ...typography.small, color: C.textSecondary },
    sendBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    sendBtnSent:  { backgroundColor: C.success },
  });
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  uid,
  onLike,
  onBookmark,
  onCommentOpen,
  onShare,
}: {
  post: Post;
  uid: string;
  onLike: () => void;
  onBookmark: () => void;
  onCommentOpen: () => void;
  onShare: () => void;
}) {
  const { C } = useTheme();
  const card = makeCardStyles(C);
  const { width: SCREEN_WIDTH } = useWindowDimensions();

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
          <Ionicons name="ellipsis-horizontal" size={18} color={C.textSecondary} />
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
              color={liked ? C.primary : C.textSecondary}
            />
          </Animated.View>
          {post.likes.length > 0 && (
            <Text style={[card.actionCount, liked && { color: C.primary }]}>
              {post.likes.length}
            </Text>
          )}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={card.actionBtn} onPress={onCommentOpen} activeOpacity={0.75}>
          <Ionicons name="chatbubble-outline" size={22} color={C.textSecondary} />
          {commentCount > 0 && (
            <Text style={card.actionCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={card.actionBtn}
          onPress={onShare}
          activeOpacity={0.75}
        >
          <Ionicons name="paper-plane-outline" size={22} color={C.textSecondary} />
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
            color={saved ? C.secondary : C.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeCardStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: C.background,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      ...shadows.card,
    },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingTop: spacing.md,
      paddingBottom: spacing.xs, gap: spacing.sm,
    },
    headerMeta: { flex: 1 },
    username:   { ...typography.caption, fontWeight: '700', color: C.text },
    time:       { ...typography.small, color: C.textSecondary, marginTop: 1 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: spacing.sm, paddingVertical: 3,
      borderRadius: radius.full, borderWidth: 1,
    },
    badgeEmoji: { fontSize: 11 },
    badgeLabel: { ...typography.small, fontWeight: '700', letterSpacing: 0.2, fontSize: 11 },
    moreBtn:    { padding: spacing.xs },
    caption: {
      ...typography.body, color: C.text, lineHeight: 24,
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
      backgroundColor: C.secondary + '12',
      paddingHorizontal: spacing.sm, paddingVertical: 2,
      borderRadius: radius.full,
    },
    tagText: { ...typography.small, color: C.secondary, fontWeight: '600' },
    likesRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    },
    likesText:    { ...typography.small, color: C.text, fontWeight: '700' },
    viewComments: { ...typography.small, color: C.textSecondary, fontWeight: '500' },
    actions: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderTopWidth: 1, borderTopColor: C.border,
      gap: spacing.md,
    },
    actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionCount: { ...typography.small, color: C.textSecondary, fontWeight: '600' },
  });
}

// ─── Main Feed Screen ─────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);

  const navigation   = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const uid          = firebaseUser?.uid ?? '';
  const userName     = userProfile?.name ?? '';
  const userPhotoURL = userProfile?.photoURL;

  const [posts, setPosts]                         = useState<Post[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [pageLoading, setPageLoading]             = useState(false);
  const [commentPost, setCommentPost]             = useState<Post | null>(null);
  const [sharePost, setSharePost]                 = useState<Post | null>(null);
  const [connectionStories, setConnectionStories] = useState<ConnectionStoryItem[]>([]);

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

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToConnections(uid, async (connections: Connection[]) => {
      if (connections.length === 0) { setConnectionStories([]); return; }
      const otherUids = connections.map((c) =>
        c.users[0] === uid ? c.users[1] : c.users[0],
      ).slice(0, 10);
      try {
        const [statuses, profiles] = await Promise.all([
          getActiveStatuses(otherUids),
          Promise.all(otherUids.map((u) => getUserProfile(u))),
        ]);
        const activeSet = new Set(statuses.map((s) => s.uid));
        setConnectionStories(
          (profiles.filter((p): p is UserProfile => p !== null)).map((p) => ({
            uid: p.uid,
            name: p.name,
            photoURL: p.photoURL,
            hasStatus: activeSet.has(p.uid),
          })),
        );
      } catch { /* non-critical */ }
    });
    return unsub;
  }, [uid]);

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
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* Share modal */}
      {sharePost && (
        <ShareModal
          post={sharePost}
          visible={!!sharePost}
          uid={uid}
          onClose={() => setSharePost(null)}
        />
      )}

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
            <Ionicons name="camera-outline" size={24} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stories moved to Discover tab ── */}

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
            tintColor={C.primary}
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
              color={C.primary}
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
            onShare={() => setSharePost(item)}
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex:    { flex: 1, backgroundColor: C.surface },
    centered: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.background,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      backgroundColor: C.background,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    wordmark: { fontSize: 26, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', gap: spacing.xs },
    iconBtn: { padding: spacing.sm },
    list:           { paddingTop: spacing.md, paddingBottom: 120 },
    emptyContainer: { flex: 1 },
    fab: {
      position: 'absolute', bottom: 90, right: 20,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
      elevation: 8,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
  });
}
