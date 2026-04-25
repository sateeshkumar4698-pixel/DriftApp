import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { createPost } from '../../utils/firestore-helpers';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import Avatar from '../../components/Avatar';
import { Post, PostType } from '../../types';

// ─── Trending topics for hashtag suggestions ──────────────────────────────────

const TRENDING = [
  '#vibecheck', '#memories', '#goodvibes', '#drifters', '#connections',
  '#mumbai', '#bangalore', '#delhi', '#pune', '#hyderabad',
  '#foodie', '#travel', '#music', '#fashion', '#startup',
];

// ─── Poll duration options ────────────────────────────────────────────────────

const POLL_DURATIONS: { label: string; hours: number }[] = [
  { label: '24h', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
];

// ─── Post type tabs config ────────────────────────────────────────────────────

interface PostTypeTab {
  type: PostType;
  label: string;
  emoji: string;
  color: string;
  placeholder: string;
  maxChars: number;
  defaultTags: string[];
  hasImage: boolean;
}

const POST_TYPE_TABS: PostTypeTab[] = [
  {
    type: 'thread',
    label: 'Thread',
    emoji: '💭',
    color: '#E17055',
    placeholder: "What's on your mind?",
    maxChars: 280,
    defaultTags: [],
    hasImage: false,
  },
  {
    type: 'moment',
    label: 'Moment',
    emoji: '📸',
    color: '#0984E3',
    placeholder: "Capture what's happening right now…",
    maxChars: 500,
    defaultTags: ['#moment'],
    hasImage: true,
  },
  {
    type: 'vibe',
    label: 'Vibe',
    emoji: '✨',
    color: '#6C5CE7',
    placeholder: "What's the energy? Describe it…",
    maxChars: 500,
    defaultTags: ['#vibecheck'],
    hasImage: true,
  },
  {
    type: 'memory',
    label: 'Memory',
    emoji: '🌟',
    color: '#FDCB6E',
    placeholder: 'Share a throwback or a memory that stayed with you…',
    maxChars: 500,
    defaultTags: ['#memory', '#throwback'],
    hasImage: true,
  },
  {
    type: 'question',
    label: 'Question',
    emoji: '🤔',
    color: '#00B894',
    placeholder: 'Ask your Drift crew something…',
    maxChars: 200,
    defaultTags: ['#ask'],
    hasImage: false,
  },
  {
    type: 'poll',
    label: 'Poll',
    emoji: '📊',
    color: '#0984E3',
    placeholder: 'Ask a question for your poll…',
    maxChars: 200,
    defaultTags: [],
    hasImage: false,
  },
];

// ─── Char counter ─────────────────────────────────────────────────────────────

function CharCounter({ count, max }: { count: number; max: number }) {
  const left = max - count;
  const color =
    left < 20 ? colors.error :
    left < 50 ? colors.warning :
    colors.textSecondary;
  return (
    <Text style={[cc.text, { color }]}>
      {left}
    </Text>
  );
}

const cc = StyleSheet.create({
  text: { ...typography.small, fontWeight: '600', textAlign: 'right' },
});

// ─── Hashtag suggestion bar ───────────────────────────────────────────────────

function HashtagSuggestions({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (tag: string) => void;
}) {
  const q = query.toLowerCase();
  const matches = TRENDING.filter((t) => t.includes(q)).slice(0, 8);
  if (matches.length === 0) return null;

  return (
    <View style={hs.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hs.row}>
        {matches.map((tag) => (
          <TouchableOpacity key={tag} style={hs.pill} onPress={() => onSelect(tag)} activeOpacity={0.75}>
            <Text style={hs.text}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const hs = StyleSheet.create({
  wrap: {
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  pill: {
    backgroundColor: colors.primary + '12', borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  text: { ...typography.small, color: colors.primary, fontWeight: '700' },
});

// ─── Poll builder ─────────────────────────────────────────────────────────────

interface PollOption {
  text: string;
  votes: string[];
}

function PollBuilder({
  options,
  duration,
  onOptionsChange,
  onDurationChange,
  accentColor,
}: {
  options: PollOption[];
  duration: number;
  onOptionsChange: (opts: PollOption[]) => void;
  onDurationChange: (hours: number) => void;
  accentColor: string;
}) {
  function updateOption(idx: number, text: string) {
    const next = options.map((o, i) => (i === idx ? { ...o, text } : o));
    onOptionsChange(next);
  }

  function addOption() {
    if (options.length >= 4) return;
    onOptionsChange([...options, { text: '', votes: [] }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    onOptionsChange(options.filter((_, i) => i !== idx));
  }

  return (
    <View style={pb.container}>
      <Text style={pb.label}>POLL OPTIONS</Text>
      {options.map((opt, idx) => (
        <View key={idx} style={[pb.optionRow, { borderColor: accentColor + '50' }]}>
          <TextInput
            style={pb.optionInput}
            value={opt.text}
            onChangeText={(t) => updateOption(idx, t)}
            placeholder={`Option ${idx + 1}${idx < 2 ? ' *' : ''}`}
            placeholderTextColor={colors.textSecondary}
            maxLength={80}
          />
          {options.length > 2 && (
            <TouchableOpacity onPress={() => removeOption(idx)} style={pb.removeBtn}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {options.length < 4 && (
        <TouchableOpacity style={[pb.addOptionBtn, { borderColor: accentColor }]} onPress={addOption} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={accentColor} />
          <Text style={[pb.addOptionText, { color: accentColor }]}>Add option</Text>
        </TouchableOpacity>
      )}
      <Text style={pb.durationLabel}>POLL DURATION</Text>
      <View style={pb.durationRow}>
        {POLL_DURATIONS.map((d) => (
          <TouchableOpacity
            key={d.hours}
            style={[pb.durationPill, duration === d.hours && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => onDurationChange(d.hours)}
            activeOpacity={0.8}
          >
            <Text style={[pb.durationText, duration === d.hours && pb.durationTextActive]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  label: {
    ...typography.small, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 1.1, marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: radius.md,
    marginBottom: spacing.sm, paddingRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionInput: {
    flex: 1, ...typography.body, color: colors.text,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  removeBtn: { padding: spacing.xs },
  addOptionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    justifyContent: 'center', marginBottom: spacing.md,
  },
  addOptionText: { ...typography.body, fontWeight: '600' },
  durationLabel: {
    ...typography.small, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 1.1, marginBottom: spacing.sm,
  },
  durationRow: { flexDirection: 'row', gap: spacing.sm },
  durationPill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  durationText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  durationTextActive: { color: '#fff', fontWeight: '700' },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreatePostScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile } = useAuthStore();

  const [selectedTab, setSelectedTab]     = useState<PostTypeTab>(POST_TYPE_TABS[0]);
  const [caption, setCaption]             = useState('');
  const [imageUri, setImageUri]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [hashtagQuery, setHashtagQuery]   = useState('');
  const [pollOptions, setPollOptions]     = useState<PollOption[]>([
    { text: '', votes: [] },
    { text: '', votes: [] },
  ]);
  const [pollDuration, setPollDuration]   = useState(24);

  const captionRef = useRef<TextInput>(null);

  // Track if user is typing a hashtag
  function handleCaptionChange(text: string) {
    setCaption(text);
    const words = text.split(/\s/);
    const last  = words[words.length - 1];
    if (last.startsWith('#') && last.length > 1) {
      setHashtagQuery(last);
    } else {
      setHashtagQuery('');
    }
  }

  function insertHashtag(tag: string) {
    const words = caption.split(/\s/);
    words[words.length - 1] = tag + ' ';
    setCaption(words.join(' '));
    setHashtagQuery('');
    captionRef.current?.focus();
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  function handleTabSelect(tab: PostTypeTab) {
    setSelectedTab(tab);
    setCaption('');
    setImageUri(null);
    setHashtagQuery('');
    if (tab.type === 'poll') {
      setPollOptions([{ text: '', votes: [] }, { text: '', votes: [] }]);
    }
  }

  // Validation
  const isPoll = selectedTab.type === 'poll';
  const pollValid = isPoll
    ? pollOptions.filter((o) => o.text.trim().length > 0).length >= 2
    : true;
  const canPost = isPoll
    ? caption.trim().length > 0 && pollValid
    : (caption.trim().length > 0 || !!imageUri);

  async function handlePost() {
    if (!canPost) return;
    if (!firebaseUser || !userProfile) return;
    setLoading(true);
    try {
      let mediaURL: string | undefined;
      if (imageUri && selectedTab.hasImage) {
        const response = await fetch(imageUri);
        const blob     = await response.blob();
        const storageRef = ref(storage, `posts/${firebaseUser.uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        mediaURL = await getDownloadURL(storageRef);
      }

      const captionFinal =
        selectedTab.type === 'question'
          ? caption.trim()
          : caption.trim();

      const post: Post = {
        id:           `post_${Date.now()}_${firebaseUser.uid}`,
        userId:       firebaseUser.uid,
        userName:     userProfile.name,
        userPhotoURL: userProfile.photoURL,
        caption:      captionFinal,
        mediaURL,
        mediaType:    imageUri && selectedTab.hasImage ? 'image' : undefined,
        postType:     selectedTab.type,
        tags:         selectedTab.defaultTags,
        likes:        [],
        reactions:    {},
        savedBy:      [],
        comments:     0,
        createdAt:    Date.now(),
        pollOptions:  isPoll ? pollOptions.filter((o) => o.text.trim().length > 0) : undefined,
        pollDuration: isPoll ? pollDuration : undefined,
        repostCount:  0,
      };
      await createPost(post);
      navigation.goBack();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', __DEV__ ? msg : 'Failed to create post. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const charsLeft = selectedTab.maxChars - caption.length;
  const accentColor = selectedTab.color;

  return (
    <SafeAreaView style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.postBtn, canPost && !loading ? { backgroundColor: accentColor } : styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!canPost || loading}
          activeOpacity={0.85}
        >
          <Text style={[styles.postBtnText, !canPost && styles.postBtnTextDisabled]}>
            {loading ? '…' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Post type tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {POST_TYPE_TABS.map((tab) => {
            const active = selectedTab.type === tab.type;
            return (
              <TouchableOpacity
                key={tab.type}
                style={[
                  styles.typeTab,
                  active
                    ? { backgroundColor: tab.color, borderColor: tab.color }
                    : { borderColor: colors.border },
                ]}
                onPress={() => handleTabSelect(tab)}
                activeOpacity={0.8}
              >
                <Text style={styles.typeTabEmoji}>{tab.emoji}</Text>
                <Text style={[styles.typeTabLabel, active && styles.typeTabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Twitter-style compose row */}
          <View style={styles.composeRow}>
            <Avatar
              name={userProfile?.name ?? ''}
              photoURL={userProfile?.photoURL}
              size={40}
            />
            <View style={styles.composeRight}>
              <Text style={styles.displayName}>{userProfile?.name ?? ''}</Text>
              <View style={[styles.textInputWrap, { borderColor: accentColor + '60' }]}>
                {selectedTab.type === 'question' && (
                  <Text style={[styles.questionCue, { color: accentColor }]}>🤔 </Text>
                )}
                <TextInput
                  ref={captionRef}
                  style={[
                    styles.captionInput,
                    selectedTab.type === 'thread' && styles.threadInput,
                  ]}
                  value={caption}
                  onChangeText={handleCaptionChange}
                  placeholder={selectedTab.placeholder}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={selectedTab.maxChars}
                  autoFocus
                  textAlignVertical="top"
                />
              </View>
              <View style={styles.charRow}>
                <CharCounter count={caption.length} max={selectedTab.maxChars} />
              </View>
            </View>
          </View>

          {/* Image preview / add image (for image-capable types) */}
          {selectedTab.hasImage && (
            imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                  <View style={styles.removeImageBadge}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>
            ) : null
          )}

          {/* Poll builder */}
          {isPoll && (
            <PollBuilder
              options={pollOptions}
              duration={pollDuration}
              onOptionsChange={setPollOptions}
              onDurationChange={setPollDuration}
              accentColor={accentColor}
            />
          )}
        </ScrollView>

        {/* Hashtag suggestions */}
        {hashtagQuery.length > 1 && (
          <HashtagSuggestions query={hashtagQuery} onSelect={insertHashtag} />
        )}

        {/* Bottom toolbar (image-capable types) */}
        {selectedTab.hasImage && (
          <View style={[styles.toolbar, { borderTopColor: accentColor + '30' }]}>
            <TouchableOpacity style={styles.toolbarBtn} onPress={pickImage} activeOpacity={0.75}>
              <Ionicons name="image-outline" size={24} color={accentColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => {
                setCaption((prev) => prev + ' #');
                captionRef.current?.focus();
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="pricetag-outline" size={24} color={accentColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => Alert.alert('Emoji', 'Emoji picker — coming soon!')}
              activeOpacity={0.75}
            >
              <Ionicons name="happy-outline" size={24} color={accentColor} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  closeBtn: { padding: spacing.xs },
  postBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  postBtnDisabled: { backgroundColor: colors.border },
  postBtnText: { ...typography.caption, fontWeight: '700', color: '#fff' },
  postBtnTextDisabled: { color: colors.textSecondary },

  tabsWrap: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tabsRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  typeTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  typeTabEmoji: { fontSize: 14 },
  typeTabLabel: { ...typography.small, fontWeight: '600', color: colors.textSecondary },
  typeTabLabelActive: { color: '#fff', fontWeight: '700' },

  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  composeRow: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
  },
  composeRight: { flex: 1 },
  displayName: { ...typography.caption, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  textInputWrap: {
    borderWidth: 1.5, borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    minHeight: 100, flexDirection: 'row', alignItems: 'flex-start',
  },
  questionCue: { fontSize: 18, marginTop: 2, marginRight: 4 },
  captionInput: {
    flex: 1, ...typography.body, color: colors.text,
    lineHeight: 24, textAlignVertical: 'top',
  },
  threadInput: {
    fontSize: 18, lineHeight: 26,
  },
  charRow: { alignItems: 'flex-end', marginTop: spacing.xs },

  imagePreviewWrap: {
    marginTop: spacing.md, borderRadius: radius.md, overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: { width: '100%', height: 200, borderRadius: radius.md },
  removeImageBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  removeImageBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  toolbar: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 1, backgroundColor: colors.background,
  },
  toolbarBtn: { padding: spacing.xs },
});
