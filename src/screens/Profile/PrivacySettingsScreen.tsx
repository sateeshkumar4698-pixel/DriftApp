import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import { colors, spacing, typography, radius } from '../../utils/theme';

interface PrivacyPrefs {
  statusVisibility: 'connections' | 'everyone';
  memoriesVisibility: 'private' | 'connections' | 'everyone';
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowConnectionRequests: boolean;
  showInDiscoverFeed: boolean;
}

function SettingRow({
  title,
  subtitle,
  value,
  onToggle,
  color,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  color?: string;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: color ?? colors.primary }}
        thumbColor={colors.background}
      />
    </View>
  );
}

function ChoiceRow({
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      <View style={styles.choiceRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.choiceBtn, value === opt.value && styles.choiceBtnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.choiceBtnText, value === opt.value && styles.choiceBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);

  // Initialise from saved profile prefs, falling back to safe defaults
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
      Alert.alert('Saved', 'Privacy settings updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.primary} size="small" /> : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Discovery */}
        <Text style={styles.sectionHeader}>DISCOVERY</Text>
        <View style={styles.card}>
          <SettingRow
            title="Show in Discover Feed"
            subtitle="Let others find your profile"
            value={prefs.showInDiscoverFeed}
            onToggle={(v) => update('showInDiscoverFeed', v)}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Allow Connection Requests"
            subtitle="Others can send you connection notes"
            value={prefs.allowConnectionRequests}
            onToggle={(v) => update('allowConnectionRequests', v)}
          />
        </View>

        {/* Status */}
        <Text style={styles.sectionHeader}>STATUS</Text>
        <View style={styles.card}>
          <ChoiceRow
            title="Who can see your status"
            subtitle="Controls who sees your 24h status posts"
            options={[
              { label: 'Connections', value: 'connections' },
              { label: 'Everyone', value: 'everyone' },
            ]}
            value={prefs.statusVisibility}
            onChange={(v) => update('statusVisibility', v as any)}
          />
        </View>

        {/* Memories */}
        <Text style={styles.sectionHeader}>MEMORIES</Text>
        <View style={styles.card}>
          <ChoiceRow
            title="Who can see your memories"
            subtitle="Auto-generated life moments on your profile"
            options={[
              { label: 'Private', value: 'private' },
              { label: 'Connections', value: 'connections' },
              { label: 'Everyone', value: 'everyone' },
            ]}
            value={prefs.memoriesVisibility}
            onChange={(v) => update('memoriesVisibility', v as any)}
          />
        </View>

        {/* Presence */}
        <Text style={styles.sectionHeader}>PRESENCE</Text>
        <View style={styles.card}>
          <SettingRow
            title="Show Online Status"
            subtitle="Display when you're active"
            value={prefs.showOnlineStatus}
            onToggle={(v) => update('showOnlineStatus', v)}
            color={colors.success}
          />
          <View style={styles.divider} />
          <SettingRow
            title="Show Last Seen"
            subtitle="Show when you were last active"
            value={prefs.showLastSeen}
            onToggle={(v) => update('showLastSeen', v)}
          />
        </View>

        {/* Safety note */}
        <View style={styles.safetyNote}>
          <Text style={styles.safetyText}>
            🔒 Your phone number is never shared with other users. Location is only shown if you choose to drop it in a status.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  backText: { fontSize: 20, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text },
  saveText: { ...typography.body, color: colors.primary, fontWeight: '700' },

  container: { padding: spacing.lg, paddingBottom: spacing.xxl },

  sectionHeader: {
    ...typography.small,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  settingInfo: { flex: 1, marginRight: spacing.md },
  settingTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  settingSubtitle: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  choiceBlock: { padding: spacing.md },
  choiceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  choiceBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.background,
    borderWidth: 1.5, borderColor: colors.border,
  },
  choiceBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceBtnText: { ...typography.caption, color: colors.textSecondary, fontWeight: '500' },
  choiceBtnTextActive: { color: '#fff', fontWeight: '700' },

  safetyNote: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: `${colors.success}10`,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.success}25`,
  },
  safetyText: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
});
