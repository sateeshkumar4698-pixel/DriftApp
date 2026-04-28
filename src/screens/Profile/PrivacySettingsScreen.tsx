import React, { useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Switch,
  Text, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import { useTheme } from '../../utils/useTheme';
import { spacing, radius, shadows } from '../../utils/theme';

interface PrivacyPrefs {
  statusVisibility:        'connections' | 'everyone';
  memoriesVisibility:      'private' | 'connections' | 'everyone';
  showOnlineStatus:        boolean;
  showLastSeen:            boolean;
  allowConnectionRequests: boolean;
  showInDiscoverFeed:      boolean;
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({
  title, icon, grad, children, C,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
  children: React.ReactNode;
  C: ReturnType<typeof useTheme>['C'];
}) {
  return (
    <View style={ps.section}>
      <View style={ps.sectionHeader}>
        <LinearGradient colors={grad} style={ps.sectionIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={icon} size={14} color="#fff" />
        </LinearGradient>
        <Text style={[ps.sectionTitle, { color: C.text }]}>{title}</Text>
      </View>
      <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  icon, label, sublabel, value, onToggle, activeColor, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  activeColor?: string;
  C: ReturnType<typeof useTheme>['C'];
}) {
  return (
    <View style={[ps.toggleRow, { borderBottomColor: C.border }]}>
      <Ionicons name={icon} size={18} color={value ? (activeColor ?? C.primary) : C.textTertiary} style={{ marginRight: 12 }} />
      <View style={ps.toggleInfo}>
        <Text style={[ps.toggleLabel, { color: C.text }]}>{label}</Text>
        {sublabel ? <Text style={[ps.toggleSub, { color: C.textSecondary }]}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: C.switchTrack, true: activeColor ?? C.primary }}
        thumbColor={value ? '#fff' : '#ccc'}
      />
    </View>
  );
}

function ChoiceRow({
  icon, label, sublabel, options, value, onChange, C, activeGrad,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  C: ReturnType<typeof useTheme>['C'];
  activeGrad: readonly [string, string];
}) {
  return (
    <View style={[ps.choiceBlock, { borderBottomColor: C.border }]}>
      <View style={ps.choiceTop}>
        <Ionicons name={icon} size={18} color={C.textTertiary} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={[ps.toggleLabel, { color: C.text }]}>{label}</Text>
          {sublabel ? <Text style={[ps.toggleSub, { color: C.textSecondary }]}>{sublabel}</Text> : null}
        </View>
      </View>
      <View style={ps.choiceChips}>
        {options.map((opt) => {
          const sel = value === opt.value;
          return sel ? (
            <TouchableOpacity key={opt.value} activeOpacity={0.8}>
              <LinearGradient colors={activeGrad} style={ps.chipSel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="checkmark" size={11} color="#fff" />
                <Text style={ps.chipTextSel}>{opt.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={opt.value} style={[ps.chipUnsel, { backgroundColor: C.cardAlt, borderColor: C.border }]} onPress={() => onChange(opt.value)} activeOpacity={0.75}>
              <Text style={[ps.chipText, { color: C.textSecondary }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PrivacySettingsScreen() {
  const navigation    = useNavigation();
  const { C, isDark } = useTheme();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [prefs, setPrefs] = useState<PrivacyPrefs>(() => {
    const saved = (userProfile as Record<string, unknown> | null)
      ?.privacyPrefs as Partial<PrivacyPrefs> | undefined;
    return {
      statusVisibility:        saved?.statusVisibility        ?? 'connections',
      memoriesVisibility:      saved?.memoriesVisibility      ?? 'connections',
      showOnlineStatus:        saved?.showOnlineStatus        ?? true,
      showLastSeen:            saved?.showLastSeen            ?? true,
      allowConnectionRequests: saved?.allowConnectionRequests ?? true,
      showInDiscoverFeed:      saved?.showInDiscoverFeed      ?? true,
    };
  });

  function update<K extends keyof PrivacyPrefs>(key: K, value: PrivacyPrefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    if (!firebaseUser || !userProfile) return;
    setSaving(true);
    try {
      await setUserProfile(firebaseUser.uid, { privacyPrefs: prefs } as any);
      setStoreProfile({ ...userProfile, privacyPrefs: prefs } as any);
      Alert.alert('Saved ✓', 'Privacy settings updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[ps.root, { backgroundColor: C.background }]}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}

      <SafeAreaView style={ps.flex}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : ['#FFFFFF', '#F8F9FA']}
          style={[ps.header, { borderBottomColor: C.border }]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient colors={isDark ? ['#ffffff18', '#ffffff0A'] : ['#F3F4F6', '#E5E7EB']} style={ps.backBtn}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={ps.headerCenter}>
            <Text style={[ps.headerTitle, { color: C.text }]}>Privacy Settings</Text>
            <Text style={[ps.headerSub, { color: C.textSecondary }]}>Control your visibility</Text>
          </View>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={C.primary} size="small" />
              : <LinearGradient colors={['#FF4B6E', '#C2185B']} style={ps.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={ps.saveBtnText}>Save</Text>
                </LinearGradient>
            }
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView contentContainerStyle={ps.scroll} showsVerticalScrollIndicator={false}>

          {/* Discovery */}
          <Section title="Discovery" icon="search-outline" grad={['#6C5CE7', '#4834D4']} C={C}>
            <ToggleRow
              icon="eye-outline"
              label="Show in Discover Feed"
              sublabel="Let others find and swipe your profile"
              value={prefs.showInDiscoverFeed}
              onToggle={(v) => update('showInDiscoverFeed', v)}
              activeColor="#6C5CE7"
              C={C}
            />
            <ToggleRow
              icon="person-add-outline"
              label="Allow Connection Requests"
              sublabel="Others can send you connection notes"
              value={prefs.allowConnectionRequests}
              onToggle={(v) => update('allowConnectionRequests', v)}
              activeColor="#FF4B6E"
              C={C}
            />
          </Section>

          {/* Status */}
          <Section title="Status Posts" icon="radio-outline" grad={['#FF4B6E', '#C2185B']} C={C}>
            <ChoiceRow
              icon="people-outline"
              label="Who can see your status"
              sublabel="Controls who sees your 24h status posts"
              options={[
                { label: 'Connections', value: 'connections' },
                { label: 'Everyone', value: 'everyone' },
              ]}
              value={prefs.statusVisibility}
              onChange={(v) => update('statusVisibility', v as any)}
              activeGrad={['#FF4B6E', '#C2185B']}
              C={C}
            />
          </Section>

          {/* Memories */}
          <Section title="Memories" icon="images-outline" grad={['#FFD700', '#FF8C00']} C={C}>
            <ChoiceRow
              icon="lock-closed-outline"
              label="Who can see your memories"
              sublabel="Auto-generated life moments on your profile"
              options={[
                { label: 'Private',     value: 'private'     },
                { label: 'Connections', value: 'connections' },
                { label: 'Everyone',    value: 'everyone'    },
              ]}
              value={prefs.memoriesVisibility}
              onChange={(v) => update('memoriesVisibility', v as any)}
              activeGrad={['#FFD700', '#FF8C00']}
              C={C}
            />
          </Section>

          {/* Presence */}
          <Section title="Online Presence" icon="wifi-outline" grad={['#00E676', '#00BCD4']} C={C}>
            <ToggleRow
              icon="ellipse"
              label="Show Online Status"
              sublabel="Display green dot when you're active"
              value={prefs.showOnlineStatus}
              onToggle={(v) => update('showOnlineStatus', v)}
              activeColor="#00E676"
              C={C}
            />
            <ToggleRow
              icon="time-outline"
              label="Show Last Seen"
              sublabel="Show when you were last active to connections"
              value={prefs.showLastSeen}
              onToggle={(v) => update('showLastSeen', v)}
              activeColor="#00BCD4"
              C={C}
            />
          </Section>

          {/* Safety note */}
          <View style={[ps.safetyNote, { backgroundColor: `${C.success}12`, borderColor: `${C.success}30` }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.success} style={{ marginRight: 10, marginTop: 1 }} />
            <Text style={[ps.safetyText, { color: C.textSecondary }]}>
              Your phone number is <Text style={{ fontWeight: '700', color: C.text }}>never shared</Text> with other users. Location is only shown if you choose to drop it in a status post.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const ps = StyleSheet.create({
  root:  { flex: 1 },
  flex:  { flex: 1 },
  scroll:{ padding: spacing.lg, paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700' },
  headerSub:    { fontSize: 12, marginTop: 1 },
  saveBtn:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  saveBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  section:       { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  sectionIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, ...shadows.card, shadowColor: '#000', shadowOpacity: 0.15 },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  toggleInfo: { flex: 1 },
  toggleLabel:{ fontSize: 14, fontWeight: '600' },
  toggleSub:  { fontSize: 12, marginTop: 2 },

  choiceBlock: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  choiceTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  choiceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: 30 },
  chipSel:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  chipUnsel:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1.5 },
  chipTextSel: { fontSize: 12, fontWeight: '700', color: '#fff' },
  chipText:    { fontSize: 12, fontWeight: '600' },

  safetyNote: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginTop: spacing.sm },
  safetyText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
