/**
 * AvatarBuilderScreen
 *
 * Lets the user create a cartoon avatar using the DiceBear API
 * (free, no API key required).
 *
 * Style used: "adventurer" — great-looking illustrated personas.
 * Avatar URL format: https://api.dicebear.com/9.x/adventurer/png?seed=SEED&OPTIONS
 *
 * On Save → writes the generated URL to the user's photoURL in Firestore.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius } from '../../utils/theme';

// ─── Avatar Options ───────────────────────────────────────────────────────────

const SKIN_TONES = [
  { label: 'Light',     value: 'f8d5c2' },
  { label: 'Cream',     value: 'f5cfa0' },
  { label: 'Warm',      value: 'e8a87c' },
  { label: 'Tan',       value: 'd4956a' },
  { label: 'Brown',     value: 'b07040' },
  { label: 'Dark',      value: '7c4a20' },
];

const HAIR_COLORS = [
  { label: 'Black',    value: '1a1a1a' },
  { label: 'Brown',    value: '6b3a2a' },
  { label: 'Blonde',   value: 'e8c170' },
  { label: 'Auburn',   value: '8b3a3a' },
  { label: 'Red',      value: 'c0392b' },
  { label: 'Blue',     value: '2980b9' },
  { label: 'Purple',   value: '8e44ad' },
  { label: 'Pink',     value: 'e91e8c' },
  { label: 'White',    value: 'f5f5f5' },
];

const HAIR_STYLES = [
  { label: 'Short',    value: 'short01' },
  { label: 'Spiky',    value: 'short02' },
  { label: 'Curly',    value: 'short03' },
  { label: 'Wavy',     value: 'short04' },
  { label: 'Long',     value: 'long01' },
  { label: 'Bun',      value: 'long02' },
  { label: 'Braids',   value: 'long03' },
  { label: 'Fringe',   value: 'long04' },
  { label: 'Shaved',   value: 'short05' },
];

const EYE_STYLES = [
  { label: 'Bright',   value: 'variant01' },
  { label: 'Happy',    value: 'variant02' },
  { label: 'Wink',     value: 'variant03' },
  { label: 'Cool',     value: 'variant04' },
  { label: 'Sleepy',   value: 'variant05' },
  { label: 'Stars',    value: 'variant06' },
  { label: 'Hearts',   value: 'variant07' },
  { label: 'Playful',  value: 'variant08' },
];

const MOUTH_STYLES = [
  { label: 'Smile',    value: 'variant01' },
  { label: 'Grin',     value: 'variant02' },
  { label: 'Smirk',    value: 'variant03' },
  { label: 'Wide',     value: 'variant04' },
  { label: 'Cute',     value: 'variant05' },
  { label: 'Neutral',  value: 'variant06' },
];

const BG_GRADIENTS: Array<{ label: string; from: string; to: string }> = [
  { label: 'Rose',     from: 'FF4B6E', to: 'C2185B' },
  { label: 'Purple',   from: '6C5CE7', to: '4834D4' },
  { label: 'Ocean',    from: '0984E3', to: '00B4D8' },
  { label: 'Mint',     from: '00B894', to: '00CEC9' },
  { label: 'Sunset',   from: 'FF8C00', to: 'FF4B6E' },
  { label: 'Night',    from: '2D3436', to: '636E72' },
  { label: 'Gold',     from: 'FFD700', to: 'FF8C00' },
  { label: 'Forest',   from: '27AE60', to: '2ECC71' },
];

// ─── URL Builder ──────────────────────────────────────────────────────────────

interface AvatarOptions {
  skinColor:  string;
  hairColor:  string;
  hairStyle:  string;
  eyeStyle:   string;
  mouthStyle: string;
  bgFrom:     string;
  bgTo:       string;
}

function buildAvatarUrl(seed: string, opts: AvatarOptions): string {
  const params = new URLSearchParams({
    seed,
    skinColor:      opts.skinColor,
    hairColor:      opts.hairColor,
    hair:           opts.hairStyle,
    eyes:           opts.eyeStyle,
    mouth:          opts.mouthStyle,
    backgroundColor: opts.bgFrom,
    backgroundType: 'gradientLinear',
    backgroundRotation: '135',
    size: '256',
  });
  return `https://api.dicebear.com/9.x/adventurer/png?${params.toString()}`;
}

// ─── Option Selector Row ──────────────────────────────────────────────────────

function OptionRow<T extends { label: string; value: string }>({
  title,
  options,
  selected,
  onSelect,
  isColor = false,
  colorField,
  C,
}: {
  title:     string;
  options:   T[];
  selected:  string;
  onSelect:  (val: string) => void;
  isColor?:  boolean;
  colorField?: keyof T;
  C:         AppColors;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}>
        {options.map((opt) => {
          const active = selected === opt.value;
          const hexColor = colorField ? String(opt[colorField]) : opt.value;

          if (isColor) {
            return (
              <TouchableOpacity key={opt.value} onPress={() => onSelect(opt.value)} activeOpacity={0.8}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: `#${hexColor}`,
                  borderWidth: active ? 3 : 1.5,
                  borderColor: active ? C.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={opt.value} onPress={() => onSelect(opt.value)} activeOpacity={0.8}>
              <View style={{
                paddingHorizontal: 14, height: 34,
                borderRadius: 17,
                backgroundColor: active ? C.primary : C.surface,
                borderWidth: 1.5,
                borderColor: active ? C.primary : C.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{
                  fontSize: 12, fontWeight: active ? '700' : '500',
                  color: active ? '#fff' : C.textSecondary,
                }}>
                  {opt.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── BG Gradient Selector ─────────────────────────────────────────────────────

function BgSelector({
  selected,
  onSelect,
  C,
}: { selected: string; onSelect: (from: string, to: string) => void; C: AppColors }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
        Background
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}>
        {BG_GRADIENTS.map((bg) => {
          const active = selected === bg.from;
          return (
            <TouchableOpacity key={bg.label} onPress={() => onSelect(bg.from, bg.to)} activeOpacity={0.8}>
              <LinearGradient
                colors={[`#${bg.from}`, `#${bg.to}`]}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  borderWidth: active ? 3 : 1.5,
                  borderColor: active ? C.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {active && <Ionicons name="checkmark" size={16} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AvatarBuilderScreen() {
  const { C, isDark } = useTheme();
  const sc = makeStyles(C);
  const navigation = useNavigation<any>();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();

  // Avatar options state
  const [opts, setOpts] = useState<AvatarOptions>({
    skinColor:  'e8a87c',
    hairColor:  '1a1a1a',
    hairStyle:  'short01',
    eyeStyle:   'variant01',
    mouthStyle: 'variant01',
    bgFrom:     'FF4B6E',
    bgTo:       'C2185B',
  });

  // Use uid as seed so regenerates are deterministic per user
  const seed = firebaseUser?.uid ?? 'drift-user';
  const avatarUrl = buildAvatarUrl(seed, opts);

  const [saving, setSaving] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  // Reroll — pick a random seed suffix for variety
  const [seedSuffix, setSeedSuffix] = useState('');
  const fullSeed = seed + seedSuffix;
  const currentUrl = buildAvatarUrl(fullSeed, opts);

  function reroll() {
    setSeedSuffix(String(Math.floor(Math.random() * 99999)));
    setImgLoading(true);
  }

  function set<K extends keyof AvatarOptions>(key: K, val: AvatarOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: val }));
    setImgLoading(true);
  }

  async function handleSave() {
    if (!firebaseUser || !userProfile) return;
    setSaving(true);
    try {
      const updated = { ...userProfile, photoURL: currentUrl };
      await setUserProfile(firebaseUser.uid, { photoURL: currentUrl });
      setStoreProfile(updated);
      navigation.goBack();
    } catch {
      // non-critical
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={sc.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={sc.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={sc.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={sc.headerTitle}>Avatar Builder</Text>
        <TouchableOpacity onPress={reroll} style={sc.headerBtn}>
          <Ionicons name="shuffle-outline" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={sc.previewContainer}>
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1233'] : [C.surface, C.surface]}
          style={sc.previewBg}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={sc.avatarFrame}>
            {imgLoading && (
              <View style={sc.avatarLoading}>
                <ActivityIndicator color={C.primary} size="large" />
              </View>
            )}
            <Image
              source={{ uri: currentUrl }}
              style={[sc.avatarImage, imgLoading && { opacity: 0 }]}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />
          </View>
          <Text style={sc.previewHint}>Tap 🔀 to shuffle a random look</Text>
        </LinearGradient>
      </View>

      {/* Options */}
      <ScrollView
        style={sc.optionsScroll}
        contentContainerStyle={sc.optionsContent}
        showsVerticalScrollIndicator={false}
      >
        <OptionRow
          title="Skin Tone" options={SKIN_TONES}
          selected={opts.skinColor} onSelect={(v) => set('skinColor', v)}
          isColor colorField="value" C={C}
        />
        <OptionRow
          title="Hair Color" options={HAIR_COLORS}
          selected={opts.hairColor} onSelect={(v) => set('hairColor', v)}
          isColor colorField="value" C={C}
        />
        <OptionRow
          title="Hair Style" options={HAIR_STYLES}
          selected={opts.hairStyle} onSelect={(v) => set('hairStyle', v)}
          C={C}
        />
        <OptionRow
          title="Eyes" options={EYE_STYLES}
          selected={opts.eyeStyle} onSelect={(v) => set('eyeStyle', v)}
          C={C}
        />
        <OptionRow
          title="Mouth" options={MOUTH_STYLES}
          selected={opts.mouthStyle} onSelect={(v) => set('mouthStyle', v)}
          C={C}
        />
        <BgSelector
          selected={opts.bgFrom}
          onSelect={(from, to) => setOpts((p) => ({ ...p, bgFrom: from, bgTo: to }))}
          C={C}
        />
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save button */}
      <View style={sc.footer}>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <LinearGradient
            colors={['#FF4B6E', '#C2185B']}
            style={sc.saveBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                <Text style={sc.saveBtnText}>Use this Avatar</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    headerBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },

    previewContainer: { alignItems: 'center' },
    previewBg: {
      width: '100%',
      paddingVertical: spacing.xl,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    avatarFrame: {
      width: 160, height: 160, borderRadius: 80,
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: '#FF4B6E',
      backgroundColor: C.surface,
      shadowColor: '#FF4B6E',
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
    },
    avatarLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.surface,
    },
    avatarImage: { width: '100%', height: '100%' },
    previewHint: {
      marginTop: spacing.sm,
      fontSize: 12,
      color: C.textSecondary,
      fontWeight: '500',
    },

    optionsScroll: { flex: 1 },
    optionsContent: { padding: spacing.lg },

    footer: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: C.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      paddingBottom: 28,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    saveBtn: {
      height: 56, borderRadius: radius.lg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      shadowColor: '#FF4B6E',
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  });
}
