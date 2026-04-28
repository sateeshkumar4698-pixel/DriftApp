import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { createEvent } from '../../utils/firestore-helpers';
import DatePickerInput from '../../components/DatePickerInput';
import { spacing, radius, shadows } from '../../utils/theme';
import { Event, EventCategory } from '../../types';

// ─── Dark tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:     '#0D0D1A',
  card:   '#15152A',
  input:  '#1C1C35',
  border: '#2A2A4A',
  focus:  '#6C5CE7',
  text:   '#FFFFFF',
  sub:    '#8888BB',
  muted:  '#555580',
  pink:   '#FF4B6E',
  purple: '#6C5CE7',
  error:  '#EF4444',
};

const GRAD_HEADER = ['#1A0A2E', '#0D1744', '#0A1628'] as const;
const GRAD_SAVE   = ['#FF4B6E', '#C2185B', '#6C5CE7'] as const;

interface CategoryOption {
  label: string;
  value: EventCategory;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
}

const CATEGORIES: CategoryOption[] = [
  { label: 'Social',       value: 'social',       icon: 'people-outline',     grad: ['#FF4B6E', '#C2185B']  },
  { label: 'Professional', value: 'professional', icon: 'briefcase-outline',  grad: ['#6C5CE7', '#4834D4']  },
  { label: 'Sports',       value: 'sports',       icon: 'football-outline',   grad: ['#00D2FF', '#0077FF']  },
  { label: 'Food',         value: 'food',         icon: 'restaurant-outline', grad: ['#FFD700', '#FF8C00']  },
  { label: 'Other',        value: 'other',        icon: 'bookmark-outline',   grad: ['#00E676', '#00BCD4']  },
];

function DarkInput({
  label, value, onChangeText, placeholder, multiline, icon, error, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; multiline?: boolean; error?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  keyboardType?: 'default' | 'number-pad';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={sc.inputWrap}>
      <View style={sc.labelRow}>
        <Ionicons name={icon} size={13} color={D.sub} />
        <Text style={sc.labelText}>{label}</Text>
      </View>
      <View style={[sc.inputBox, focused && sc.inputFocused, !!error && sc.inputError, multiline && sc.inputMulti]}>
        <TextInput
          style={[sc.inputText, multiline && sc.inputTextMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={D.muted}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          keyboardType={keyboardType ?? 'default'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? (
        <View style={sc.errRow}>
          <Ionicons name="alert-circle-outline" size={12} color={D.error} />
          <Text style={sc.errText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile } = useAuthStore();
  const { addEvent } = useEventStore();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [dateMs,      setDateMs]      = useState<number | undefined>();
  const [maxAttendees,setMaxAttendees]= useState('');
  const [category,    setCategory]    = useState<EventCategory>('social');
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim())       e.title       = 'Title is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!location.trim())    e.location    = 'Location is required';
    if (!dateMs)             e.date        = 'Date & time is required';
    else if (dateMs < Date.now()) e.date   = 'Event must be in the future';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate() || !firebaseUser || !userProfile) return;
    setLoading(true);
    try {
      const event: Event = {
        id:           `evt_${Date.now()}_${firebaseUser.uid}`,
        title:        title.trim(),
        description:  description.trim(),
        location:     location.trim(),
        date:         dateMs!,
        hostId:       firebaseUser.uid,
        hostName:     userProfile.name,
        attendees:    [firebaseUser.uid],
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        category,
        createdAt:    Date.now(),
      };
      await createEvent(event);
      addEvent(event);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to create event.');
    } finally {
      setLoading(false);
    }
  }

  const selected = CATEGORIES.find((c) => c.value === category)!;

  return (
    <View style={sc.root}>
      <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={sc.flex}>

        {/* Header */}
        <LinearGradient colors={GRAD_HEADER} style={sc.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={sc.backBtn} onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#ffffff18', '#ffffff0A']} style={sc.backBtnGrad}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={sc.headerCenter}>
            <Text style={sc.headerTitle}>Host an Event</Text>
            <Text style={sc.headerSub}>Create something memorable 🎉</Text>
          </View>
          {/* Category indicator */}
          <LinearGradient colors={selected.grad} style={sc.headerCatBadge}>
            <Ionicons name={selected.icon} size={16} color="#fff" />
          </LinearGradient>
        </LinearGradient>

        <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={sc.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Basic details card */}
            <View style={sc.glassCard}>
              <View style={sc.sectionHeader}>
                <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.sectionIcon}>
                  <Ionicons name="create-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={sc.sectionTitle}>Event Details</Text>
              </View>
              <DarkInput label="Event Title"  icon="text-outline"      value={title}       onChangeText={setTitle}       placeholder="Evening Hike at Nandi Hills" error={errors.title} />
              <DarkInput label="Description"  icon="document-text-outline" value={description} onChangeText={setDescription} placeholder="Tell people what to expect..." multiline error={errors.description} />
              <DarkInput label="Location"     icon="location-outline"  value={location}    onChangeText={setLocation}    placeholder="Cubbon Park, Bangalore" error={errors.location} />
              <DarkInput label="Max Attendees (optional)" icon="people-outline" value={maxAttendees} onChangeText={setMaxAttendees} placeholder="e.g. 20" keyboardType="number-pad" />
            </View>

            {/* Date card */}
            <View style={sc.glassCard}>
              <View style={sc.sectionHeader}>
                <LinearGradient colors={['#6C5CE7', '#4834D4']} style={sc.sectionIcon}>
                  <Ionicons name="calendar-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={sc.sectionTitle}>Date & Time</Text>
              </View>
              {/* DatePickerInput uses its own styles — wrap it in a dark container */}
              <View style={sc.dateWrap}>
                <DatePickerInput
                  label=""
                  value={dateMs}
                  onChange={setDateMs}
                  error={errors.date}
                  minDate={Date.now()}
                />
              </View>
            </View>

            {/* Category card */}
            <View style={sc.glassCard}>
              <View style={sc.sectionHeader}>
                <LinearGradient colors={['#00D2FF', '#0077FF']} style={sc.sectionIcon}>
                  <Ionicons name="grid-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={sc.sectionTitle}>Category</Text>
              </View>
              <View style={sc.catGrid}>
                {CATEGORIES.map((cat) => {
                  const sel = category === cat.value;
                  return (
                    <TouchableOpacity key={cat.value} style={sc.catChipWrap} onPress={() => setCategory(cat.value)} activeOpacity={0.75}>
                      {sel ? (
                        <LinearGradient colors={cat.grad} style={sc.catChipSel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Ionicons name={cat.icon} size={16} color="#fff" />
                          <Text style={sc.catLabelSel}>{cat.label}</Text>
                          <View style={sc.catCheck}>
                            <Ionicons name="checkmark" size={9} color="#fff" />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={sc.catChipUnsel}>
                          <Ionicons name={cat.icon} size={16} color={D.sub} />
                          <Text style={sc.catLabel}>{cat.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Create button */}
            <TouchableOpacity onPress={handleCreate} activeOpacity={0.85} disabled={loading} style={sc.createBtnWrap}>
              <LinearGradient colors={GRAD_SAVE} style={sc.createBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="hourglass-outline" size={20} color="#fff" />
                    <Text style={sc.createBtnText}>Creating...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={sc.createBtnText}>Create Event</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const sc = StyleSheet.create({
  root:  { flex: 1, backgroundColor: D.bg },
  flex:  { flex: 1 },
  scroll:{ padding: spacing.lg, paddingTop: spacing.md },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#ffffff10',
  },
  backBtn:       { marginRight: spacing.sm },
  backBtnGrad:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff20' },
  headerCenter:  { flex: 1, alignItems: 'center' },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  headerSub:     { fontSize: 12, color: D.sub, marginTop: 1 },
  headerCatBadge:{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  glassCard: {
    backgroundColor: D.card, borderRadius: 20, borderWidth: 1,
    borderColor: D.border, padding: spacing.md, marginBottom: spacing.md,
    ...shadows.card, shadowColor: '#000', shadowOpacity: 0.4,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  sectionIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: D.text },

  inputWrap:      { marginBottom: spacing.sm + 2 },
  labelRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  labelText:      { fontSize: 12, fontWeight: '600', color: D.sub, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputBox:       { backgroundColor: D.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: spacing.md, height: 48, justifyContent: 'center' },
  inputFocused:   { borderColor: D.focus },
  inputError:     { borderColor: D.error },
  inputMulti:     { height: 90, paddingVertical: spacing.sm },
  inputText:      { fontSize: 14, color: D.text },
  inputTextMulti: { height: 72, textAlignVertical: 'top' },
  errRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  errText:        { fontSize: 11, color: D.error },

  dateWrap: { marginTop: -4 },

  catGrid:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  catChipWrap:{ width: '48.5%' },
  catChipSel: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg, position: 'relative' },
  catChipUnsel:{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: D.input, borderWidth: 1.5, borderColor: D.border },
  catLabelSel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  catLabel:    { fontSize: 13, fontWeight: '600', color: D.sub },
  catCheck:    { position: 'absolute', top: 6, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ffffff35', alignItems: 'center', justifyContent: 'center' },

  createBtnWrap: { marginTop: spacing.sm },
  createBtn:     { height: 56, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...shadows.md },
  createBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
