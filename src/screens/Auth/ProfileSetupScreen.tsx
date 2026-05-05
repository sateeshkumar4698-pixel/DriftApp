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
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { useTheme, AppColors, spacing, typography, radius } from '../../utils/useTheme';
import { LookingForOption, UserProfile } from '../../types';

const INTERESTS = [
  'Music', 'Sports', 'Travel', 'Food', 'Tech', 'Art',
  'Movies', 'Books', 'Fitness', 'Gaming', 'Photography',
  'Dancing', 'Cooking', 'Nature', 'Fashion', 'Startups',
];

const LOOKING_FOR: { label: string; value: LookingForOption }[] = [
  { label: '👫 Friends', value: 'friends' },
  { label: '💘 Dating', value: 'dating' },
  { label: '💼 Networking', value: 'networking' },
  { label: '🎉 Events', value: 'events' },
];

export default function ProfileSetupScreen() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { firebaseUser, setUserProfile: setStoreProfile } = useAuthStore();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  function toggleLookingFor(option: LookingForOption) {
    setLookingFor((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
    );
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = 'Enter your name (min 2 chars)';
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 13 || ageNum > 100)
      newErrors.age = 'Enter a valid age (13–100)';
    if (!bio.trim() || bio.trim().length < 10) newErrors.bio = 'Bio must be at least 10 characters';
    if (selectedInterests.length < 3) newErrors.interests = 'Pick at least 3 interests';
    if (lookingFor.length === 0) newErrors.lookingFor = 'Choose at least one option';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate() || !firebaseUser) return;
    setLoading(true);
    try {
      const profile: UserProfile = {
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber ?? '',
        name: name.trim(),
        age: parseInt(age, 10),
        bio: bio.trim(),
        interests: selectedInterests,
        lookingFor,
        coins: 100,
        streak: { current: 1, longest: 1, lastLoginDate: new Date().toISOString().slice(0, 10) },
        profileCompleteness: 60,
        isVerified: false,
        isBanned: false,
        createdAt: Date.now(),
      };
      await setUserProfile(firebaseUser.uid, profile);
      setStoreProfile(profile);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>Tell people who you are</Text>

        <Input
          label="Your Name"
          value={name}
          onChangeText={setName}
          placeholder="Jane Doe"
          error={errors.name}
        />
        <Input
          label="Age"
          value={age}
          onChangeText={setAge}
          placeholder="24"
          keyboardType="number-pad"
          maxLength={3}
          error={errors.age}
        />
        <Input
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A little about yourself..."
          multiline
          numberOfLines={3}
          style={styles.bioInput}
          error={errors.bio}
        />

        <Text style={styles.sectionLabel}>Interests</Text>
        {errors.interests && <Text style={styles.errorText}>{errors.interests}</Text>}
        <View style={styles.chipsRow}>
          {INTERESTS.map((interest) => {
            const selected = selectedInterests.includes(interest);
            return (
              <TouchableOpacity
                key={interest}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {interest}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Looking For</Text>
        {errors.lookingFor && <Text style={styles.errorText}>{errors.lookingFor}</Text>}
        <View style={styles.chipsRow}>
          {LOOKING_FOR.map(({ label, value }) => {
            const selected = lookingFor.includes(value);
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, styles.chipLarge, selected && styles.chipSelected]}
                onPress={() => toggleLookingFor(value)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title="Save Profile"
          onPress={handleSave}
          loading={loading}
          style={styles.saveButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },
    container: {
      padding: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    title: {
      ...typography.h1,
      color: C.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.body,
      color: C.textSecondary,
      marginBottom: spacing.xl,
    },
    bioInput: {
      height: 90,
      textAlignVertical: 'top',
    },
    sectionLabel: {
      ...typography.label,
      color: C.textSecondary,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
      textTransform: 'uppercase',
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    chipLarge: {
      paddingHorizontal: spacing.lg,
    },
    chipSelected: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    chipText: {
      ...typography.caption,
      color: C.textSecondary,
      fontWeight: '500',
    },
    chipTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    errorText: {
      ...typography.small,
      color: C.error,
      marginBottom: spacing.sm,
    },
    saveButton: {
      marginTop: spacing.md,
    },
  });
}
