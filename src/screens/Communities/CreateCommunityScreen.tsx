import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  createCommunity,
  joinCommunity,
} from '../../utils/firestore-helpers';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius, shadows } from '../../utils/theme';
import { Community, CommunityCategory, FeedStackParamList } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<FeedStackParamList>;
type CommunityType = Community['communityType'];

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

const CATEGORIES = Object.entries(CATEGORY_META) as [CommunityCategory, typeof CATEGORY_META[CommunityCategory]][];

// ─── Common emojis for icon picker ───────────────────────────────────────────

const COMMON_EMOJIS = [
  '🏘️', '🌈', '🚀', '💼', '📚', '🎓', '🗳️', '🗣️',
  '🎮', '💪', '🎵', '💻', '❤️', '🌍', '🍕', '💬',
  '⚡', '🔥', '✨', '🌟', '🎯', '🎉', '🤝', '💡',
  '🎭', '🏆', '🌺', '🦁', '🦋', '🌊', '🎸', '🎨',
];

const COMMUNITY_TYPES: Array<{
  value: CommunityType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  desc: string;
}> = [
  { value: 'open',    icon: 'globe-outline',       label: 'Open',            desc: 'Anyone can join instantly' },
  { value: 'request', icon: 'person-add-outline',  label: 'Request to Join', desc: 'Admin approves members' },
  { value: 'invite',  icon: 'lock-closed-outline', label: 'Invite Only',     desc: 'By invitation only' },
];

// ─── Section header component ─────────────────────────────────────────────────

function SectionHeader({ title, icon, C }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; C: AppColors }) {
  return (
    <View style={secHStyles.row}>
      <LinearGradient
        colors={['#FF4B6E', '#6C5CE7']}
        style={secHStyles.iconWrap}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={icon} size={14} color="#fff" />
      </LinearGradient>
      <Text style={[secHStyles.title, { color: C.text }]}>{title}</Text>
    </View>
  );
}

const secHStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
});

// ─── Validated input ──────────────────────────────────────────────────────────

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  error,
  C,
  charCount,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  error?: string;
  C: AppColors;
  charCount?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fiStyles.wrap}>
      <View style={fiStyles.labelRow}>
        <Text style={[fiStyles.label, { color: C.textSecondary }]}>{label}</Text>
        {charCount && maxLength && (
          <Text style={[fiStyles.chars, { color: value.length >= maxLength * 0.9 ? C.error : C.textTertiary }]}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
      <TextInput
        style={[
          fiStyles.input,
          {
            backgroundColor: C.inputBg,
            borderColor: error ? C.error : focused ? C.inputFocus : C.inputBorder,
            color: C.text,
          },
          multiline && fiStyles.inputMulti,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textSecondary}
        multiline={multiline}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? (
        <View style={fiStyles.errorRow}>
          <Ionicons name="alert-circle-outline" size={12} color={C.error} />
          <Text style={[fiStyles.errorText, { color: C.error }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const fiStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chars: { fontSize: 11 },
  input: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 14,
  },
  inputMulti: {
    height: 90,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  errorText: { fontSize: 11 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateCommunityScreen() {
  const { C, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const { firebaseUser, userProfile } = useAuthStore();
  const uid = firebaseUser?.uid ?? '';
  const userName = userProfile?.name ?? 'Unknown';
  const userPhotoURL = userProfile?.photoURL;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CommunityCategory>('general');
  const [communityType, setCommunityType] = useState<CommunityType>('open');
  const [iconEmoji, setIconEmoji] = useState('💬');
  const [customEmoji, setCustomEmoji] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [rules, setRules] = useState<string[]>(['']);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // ── Validation ──
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Community name is required';
    else if (name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    if (!description.trim()) e.description = 'Description is required';
    else if (description.trim().length < 10) e.description = 'Description must be at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──
  async function handleCreate() {
    if (!validate()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!uid) {
      Alert.alert('Error', 'You must be logged in to create a community.');
      return;
    }

    setSubmitting(true);
    try {
      const meta = CATEGORY_META[category];
      const parsedTags = tagsText
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const parsedRules = rules.filter((r) => r.trim().length > 0);

      const communityId = `community_${Date.now()}_${uid.slice(0, 8)}`;
      const communityData: Community = {
        id: communityId,
        name: name.trim(),
        description: description.trim(),
        category,
        tags: parsedTags,
        iconEmoji: customEmoji.trim() || iconEmoji,
        coverColor: meta.color,
        coverColor2: meta.color2,
        memberCount: 1,
        postCount: 0,
        isPrivate,
        communityType,
        createdBy: uid,
        createdByName: userName,
        createdAt: Date.now(),
        ...(parsedRules.length > 0 && { rules: parsedRules }),
      };

      await createCommunity(communityData);

      // Auto-join creator as admin
      await joinCommunity(communityId, {
        uid,
        role: 'admin',
        joinedAt: Date.now(),
        displayName: userName,
        photoURL: userPhotoURL,
      });

      navigation.replace('CommunityDetail', { communityId });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create community. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Rules management ──
  function updateRule(index: number, text: string) {
    setRules((prev) => prev.map((r, i) => (i === index ? text : r)));
  }

  function addRule() {
    if (rules.length < 10) setRules((prev) => [...prev, '']);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  const sc = makeStyles(C, isDark);
  const meta = CATEGORY_META[category];

  return (
    <SafeAreaView style={sc.root} edges={['top']}>
      {/* ── Header ── */}
      <LinearGradient
        colors={isDark ? ['#1A0A2E', '#0D1744'] : [meta.color, meta.color2]}
        style={sc.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={sc.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={sc.backBtnInner}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={sc.headerCenter}>
          <Text style={sc.headerTitle}>Create Community</Text>
          <Text style={sc.headerSub}>Build your tribe</Text>
        </View>
        <View style={sc.headerIconWrap}>
          <Text style={{ fontSize: 28 }}>{customEmoji.trim() || iconEmoji}</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={sc.flex}
      >
        <ScrollView
          ref={scrollRef}
          style={sc.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sc.scrollContent}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Basic info ── */}
          <View style={sc.card}>
            <SectionHeader title="Basic Info" icon="information-circle-outline" C={C} />
            <FormInput
              label="Community Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Delhi Tech Circle"
              maxLength={60}
              error={errors.name}
              C={C}
            />
            <FormInput
              label="Description *"
              value={description}
              onChangeText={setDescription}
              placeholder="What is this community about? (min 10 chars)"
              multiline
              maxLength={300}
              charCount
              error={errors.description}
              C={C}
            />
          </View>

          {/* ── Icon emoji ── */}
          <View style={sc.card}>
            <SectionHeader title="Community Icon" icon="happy-outline" C={C} />

            <View style={sc.emojiPreviewRow}>
              <View style={[sc.emojiPreview, { backgroundColor: meta.color + '20' }]}>
                <Text style={sc.emojiPreviewText}>{customEmoji.trim() || iconEmoji}</Text>
              </View>
              <View style={sc.emojiInputWrap}>
                <Text style={[sc.emojiInputLabel, { color: C.textSecondary }]}>
                  Or type any emoji:
                </Text>
                <TextInput
                  style={[sc.emojiInput, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                  value={customEmoji}
                  onChangeText={setCustomEmoji}
                  placeholder="Type emoji..."
                  placeholderTextColor={C.textSecondary}
                  maxLength={4}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              style={sc.emojiToggleBtn}
              activeOpacity={0.8}
            >
              <Text style={[sc.emojiToggleBtnText, { color: C.primary }]}>
                {showEmojiPicker ? 'Hide emoji grid' : 'Choose from grid'}
              </Text>
              <Ionicons
                name={showEmojiPicker ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={C.primary}
              />
            </TouchableOpacity>

            {showEmojiPicker && (
              <View style={sc.emojiGrid}>
                {COMMON_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => { setIconEmoji(emoji); setCustomEmoji(''); }}
                    style={[
                      sc.emojiCell,
                      { backgroundColor: C.surface },
                      (customEmoji.trim() ? customEmoji.trim() : iconEmoji) === emoji &&
                        { backgroundColor: C.primary + '20', borderColor: C.primary },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text style={sc.emojiCellText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Category ── */}
          <View style={sc.card}>
            <SectionHeader title="Category" icon="grid-outline" C={C} />
            <View style={sc.catGrid}>
              {CATEGORIES.map(([key, val]) => {
                const isActive = category === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setCategory(key)}
                    activeOpacity={0.8}
                    style={sc.catChipOuter}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={[val.color, val.color2]}
                        style={sc.catChip}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={sc.catChipEmoji}>{val.emoji}</Text>
                        <Text style={[sc.catChipLabel, { color: '#fff' }]} numberOfLines={1}>
                          {val.label}
                        </Text>
                        <Ionicons name="checkmark-circle" size={14} color="#fff" />
                      </LinearGradient>
                    ) : (
                      <View style={[sc.catChip, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}>
                        <Text style={sc.catChipEmoji}>{val.emoji}</Text>
                        <Text style={[sc.catChipLabel, { color: C.text }]} numberOfLines={1}>
                          {val.label}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Community type ── */}
          <View style={sc.card}>
            <SectionHeader title="Community Type" icon="shield-outline" C={C} />
            <View style={sc.typeList}>
              {COMMUNITY_TYPES.map((t) => {
                const isActive = communityType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setCommunityType(t.value)}
                    activeOpacity={0.8}
                    style={[
                      sc.typeItem,
                      { backgroundColor: C.surface, borderColor: isActive ? C.primary : C.border },
                      isActive && { backgroundColor: C.primary + '10' },
                    ]}
                  >
                    <View style={[sc.typeIconWrap, { backgroundColor: isActive ? C.primary + '20' : C.border + '60' }]}>
                      <Ionicons name={t.icon} size={20} color={isActive ? C.primary : C.textSecondary} />
                    </View>
                    <View style={sc.typeTextWrap}>
                      <Text style={[sc.typeName, { color: isActive ? C.primary : C.text }]}>
                        {t.label}
                      </Text>
                      <Text style={[sc.typeDesc, { color: C.textSecondary }]}>{t.desc}</Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Tags ── */}
          <View style={sc.card}>
            <SectionHeader title="Tags" icon="pricetag-outline" C={C} />
            <Text style={[sc.cardSubtitle, { color: C.textSecondary }]}>
              Add comma-separated tags to help people find your community
            </Text>
            <FormInput
              label="Tags (comma-separated)"
              value={tagsText}
              onChangeText={setTagsText}
              placeholder="e.g. startup, tech, india"
              maxLength={100}
              C={C}
            />
            {tagsText.length > 0 && (
              <View style={sc.tagsPreview}>
                {tagsText.split(',').map((t) => t.trim()).filter((t) => t.length > 0).map((tag, i) => (
                  <View key={i} style={[sc.tagPill, { backgroundColor: C.secondary + '15' }]}>
                    <Text style={[sc.tagPillText, { color: C.secondary }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Rules ── */}
          <View style={sc.card}>
            <SectionHeader title="Community Rules" icon="document-text-outline" C={C} />
            <Text style={[sc.cardSubtitle, { color: C.textSecondary }]}>
              Optional: Set rules members must follow
            </Text>
            {rules.map((rule, i) => (
              <View key={i} style={sc.ruleRow}>
                <View style={[sc.ruleNum, { backgroundColor: C.primary + '20' }]}>
                  <Text style={[sc.ruleNumText, { color: C.primary }]}>{i + 1}</Text>
                </View>
                <TextInput
                  style={[sc.ruleInput, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.text }]}
                  value={rule}
                  onChangeText={(t) => updateRule(i, t)}
                  placeholder={`Rule ${i + 1}`}
                  placeholderTextColor={C.textSecondary}
                  maxLength={150}
                />
                {rules.length > 1 && (
                  <TouchableOpacity onPress={() => removeRule(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={C.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {rules.length < 10 && (
              <TouchableOpacity onPress={addRule} style={sc.addRuleBtn} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={16} color={C.primary} />
                <Text style={[sc.addRuleBtnText, { color: C.primary }]}>Add Rule</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Privacy toggle ── */}
          <View style={sc.card}>
            <SectionHeader title="Privacy" icon="eye-outline" C={C} />
            <View style={sc.toggleRow}>
              <View style={sc.toggleLeft}>
                <Text style={[sc.toggleLabel, { color: C.text }]}>Private Community</Text>
                <Text style={[sc.toggleDesc, { color: C.textSecondary }]}>
                  {isPrivate
                    ? 'Community is hidden from search'
                    : 'Community is visible in search and browse'}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: C.switchTrack, true: C.primary + '80' }}
                thumbColor={isPrivate ? C.primary : '#fff'}
              />
            </View>
          </View>

          {/* ── Create button ── */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.85}
            style={sc.createBtnWrap}
          >
            <LinearGradient
              colors={['#FF4B6E', '#C2185B', '#6C5CE7']}
              style={[sc.createBtn, submitting && { opacity: 0.7 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={20} color="#fff" />
                  <Text style={sc.createBtnText}>Create Community</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingTop: spacing.md },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      paddingBottom: spacing.lg,
    },
    backBtn: { marginRight: spacing.sm },
    backBtnInner: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
    headerIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Cards
    card: {
      backgroundColor: C.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.card,
    },
    cardSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },

    // Emoji picker
    emojiPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    emojiPreview: {
      width: 64,
      height: 64,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiPreviewText: { fontSize: 34 },
    emojiInputWrap: { flex: 1 },
    emojiInputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
    emojiInput: {
      borderRadius: radius.md,
      borderWidth: 1.5,
      paddingHorizontal: spacing.md,
      height: 44,
      fontSize: 20,
      textAlign: 'center',
    },
    emojiToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
    },
    emojiToggleBtnText: { fontSize: 13, fontWeight: '600' },
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    emojiCell: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    emojiCellText: { fontSize: 22 },

    // Category grid
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    catChipOuter: { width: '48%' },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      minHeight: 40,
    },
    catChipEmoji: { fontSize: 16 },
    catChipLabel: { flex: 1, fontSize: 12, fontWeight: '600' },

    // Community type
    typeList: { gap: spacing.sm },
    typeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
    },
    typeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeTextWrap: { flex: 1 },
    typeName: { fontSize: 14, fontWeight: '700' },
    typeDesc: { fontSize: 12, marginTop: 1 },

    // Tags preview
    tagsPreview: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: -spacing.xs,
    },
    tagPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    tagPillText: { fontSize: 12, fontWeight: '600' },

    // Rules
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    ruleNum: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruleNumText: { fontSize: 12, fontWeight: '800' },
    ruleInput: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1.5,
      paddingHorizontal: spacing.sm,
      height: 42,
      fontSize: 14,
    },
    addRuleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: spacing.xs,
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
    },
    addRuleBtnText: { fontSize: 13, fontWeight: '600' },

    // Privacy toggle
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    toggleLeft: { flex: 1 },
    toggleLabel: { fontSize: 14, fontWeight: '700' },
    toggleDesc: { fontSize: 12, marginTop: 2, lineHeight: 18 },

    // Create button
    createBtnWrap: { marginTop: spacing.sm },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      height: 56,
      borderRadius: radius.full,
      ...shadows.md,
    },
    createBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.3,
    },
  });
}
