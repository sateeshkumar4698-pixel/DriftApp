import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { createEvent } from '../../utils/firestore-helpers';
import Button from '../../components/Button';
import Input from '../../components/Input';
import DatePickerInput from '../../components/DatePickerInput';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Event, EventCategory } from '../../types';

const CATEGORIES: { label: string; value: EventCategory }[] = [
  { label: '🎉 Social', value: 'social' },
  { label: '💼 Professional', value: 'professional' },
  { label: '⚽ Sports', value: 'sports' },
  { label: '🍕 Food', value: 'food' },
  { label: '📌 Other', value: 'other' },
];

export default function CreateEventScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile } = useAuthStore();
  const { addEvent } = useEventStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateMs, setDateMs] = useState<number | undefined>();
  const [maxAttendees, setMaxAttendees] = useState('');
  const [category, setCategory] = useState<EventCategory>('social');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!location.trim()) e.location = 'Location is required';
    if (!dateMs) e.date = 'Date & time is required';
    else if (dateMs < Date.now()) e.date = 'Event must be in the future';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate() || !firebaseUser || !userProfile) return;
    setLoading(true);
    try {
      const event: Event = {
        id: `evt_${Date.now()}_${firebaseUser.uid}`,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: dateMs!,
        hostId: firebaseUser.uid,
        hostName: userProfile.name,
        attendees: [firebaseUser.uid],
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        category,
        createdAt: Date.now(),
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

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host an Event</Text>
        <View style={{ width: 32 }} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Input label="Event Title" value={title} onChangeText={setTitle} placeholder="Evening Hike at Nandi Hills" error={errors.title} />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Tell people what to expect..." multiline numberOfLines={3} style={styles.multiline} error={errors.description} />
          <Input label="Location" value={location} onChangeText={setLocation} placeholder="Cubbon Park, Bangalore" error={errors.location} />
          <DatePickerInput
            label="Date & Time"
            value={dateMs}
            onChange={setDateMs}
            error={errors.date}
            minDate={Date.now()}
          />
          <Input label="Max Attendees (optional)" value={maxAttendees} onChangeText={setMaxAttendees} placeholder="20" keyboardType="number-pad" />

          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, category === value && styles.chipSelected]}
                onPress={() => setCategory(value)}
              >
                <Text style={[styles.chipText, category === value && styles.chipTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button title="Create Event" onPress={handleCreate} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backIcon: { fontSize: 22, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  multiline: { height: 80, textAlignVertical: 'top' },
  sectionLabel: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.background, fontWeight: '600' },
});
