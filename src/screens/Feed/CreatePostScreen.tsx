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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { createPost } from '../../utils/firestore-helpers';
import { colors, spacing, typography, radius } from '../../utils/theme';
import Avatar from '../../components/Avatar';
import { Post, PollOption } from '../../types';

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = 'text' | 'image' | 'thread' | 'poll';

interface TabConfig {
  id: TabId;
  label: string;
  emoji: string;
  color: string;
}

const TABS: TabConfig[] = [
  { id: 'text',   label: 'Text',   emoji: '📝', color: colors.secondary },
  { id: 'image',  label: 'Photo',  emoji: '📷', color: '#0984E3' },
  { id: 'thread', label: 'Waves',  emoji: '🧵', color: '#E17055' },
  { id: 'poll',   label: 'Poll',   emoji: '📊', color: colors.success },
];

// ─── Poll duration options ─────────────────────────────────────────────────────

const POLL_DURATIONS: { label: string; hours: number }[] = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d',  hours: 168 },
];

// ─── Trending hashtags ─────────────────────────────────────────────────────────

const TRENDING_TAGS = [
  '#vibecheck', '#memories', '#goodvibes', '#drifters', '#connections',
  '#mumbai', '#bangalore', '#foodie', '#travel', '#music', '#startup',
];

// ─── Char counter ──────────────────────────────────────────────────────────────

function CharCounter({ count, max }: { count: number; max: number }) {
  const left = max - count;
  const color =
    left < 20 ? colors.error :
    left < 60 ? colors.warning :
    colors.textSecondary;
  return <Text style={[cc.text, { color }]}>{left}</Text>;
}

const cc = StyleSheet.create({
  text: { ...typography.small, fontWeight: '600', textAlign: 'right' },
});

// ─── Hashtag suggestion bar ────────────────────────────────────────────────────

function HashtagSuggestions({ query, onSelect }: { query: string; onSelect: (t: string) => void }) {
  const q       = query.toLowerCase();
  const matches = TRENDING_TAGS.filter((t) => t.includes(q)).slice(0, 8);
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
  wrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  row:  { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  pill: {
    backgroundColor: colors.primary + '12', borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  text: { ...typography.small, color: colors.primary, fontWeight: '700' },
});

// ─── Poll builder ──────────────────────────────────────────────────────────────

function PollBuilder({
  question,
  options,
  duration,
  accentColor,
  onQuestionChange,
  onOptionsChange,
  onDurationChange,
}: {
  question: string;
  options: { text: string }[];
  duration: number;
  accentColor: string;
  onQuestionChange: (q: string) => void;
  onOptionsChange: (opts: { text: string }[]) => void;
  onDurationChange: (h: number) => void;
}) {
  function updateOption(idx: number, text: string) {
    onOptionsChange(options.map((o, i) => (i === idx ? { text } : o)));
  }
  function addOption() {
    if (options.length >= 4) return;
    onOptionsChange([...options, { text: '' }]);
  }
  function removeOption(idx: number) {
    if (options.length <= 2) return;
    onOptionsChange(options.filter((_, i) => i !== idx));
  }

  return (
    <View style={pb.container}>
      <Text style={pb.sectionLabel}>QUESTION</Text>
      <View style={[pb.questionWrap, { borderColor: accentColor + '60' }]}>
        <TextInput
          style={pb.questionInput}
          value={question}
          onChangeText={onQuestionChange}
          placeholder="Ask your question…"
          placeholderTextColor={colors.textSecondary}
          maxLength={200}
          multiline
        />
      </View>
      <Text style={pb.sectionLabel}>OPTIONS</Text>
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
        <TouchableOpacity
          style={[pb.addBtn, { borderColor: accentColor }]}
          onPress={addOption}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color={accentColor} />
          <Text style={[pb.addBtnText, { color: accentColor }]}>Add option</Text>
        </TouchableOpacity>
      )}
      <Text style={pb.sectionLabel}>DURATION</Text>
      <View style={pb.durationRow}>
        {POLL_DURATIONS.map((d) => (
          <TouchableOpacity
            key={d.hours}
            style={[
              pb.durationPill,
              duration === d.hours && { backgroundColor: accentColor, borderColor: accentColor },
            ]}
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
  container: { paddingHorizontal: 0, paddingBottom: spacing.md },
  sectionLabel: {
    ...typography.small, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 1.1, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  questionWrap: {
    borderWidth: 1.5, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 80,
  },
  questionInput: { ...typography.body, color: colors.text, lineHeight: 24, textAlignVertical: 'top' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: radius.md,
    marginBottom: spacing.sm, paddingRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionInput: { flex: 1, ...typography.body, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  removeBtn:  { padding: spacing.xs },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    justifyContent: 'center', marginBottom: spacing.md,
  },
  addBtnText:  { ...typography.body, fontWeight: '600' },
  durationRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  durationPill: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  durationText:       { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  durationTextActive: { color: '#fff', fontWeight: '700' },
});

// ─── Thread / Waves builder ────────────────────────────────────────────────────

function WavesBuilder({
  lines,
  accentColor,
  onLinesChange,
}: {
  lines: string[];
  accentColor: string;
  onLinesChange: (l: string[]) => void;
}) {
  function updateLine(idx: number, text: string) {
    onLinesChange(lines.map((l, i) => (i === idx ? text : l)));
  }
  function addSegment() {
    if (lines.length >= 10) return;
    onLinesChange([...lines, '']);
  }
  function removeSegment(idx: number) {
    if (lines.length <= 1) return;
    onLinesChange(lines.filter((_, i) => i !== idx));
  }

  return (
    <View style={wv.container}>
      <Text style={wv.hint}>Each card is a paragraph in your thread. Up to 10 waves.</Text>
      {lines.map((line, idx) => (
        <View key={idx} style={wv.cardRow}>
          <View style={wv.connector}>
            <View style={[wv.dot, { backgroundColor: accentColor }]} />
            {idx < lines.length - 1 && (
              <View style={[wv.vertLine, { backgroundColor: accentColor + '40' }]} />
            )}
          </View>
          <View style={[wv.card, { borderColor: accentColor + '50' }]}>
            <TextInput
              style={wv.input}
              value={line}
              onChangeText={(t) => updateLine(idx, t)}
              placeholder={idx === 0 ? 'Start your wave…' : `Continue wave ${idx + 1}…`}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <View style={wv.cardFooter}>
              <Text style={wv.charCount}>{500 - line.length}</Text>
              {lines.length > 1 && (
                <TouchableOpacity onPress={() => removeSegment(idx)}>
                  <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ))}
      {lines.length < 10 && (
        <TouchableOpacity
          style={[wv.addBtn, { borderColor: accentColor }]}
          onPress={addSegment}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={accentColor} />
          <Text style={[wv.addBtnText, { color: accentColor }]}>
            Add wave {lines.length + 1}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const wv = StyleSheet.create({
  container: { paddingHorizontal: 0, paddingBottom: spacing.md },
  hint:      { ...typography.small, color: colors.textSecondary, marginBottom: spacing.md },
  cardRow:   { flexDirection: 'row', marginBottom: spacing.sm },
  connector: { alignItems: 'center', marginRight: spacing.sm, paddingTop: 6, width: 12 },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  vertLine:  { flex: 1, width: 2, marginTop: 4 },
  card: {
    flex: 1, borderWidth: 1.5, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  input: {
    ...typography.body, color: colors.text, lineHeight: 24,
    minHeight: 72, textAlignVertical: 'top',
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  charCount:  { ...typography.small, color: colors.textSecondary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    justifyContent: 'center', marginTop: spacing.xs,
  },
  addBtnText: { ...typography.body, fontWeight: '600' },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function CreatePostScreen() {
  const navigation                    = useNavigation();
  const { firebaseUser, userProfile } = useAuthStore();

  const [activeTab, setActiveTab]      = useState<TabId>('text');

  // Text / image caption
  const [caption, setCaption]          = useState('');
  const [hashtagQuery, setHashtagQuery] = useState('');
  const captionRef                     = useRef<TextInput>(null);

  // Image
  const [imageUri, setImageUri]        = useState<string | null>(null);
  const [location, setLocation]        = useState('');

  // Thread / Waves
  const [threadLines, setThreadLines]  = useState<string[]>(['']);

  // Poll
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions]   = useState<{ text: string }[]>([
    { text: '' }, { text: '' },
  ]);
  const [pollDuration, setPollDuration] = useState(24);

  const [loading, setLoading] = useState(false);

  const tabCfg = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const accent = tabCfg.color;

  // ── Caption hashtag tracking ──
  function handleCaptionChange(text: string) {
    setCaption(text);
    const words = text.split(/\s/);
    const last  = words[words.length - 1];
    setHashtagQuery(last.startsWith('#') && last.length > 1 ? last : '');
  }

  function insertHashtag(tag: string) {
    const words = caption.split(/\s/);
    words[words.length - 1] = tag + ' ';
    setCaption(words.join(' '));
    setHashtagQuery('');
    captionRef.current?.focus();
  }

  // ── Image picker ──
  async function pickImage() {
    const ImagePicker = await import('expo-image-picker');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  // ── Tab switch ──
  function switchTab(tab: TabId) {
    setActiveTab(tab);
    setCaption('');
    setHashtagQuery('');
    setImageUri(null);
    setLocation('');
    setThreadLines(['']);
    setPollQuestion('');
    setPollOptions([{ text: '' }, { text: '' }]);
    setPollDuration(24);
  }

  // ── Validation ──
  const isValid = (() => {
    if (activeTab === 'text')   return caption.trim().length > 0;
    if (activeTab === 'image')  return !!imageUri;
    if (activeTab === 'thread') return threadLines.some((l) => l.trim().length > 0);
    // poll
    return (
      pollQuestion.trim().length > 0 &&
      pollOptions.filter((o) => o.text.trim().length > 0).length >= 2
    );
  })();

  // ── Post submission ──
  async function handlePost() {
    if (!isValid || !firebaseUser || !userProfile) return;
    setLoading(true);
    try {
      let mediaURL: string | undefined;
      if (activeTab === 'image' && imageUri) {
        const response   = await fetch(imageUri);
        const blob       = await response.blob();
        const storageRef = ref(storage, `posts/${firebaseUser.uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        mediaURL = await getDownloadURL(storageRef);
      }

      const now    = Date.now();
      const postId = `post_${now}_${firebaseUser.uid}`;

      const builtPollOptions: PollOption[] | undefined =
        activeTab === 'poll'
          ? pollOptions
              .filter((o) => o.text.trim().length > 0)
              .map((o, i) => ({ id: `opt_${i}`, text: o.text.trim(), votes: [] }))
          : undefined;

      const post: Post = {
        id:           postId,
        userId:       firebaseUser.uid,
        userName:     userProfile.name,
        userPhotoURL: userProfile.photoURL,
        type:         activeTab,
        caption:
          activeTab === 'poll'
            ? pollQuestion.trim()
            : activeTab === 'thread'
            ? threadLines[0]?.trim() ?? ''
            : caption.trim(),
        mediaURL,
        mediaType:    activeTab === 'image' ? 'image' : undefined,
        threadLines:  activeTab === 'thread'
          ? threadLines.filter((l) => l.trim().length > 0)
          : undefined,
        pollOptions:  builtPollOptions,
        pollEndsAt:   activeTab === 'poll' ? now + pollDuration * 3_600_000 : undefined,
        pollDuration: activeTab === 'poll' ? pollDuration : undefined,
        likes:        [],
        commentCount: 0,
        comments:     0,
        shareCount:   0,
        tags:         [],
        location:     location.trim() || undefined,
        createdAt:    now,
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

  return (
    <SafeAreaView style={styles.flex}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, isValid && !loading ? { backgroundColor: accent } : styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.postBtnText, !isValid && styles.postBtnTextDisabled]}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tab selector ── */}
      <View style={styles.tabsWrap}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: tab.color, borderColor: tab.color }
                  : { borderColor: colors.border },
              ]}
              onPress={() => switchTab(tab.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.tabEmoji}>{tab.emoji}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Text tab ── */}
          {activeTab === 'text' && (
            <View style={styles.composeRow}>
              <Avatar name={userProfile?.name ?? ''} photoURL={userProfile?.photoURL} size={40} />
              <View style={styles.composeRight}>
                <Text style={styles.displayName}>{userProfile?.name ?? ''}</Text>
                <TextInput
                  ref={captionRef}
                  style={[styles.captionInput, { borderColor: accent + '60' }]}
                  value={caption}
                  onChangeText={handleCaptionChange}
                  placeholder="What's on your mind?"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={500}
                  autoFocus
                  textAlignVertical="top"
                />
                <View style={styles.charRow}>
                  <CharCounter count={caption.length} max={500} />
                </View>
              </View>
            </View>
          )}

          {/* ── Photo tab ── */}
          {activeTab === 'image' && (
            <View>
              {imageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                    <View style={styles.removeBadge}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changeImageBtn} onPress={pickImage}>
                    <Text style={styles.changeImageText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.imagePicker, { borderColor: accent }]}
                  onPress={pickImage}
                >
                  <Ionicons name="image-outline" size={40} color={accent} />
                  <Text style={[styles.imagePickerText, { color: accent }]}>
                    Tap to choose photo
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.composeRow}>
                <Avatar name={userProfile?.name ?? ''} photoURL={userProfile?.photoURL} size={36} />
                <View style={styles.composeRight}>
                  <TextInput
                    ref={captionRef}
                    style={[styles.captionInput, { borderColor: accent + '60' }]}
                    value={caption}
                    onChangeText={handleCaptionChange}
                    placeholder="Write a caption…"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <View style={styles.charRow}>
                    <CharCounter count={caption.length} max={500} />
                  </View>
                </View>
              </View>
              <View style={[styles.locationRow, { borderColor: accent + '40' }]}>
                <Ionicons name="location-outline" size={18} color={accent} />
                <TextInput
                  style={styles.locationInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Add location…"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={80}
                />
              </View>
            </View>
          )}

          {/* ── Thread / Waves tab ── */}
          {activeTab === 'thread' && (
            <View style={styles.composeRow}>
              <Avatar name={userProfile?.name ?? ''} photoURL={userProfile?.photoURL} size={40} />
              <View style={[styles.composeRight, { flex: 1 }]}>
                <Text style={styles.displayName}>{userProfile?.name ?? ''}</Text>
                <WavesBuilder
                  lines={threadLines}
                  accentColor={accent}
                  onLinesChange={setThreadLines}
                />
              </View>
            </View>
          )}

          {/* ── Poll tab ── */}
          {activeTab === 'poll' && (
            <View style={styles.composeRow}>
              <Avatar name={userProfile?.name ?? ''} photoURL={userProfile?.photoURL} size={40} />
              <View style={[styles.composeRight, { flex: 1 }]}>
                <Text style={styles.displayName}>{userProfile?.name ?? ''}</Text>
                <PollBuilder
                  question={pollQuestion}
                  options={pollOptions}
                  duration={pollDuration}
                  accentColor={accent}
                  onQuestionChange={setPollQuestion}
                  onOptionsChange={setPollOptions}
                  onDurationChange={setPollDuration}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Hashtag suggestions ── */}
        {(activeTab === 'text' || activeTab === 'image') && hashtagQuery.length > 1 && (
          <HashtagSuggestions query={hashtagQuery} onSelect={insertHashtag} />
        )}

        {/* ── Bottom toolbar ── */}
        {(activeTab === 'text' || activeTab === 'image') && (
          <View style={[styles.toolbar, { borderTopColor: accent + '30' }]}>
            {activeTab === 'image' && (
              <TouchableOpacity style={styles.toolbarBtn} onPress={pickImage} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={24} color={accent} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => {
                setCaption((prev) => prev + (prev.endsWith(' ') ? '#' : ' #'));
                captionRef.current?.focus();
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="pricetag-outline" size={24} color={accent} />
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
  closeBtn:            { padding: spacing.xs },
  headerTitle:         { ...typography.body, fontWeight: '700', color: colors.text },
  postBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, minWidth: 64, alignItems: 'center',
  },
  postBtnDisabled:     { backgroundColor: colors.border },
  postBtnText:         { ...typography.caption, fontWeight: '700', color: '#fff' },
  postBtnTextDisabled: { color: colors.textSecondary },

  tabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  tabEmoji:       { fontSize: 14 },
  tabLabel:       { ...typography.small, fontWeight: '600', color: colors.textSecondary },
  tabLabelActive: { color: '#fff', fontWeight: '700' },

  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  composeRow:  { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.md },
  composeRight: { flex: 1 },
  displayName:  { ...typography.caption, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },

  captionInput: {
    borderWidth: 1.5, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 120,
    ...typography.body, color: colors.text, lineHeight: 24, textAlignVertical: 'top',
  },
  charRow: { alignItems: 'flex-end', marginTop: spacing.xs },

  imagePicker: {
    height: 200, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed',
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginBottom: spacing.md,
  },
  imagePickerText: { ...typography.body, fontWeight: '600' },
  imagePreviewWrap: {
    height: 280, borderRadius: radius.lg, overflow: 'hidden',
    marginBottom: spacing.md, position: 'relative',
  },
  imagePreview: { width: '100%', height: '100%' },
  removeImageBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  removeBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  changeImageBtn: {
    position: 'absolute', bottom: spacing.sm, right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
  },
  changeImageText: { ...typography.small, color: '#fff', fontWeight: '600' },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  locationInput: { flex: 1, ...typography.body, color: colors.text },

  toolbar: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 1, backgroundColor: colors.background,
  },
  toolbarBtn: { padding: spacing.xs },
});
