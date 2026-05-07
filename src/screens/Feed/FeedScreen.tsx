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
import { makeStyles, makeCardStyles, makeCmStyles, makeShStyles, makePollStyles } from './FeedScreen.styles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

function resolvePostType(post: Post): PostType {
  const t = post.type ?? post.postType;
  if (t === 'moment' || t === 'memory' || t === 'vibe' || t === 'question' || t === 'achievement') {
    if (post.mediaURL) return 'image';
    return 'text';
  }
  return (t as PostType) ?? 'text';
}

function resolveCommentCount(post: Post): number {
  return (post.commentCount ?? post.comments) ?? 0;
}

// ─── Post type config ─────────────────────────────────────────────────────────

const POST_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  text:   { label: 'Text',   emoji: '📝', color: '#6C5CE7' },
  image:  { label: 'Photo',  emoji: '📷', color: '#0984E3' },
  thread: { label: 'Thread', emoji: '🌊', color: '#E17055' },
  poll:   { label: 'Poll',   emoji: '📊', color: '#00B894' },
};

// ─── Hashtag-highlighted caption ──────────────────────────────────────────────

function HighlightedCaption({ text, style, numberOfLines }: { text: string; style?: object; numberOfLines?: number }) {
  const { C } = useTheme();
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Text key={i} style={{ color: C.primary, fontWeight: '600' }}>{part}</Text>
          : <Text key={i}>{part}</Text>,
      )}
    </Text>
  );
}

// ─── Poll content ─────────────────────────────────────────────────────────────

function PollContent({ post, uid }: { post: Post; uid: string }) {
  const { C } = useTheme();
  const pollSt = makePollStyles();

  const normalise = (opts: NonNullable<Post['pollOptions']>) =>
    opts.map((o, i) => ({
      id: 'id' in o ? (o as { id: string }).id : String(i),
      text: o.text,
      votes: Array.isArray(o.votes) ? [...o.votes] : [],
    }));

  const [localOptions, setLocalOptions] = useState(() =>
    normalise(post.pollOptions ?? []),
  );

  // Re-sync when the post prop changes (e.g. after feed refresh)
  useEffect(() => {
    setLocalOptions(normalise(post.pollOptions ?? []));
  }, [post.id, post.pollOptions]);

  const totalVotes = localOptions.reduce((s, o) => s + o.votes.length, 0);
  const hasVoted   = localOptions.some((o) => o.votes.includes(uid));
  const isPollOpen = !post.pollEndsAt || post.pollEndsAt > Date.now();

  function handleVote(idx: number) {
    if (!uid || !isPollOpen) return;
    const next = localOptions.map((opt, i) => {
      if (i !== idx) return { ...opt, votes: opt.votes.filter((u) => u !== uid) };
      const already = opt.votes.includes(uid);
      return { ...opt, votes: already ? opt.votes.filter((u) => u !== uid) : [...opt.votes, uid] };
    });
    const prev = localOptions;
    setLocalOptions(next);
    castPollVote(post.id, next).catch(() => setLocalOptions(prev));
  }

  if (localOptions.length === 0) return null;

  return (
    <View style={pollSt.container}>
      {localOptions.map((opt, idx) => {
        const pct   = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
        const voted = opt.votes.includes(uid);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[pollSt.option, voted && { borderColor: C.success }]}
            onPress={() => handleVote(idx)}
            activeOpacity={isPollOpen ? 0.75 : 1}
          >
            {/* gradient fill bar */}
            {hasVoted && (
              <LinearGradient
                colors={voted ? ['#00B894', '#00CEC9'] : [C.border, C.border]}
                style={[pollSt.bar, { width: `${pct}%` as `${number}%` }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
            )}
            <Text style={[pollSt.optionText, voted && { color: C.success, fontWeight: '700' }]}>
              {voted ? '✓ ' : ''}{opt.text}
            </Text>
            {hasVoted && (
              <Text style={[pollSt.pct, { color: voted ? C.success : C.textSecondary }]}>{pct}%</Text>
            )}
          </TouchableOpacity>
        );
      })}
      <View style={pollSt.metaRow}>
        <Text style={[pollSt.meta, { color: C.textSecondary }]}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </Text>
        {post.pollEndsAt && (
          <Text style={[pollSt.meta, { color: isPollOpen ? C.textSecondary : C.error }]}>
            {isPollOpen ? `Ends ${formatRelativeTime(post.pollEndsAt)}` : 'Poll closed'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Thread content ───────────────────────────────────────────────────────────

function ThreadContent({ lines, caption }: { lines?: string[]; caption: string }) {
  const { C } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const allLines  = lines && lines.length > 0 ? lines : [caption];
  const visible   = expanded ? allLines : allLines.slice(0, 3);
  const hasMore   = allLines.length > 3;

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
      <LinearGradient
        colors={['#E17055', '#FDCB6E']}
        style={{ width: 3, borderRadius: 2, marginRight: spacing.sm }}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />
      <View style={{ flex: 1 }}>
        {visible.map((line, i) => (
          <Text key={i} style={{ fontSize: 15, color: C.text, lineHeight: 24, marginBottom: spacing.sm }}>
            {line}
          </Text>
        ))}
        {hasMore && (
          <TouchableOpacity onPress={() => setExpanded(!expanded)}>
            <Text style={{ fontSize: 12, color: C.primary, fontWeight: '700' }}>
              {expanded ? 'Show less' : `Read ${allLines.length - 3} more…`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Comments modal ───────────────────────────────────────────────────────────

function CommentsModal({
  post, visible, uid, userName, userPhotoURL, onClose, onCommentAdded,
}: {
  post: Post; visible: boolean; uid: string; userName: string;
  userPhotoURL?: string; onClose: () => void; onCommentAdded: () => void;
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
        post.id, PAGE_SIZE, lastTimestampRef.current,
      );
      setHasMore(stillMore);
      lastTimestampRef.current = lastTimestamp;
      setComments((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !ids.has(c.id))];
      });
    } catch {/* silent */} finally { setLoadingMore(false); }
  }

  function startReply(c: PostComment) {
    setReplyingTo({ id: c.id, userName: c.userName });
    setText(`@${c.userName} `);
    inputRef.current?.focus();
  }

  async function handleSend() {
    if (!text.trim()) return;
    setPosting(true);
    const comment: PostComment = {
      id: `cmt_${Date.now()}_${uid}`,
      userId: uid, userName, userPhotoURL,
      text: text.trim(), createdAt: Date.now(),
      ...(replyingTo ? { replyTo: replyingTo } : {}),
    };
    try {
      await addPostComment(post.id, comment);
      setComments((prev) => [...prev, comment]);
      setText('');
      setReplyingTo(null);
      onCommentAdded();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not post comment.');
    } finally { setPosting(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={cm.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={cm.sheet}>
              <View style={cm.handle} />
              <View style={cm.header}>
                <Text style={cm.title}>Comments</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={C.textSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator color={C.primary} style={{ marginTop: spacing.xl }} />
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
                  ListFooterComponent={loadingMore ? <ActivityIndicator color={C.primary} style={{ marginVertical: spacing.sm }} /> : null}
                  renderItem={({ item: c }) => {
                    const replies = comments.filter((r) => r.replyTo?.id === c.id);
                    return (
                      <View>
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
                        {replies.map((r) => (
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

              {replyingTo && (
                <View style={cm.replyBanner}>
                  <Text style={cm.replyBannerText}>
                    Replying to <Text style={{ fontWeight: '700' }}>@{replyingTo.userName}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => { setReplyingTo(null); setText(''); }}>
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
                  style={[cm.sendBtn, (!text.trim() || posting) && { opacity: 0.4 }]}
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

// ─── Share modal ──────────────────────────────────────────────────────────────

function ShareModal({ post, visible, uid, onClose }: { post: Post; visible: boolean; uid: string; onClose: () => void }) {
  const { C } = useTheme();
  const sh = makeShStyles(C);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles]       = useState<Record<string, UserProfile>>({});
  const [sending, setSending]         = useState<string | null>(null);
  const [sent, setSent]               = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !uid) return;
    return subscribeToConnections(uid, setConnections);
  }, [visible, uid]);

  useEffect(() => {
    connections.forEach((c) => {
      const other = c.users.find((u) => u !== uid)!;
      if (!profiles[other]) {
        getUserProfile(other).then((p) => {
          if (p) setProfiles((prev) => ({ ...prev, [other]: p }));
        });
      }
    });
  }, [connections]);

  async function handleSend(connection: Connection) {
    const other = connection.users.find((u) => u !== uid)!;
    if (sent.has(other) || sending) return;
    setSending(other);
    const msg: Message = {
      id: `msg_${Date.now()}_${uid}`, senderId: uid,
      text: `📝 Shared a post: "${post.caption.slice(0, 80)}${post.caption.length > 80 ? '…' : ''}"`,
      createdAt: Date.now(),
    };
    try {
      await sendMessage(connection.id, msg);
      setSent((prev) => new Set([...prev, other]));
    } catch { Alert.alert('Error', 'Could not send. Try again.'); }
    finally { setSending(null); }
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
                    const other   = item.users.find((u) => u !== uid)!;
                    const profile = profiles[other];
                    if (!profile) return null;
                    const isSent    = sent.has(other);
                    const isSending = sending === other;
                    return (
                      <View style={sh.row}>
                        <Avatar name={profile.name} photoURL={profile.photoURL} size={44} />
                        <View style={sh.rowInfo}>
                          <Text style={sh.rowName}>{profile.name}</Text>
                          {!!profile.city && <Text style={sh.rowMeta}>{profile.city}</Text>}
                        </View>
                        <TouchableOpacity
                          style={[sh.sendBtn, isSent && { backgroundColor: C.success }]}
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

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post, uid, onLike, onBookmark, onCommentOpen, onShare,
}: {
  post: Post; uid: string; onLike: () => void;
  onBookmark: () => void; onCommentOpen: () => void; onShare: () => void;
}) {
  const { C, isDark } = useTheme();
  const card = makeCardStyles(C, isDark);
  const { width: W } = useWindowDimensions();

  const liked        = post.likes.includes(uid);
  const saved        = (post.savedBy ?? []).includes(uid);
  const effectiveType = resolvePostType(post);
  const typeCfg      = POST_TYPE_CONFIG[effectiveType] ?? POST_TYPE_CONFIG.text;
  const commentCount  = resolveCommentCount(post);

  const likeScale = useRef(new Animated.Value(1)).current;
  function animateLike() {
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.45, duration: 90, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
  }

  // Double-tap heart (images)
  const lastTap    = useRef(0);
  const heartOp    = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  function handleImagePress() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) { onLike(); animateLike(); }
      heartOp.setValue(1);
      heartScale.setValue(0.4);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 80 }),
        Animated.delay(500),
        Animated.timing(heartOp, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  }

  return (
    <View style={card.container}>
      {/* Left accent stripe by post type */}
      <View style={[card.stripe, { backgroundColor: typeCfg.color }]} />

      {/* Header */}
      <View style={card.header}>
        <Avatar name={post.userName} photoURL={post.userPhotoURL} size={40} />
        <View style={card.meta}>
          <Text style={card.username} numberOfLines={1}>{post.userName}</Text>
          <Text style={card.time}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
        <View style={[card.badge, { backgroundColor: typeCfg.color + '15', borderColor: typeCfg.color + '40' }]}>
          <Text style={{ fontSize: 11 }}>{typeCfg.emoji}</Text>
          <Text style={[card.badgeLabel, { color: typeCfg.color }]}>{typeCfg.label}</Text>
        </View>
      </View>

      {/* Content */}
      {effectiveType === 'thread' ? (
        <ThreadContent lines={post.threadLines} caption={post.caption} />
      ) : effectiveType === 'poll' ? (
        <>
          {!!post.caption && (
            <Text style={card.pollQuestion}>{post.caption}</Text>
          )}
          <PollContent post={post} uid={uid} />
        </>
      ) : effectiveType === 'image' ? (
        <>
          {!!post.caption && (
            <HighlightedCaption text={post.caption} style={card.caption} numberOfLines={3} />
          )}
          {!!post.mediaURL && (
            <TouchableWithoutFeedback onPress={handleImagePress}>
              <View style={[card.imageWrap, { height: W * 0.75 }]}>
                <Image source={{ uri: post.mediaURL }} style={card.image} resizeMode="cover" />
                <Animated.View style={[card.heartOverlay, { opacity: heartOp }]} pointerEvents="none">
                  <Animated.Text style={[card.heartEmoji, { transform: [{ scale: heartScale }] }]}>❤️</Animated.Text>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          )}
        </>
      ) : (
        !!post.caption && (
          <HighlightedCaption text={post.caption} style={card.caption} numberOfLines={6} />
        )
      )}

      {/* Tags */}
      {(post.tags ?? []).length > 0 && (
        <View style={card.tagsRow}>
          {(post.tags ?? []).map((tag) => (
            <View key={tag} style={card.tag}>
              <Text style={[card.tagText, { color: C.secondary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Engagement line */}
      {(post.likes.length > 0 || commentCount > 0) && (
        <View style={card.engRow}>
          {post.likes.length > 0 && (
            <Text style={card.engText}>❤️ {post.likes.length} {post.likes.length === 1 ? 'like' : 'likes'}</Text>
          )}
          {commentCount > 0 && (
            <TouchableOpacity onPress={onCommentOpen}>
              <Text style={[card.engText, { color: C.textSecondary }]}>
                View {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action bar */}
      <View style={card.actions}>
        <TouchableOpacity style={card.actionBtn} onPress={() => { animateLike(); onLike(); }} activeOpacity={0.75}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={23} color={liked ? '#FF4B6E' : C.textSecondary} />
          </Animated.View>
          {post.likes.length > 0 && (
            <Text style={[card.actionCount, liked && { color: '#FF4B6E' }]}>{post.likes.length}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={card.actionBtn} onPress={onCommentOpen} activeOpacity={0.75}>
          <Ionicons name="chatbubble-outline" size={21} color={C.textSecondary} />
          {commentCount > 0 && <Text style={card.actionCount}>{commentCount}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={card.actionBtn} onPress={onShare} activeOpacity={0.75}>
          <Ionicons name="paper-plane-outline" size={21} color={C.textSecondary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

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

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  const { C } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, []);
  const op = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return (
    <Animated.View style={{ opacity: op, backgroundColor: C.background, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginHorizontal: spacing.md, marginBottom: 10, overflow: 'hidden' }}>
      <View style={{ height: 3, backgroundColor: C.border }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.border }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '55%', height: 11, borderRadius: 5, backgroundColor: C.border }} />
            <View style={{ width: '30%', height: 9, borderRadius: 4, backgroundColor: C.border }} />
          </View>
        </View>
        <View style={{ width: '90%', height: 11, borderRadius: 5, backgroundColor: C.border, marginBottom: 8 }} />
        <View style={{ width: '72%', height: 11, borderRadius: 5, backgroundColor: C.border, marginBottom: 8 }} />
        <View style={{ width: '50%', height: 11, borderRadius: 5, backgroundColor: C.border }} />
      </View>
    </Animated.View>
  );
}

// ─── Main Feed Screen ─────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { C, isDark } = useTheme();
  const styles = makeStyles(C, isDark);
  const navigation  = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const uid          = firebaseUser?.uid ?? '';
  const userName     = userProfile?.name ?? '';
  const userPhotoURL = userProfile?.photoURL;

  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [sharePost, setSharePost]     = useState<Post | null>(null);
  const [activeTab, setActiveTab]   = useState<'forYou' | 'following' | 'trending'>('forYou');

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const data = await getPosts();
      setPosts(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(true); }, []));

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

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F']} style={StyleSheet.absoluteFill} />}

      {sharePost && (
        <ShareModal post={sharePost} visible uid={uid} onClose={() => setSharePost(null)} />
      )}
      {commentPost && (
        <CommentsModal
          post={commentPost} visible uid={uid} userName={userName} userPhotoURL={userPhotoURL}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() =>
            setPosts((prev) =>
              prev.map((p) =>
                p.id === commentPost.id
                  ? { ...p, commentCount: (p.commentCount ?? p.comments ?? 0) + 1, comments: (p.commentCount ?? p.comments ?? 0) + 1 }
                  : p,
              ),
            )
          }
        />
      )}

      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1A0A2E', '#0D1744'] : [C.background, C.surface]}
        style={styles.header}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View>
          <Text style={styles.wordmark}>Drift</Text>
          <Text style={styles.wordmarkSub}>What's happening</Text>
        </View>
        <TouchableOpacity
          style={styles.newPostBtn}
          onPress={() => navigation.navigate('CreatePost')}
          activeOpacity={0.85}
          accessibilityLabel="Create post"
          accessibilityRole="button"
        >
          <LinearGradient colors={['#FF4B6E', '#6C5CE7']} style={styles.newPostGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newPostText}>Post</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {/* Segmented tabs */}
      <View style={styles.tabsRow}>
        {([
          { key: 'forYou',    label: 'For You'    },
          { key: 'following', label: 'Following'  },
          { key: 'trending',  label: 'Trending'   },
        ] as const).map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
              accessibilityLabel={t.label}
              accessibilityRole="tab"
            >
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Feed */}
      {loading ? (
        <ScrollView contentContainerStyle={{ paddingTop: spacing.md }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </ScrollView>
      ) : (
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
              colors={[C.primary]}
              progressBackgroundColor={isDark ? '#15152A' : '#FFFFFF'}
            />
          }
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.composeCard}
              onPress={() => navigation.navigate('CreatePost')}
              activeOpacity={0.85}
              accessibilityLabel="Open create post"
              accessibilityRole="button"
            >
              <Avatar name={userName || '?'} photoURL={userPhotoURL} size={38} />
              <View style={styles.composeInput}>
                <Text style={{ fontSize: 14, color: C.textSecondary, fontWeight: '500' }}>
                  What's on your mind?
                </Text>
              </View>
              <View style={styles.composeIcons}>
                <View style={[styles.composeIconBtn, { backgroundColor: '#0984E315' }]}>
                  <Ionicons name="image-outline" size={18} color="#0984E3" />
                </View>
                <View style={[styles.composeIconBtn, { backgroundColor: '#00B89415' }]}>
                  <Ionicons name="bar-chart-outline" size={18} color="#00B894" />
                </View>
              </View>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            loadError ? (
              <EmptyState emoji="📡" title="Couldn't reach the feed" subtitle="A quick refresh usually fixes it.">
                <TouchableOpacity
                  onPress={() => load(false)}
                  style={{
                    marginTop: spacing.md,
                    paddingHorizontal: spacing.xl,
                    paddingVertical: spacing.sm + 2,
                    backgroundColor: C.primary,
                    borderRadius: radius.full,
                    alignSelf: 'center',
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Try Again</Text>
                </TouchableOpacity>
              </EmptyState>
            ) : (
              <EmptyState
                emoji="🌊"
                title="The feed is calm"
                subtitle="Be the first to drop a thought, photo, or poll for the day."
              >
                <TouchableOpacity
                  onPress={() => navigation.navigate('CreatePost')}
                  style={{
                    marginTop: spacing.md,
                    borderRadius: radius.full,
                    overflow: 'hidden',
                    alignSelf: 'center',
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FF4B6E', '#6C5CE7']}
                    style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Post</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </EmptyState>
            )
          }
          renderItem={({ item }) => (
            <PostCard
              post={item} uid={uid}
              onLike={() => handleLike(item)}
              onBookmark={() => handleBookmark(item)}
              onCommentOpen={() => setCommentPost(item)}
              onShare={() => setSharePost(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreatePost')} activeOpacity={0.85}>
        <LinearGradient colors={['#FF4B6E', '#6C5CE7']} style={styles.fabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

