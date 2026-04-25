import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { LookingForOption } from '../../types';
import { validateDriftId, generateUsername } from '../../utils/profileShare';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

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

function calcCompleteness(fields: {
  name: string; bio: string; city: string; college: string; work: string;
  interests: string[]; photos: string[]; vibeProfile: boolean;
}): number {
  let score = 20; // base
  if (fields.name.trim().length >= 2) score += 10;
  if (fields.bio.trim().length >= 20) score += 10;
  if (fields.city.trim()) score += 8;
  if (fields.college.trim() || fields.work.trim()) score += 7;
  if (fields.interests.length >= 3) score += 10;
  if (fields.photos.length >= 1) score += 15;
  if (fields.photos.length >= 3) score += 10;
  if (fields.vibeProfile) score += 10;
  return Math.min(100, score);
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();

  const [name, setName] = useState(userProfile?.name ?? '');
  const [bio, setBio] = useState(userProfile?.bio ?? '');
  const [city, setCity] = useState(userProfile?.city ?? '');
  const [college, setCollege] = useState(userProfile?.college ?? '');
  const [work, setWork] = useState(userProfile?.work ?? '');
  const [instagram, setInstagram] = useState(userProfile?.instagram ?? '');
  const [driftId, setDriftId] = useState(userProfile?.driftId ?? '');
  const [driftIdError, setDriftIdError] = useState('');
  const [interests, setInterests] = useState<string[]>(userProfile?.interests ?? []);
  const [lookingFor, setLookingFor] = useState<LookingForOption[]>(userProfile?.lookingFor ?? []);
  const [photos, setPhotos] = useState<string[]>(userProfile?.photos ?? (userProfile?.photoURL ? [userProfile.photoURL] : []));
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleInterest(i: string) {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }
  function toggleLookingFor(v: LookingForOption) {
    setLookingFor((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }

  async function pickPhoto(index: number) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to add photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [4, 5], quality: 0.8,
    });
    if (result.canceled || !firebaseUser) return;

    setUploadingIdx(index);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `photos/${firebaseUser.uid}/${index}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setPhotos((prev) => {
        const updated = [...prev];
        updated[index] = url;
        return updated;
      });
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Try again.');
    } finally {
      setUploadingIdx(null);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!firebaseUser || !userProfile) return;
    if (!name.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }

    // Validate Drift ID if user changed it
    const trimmedDriftId = driftId.toLowerCase().trim();
    if (trimmedDriftId && trimmedDriftId !== userProfile.driftId) {
      const idErr = validateDriftId(trimmedDriftId);
      if (idErr) { setDriftIdError(idErr); return; }
    }
    setDriftIdError('');
    setLoading(true);

    try {
      // ── Drift ID uniqueness check ──────────────────────────────────────────
      let resolvedDriftId = userProfile.driftId;
      if (trimmedDriftId && trimmedDriftId !== userProfile.driftId) {
        const idDoc = await getDoc(doc(db, 'driftIds', trimmedDriftId));
        if (idDoc.exists() && idDoc.data()?.uid !== firebaseUser.uid) {
          setDriftIdError('This Drift ID is already taken. Try another.');
          setLoading(false);
          return;
        }
        // Reserve the new Drift ID
        await setDoc(doc(db, 'driftIds', trimmedDriftId), { uid: firebaseUser.uid });
        // Release the old one if it existed
        if (userProfile.driftId) {
          await setDoc(doc(db, 'driftIds', userProfile.driftId), { uid: null }).catch(() => {});
        }
        resolvedDriftId = trimmedDriftId;
      }

      // ── Auto-generate username if first time ───────────────────────────────
      const username = userProfile.username || generateUsername(name.trim(), firebaseUser.uid);

      const photoURL = photos[0] ?? userProfile.photoURL;
      const profileCompleteness = calcCompleteness({
        name, bio, city, college, work, interests, photos,
        vibeProfile: !!userProfile.vibeProfile,
      });
      const updated = {
        ...userProfile,
        name: name.trim(), bio: bio.trim(),
        city: city.trim(), college: college.trim(),
        work: work.trim(), instagram: instagram.trim(),
        interests, lookingFor,
        photoURL, photos,
        profileCompleteness,
        username,
        driftId: resolvedDriftId,
      };
      await setUserProfile(firebaseUser.uid, updated);
      setStoreProfile(updated);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setLoading(false);
    }
  }

  const PHOTO_SLOTS = 6;

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 32 }} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Photo grid — 6 slots */}
          <Text style={styles.sectionLabel}>Photos ({photos.length}/6)</Text>
          <Text style={styles.photoHint}>First photo is your main profile picture. Add 3+ for better matches.</Text>
          <View style={styles.photoGrid}>
            {Array.from({ length: PHOTO_SLOTS }).map((_, i) => {
              const photoUrl = photos[i];
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.photoSlot, i === 0 && styles.photoSlotMain]}
                  onPress={() => !photoUrl && pickPhoto(i)}
                  activeOpacity={0.8}
                >
                  {uploadingIdx === i ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : photoUrl ? (
                    <>
                      <Image source={{ uri: photoUrl }} style={styles.photoThumb} />
                      <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                        <Text style={styles.photoRemoveText}>✕</Text>
                      </TouchableOpacity>
                      {i === 0 && (
                        <View style={styles.mainBadge}>
                          <Text style={styles.mainBadgeText}>Main</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity style={styles.photoAdd} onPress={() => pickPhoto(i)}>
                      <Text style={styles.photoAddIcon}>+</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input label="Bio" value={bio} onChangeText={setBio} placeholder="A little about yourself..." multiline numberOfLines={3} style={styles.multiline} />
          <Input label="City" value={city} onChangeText={setCity} placeholder="e.g. Bengaluru" />
          <Input label="College" value={college} onChangeText={setCollege} placeholder="e.g. IIT Bombay (optional)" />
          <Input label="Work" value={work} onChangeText={setWork} placeholder="e.g. Google (optional)" />
          <Input label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="@username (optional)" />

          {/* ── Drift ID ──────────────────────────────────────────────────────── */}
          <View style={styles.driftIdSection}>
            <Text style={styles.sectionLabel}>Drift ID  <Text style={styles.driftIdBadge}>@handle</Text></Text>
            <Text style={styles.driftIdHint}>
              Your unique @handle — others can find you with it. Set once, change anytime.
              {userProfile?.driftId ? '' : ' Leave blank to auto-generate.'}
            </Text>
            <View style={styles.driftIdInputRow}>
              <Text style={styles.driftIdPrefix}>@</Text>
              <TextInput
                style={[styles.driftIdInput, driftIdError ? styles.driftIdInputErr : null]}
                value={driftId}
                onChangeText={(v) => { setDriftId(v.toLowerCase().replace(/[^a-z0-9_.]/g, '')); setDriftIdError(''); }}
                placeholder="yourhandle"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
            </View>
            {driftIdError ? <Text style={styles.driftIdError}>{driftIdError}</Text> : null}
          </View>

          <Text style={styles.sectionLabel}>Interests</Text>
          <View style={styles.chips}>
            {INTERESTS.map((item) => {
              const sel = interests.includes(item);
              return (
                <TouchableOpacity key={item} style={[styles.chip, sel && styles.chipSel]} onPress={() => toggleInterest(item)}>
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Looking For</Text>
          <View style={styles.chips}>
            {LOOKING_FOR.map(({ label, value }) => {
              const sel = lookingFor.includes(value);
              return (
                <TouchableOpacity key={value} style={[styles.chip, styles.chipLg, sel && styles.chipSel]} onPress={() => toggleLookingFor(value)}>
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button title="Save Changes" onPress={handleSave} loading={loading} style={styles.saveBtn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backIcon: { fontSize: 22, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoHint: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },

  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg,
  },
  photoSlot: {
    width: '31%', aspectRatio: 4 / 5,
    borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  photoSlotMain: { borderColor: colors.primary, borderWidth: 2 },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  mainBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  mainBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  photoAdd: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  photoAddIcon: { fontSize: 28, color: colors.textSecondary },

  multiline: { height: 80, textAlignVertical: 'top' },

  // Drift ID
  driftIdSection: { marginTop: spacing.md, marginBottom: spacing.xs },
  driftIdBadge: { ...typography.small, color: colors.primary, fontWeight: '600', textTransform: 'none' },
  driftIdHint: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 18 },
  driftIdInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, height: 50,
  },
  driftIdPrefix: { ...typography.body, color: colors.primary, fontWeight: '700', marginRight: 4 },
  driftIdInput: { flex: 1, ...typography.body, color: colors.text },
  driftIdInputErr: { borderColor: colors.error },
  driftIdError: { ...typography.small, color: colors.error, marginTop: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  chipLg: { paddingHorizontal: spacing.lg },
  chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '500' },
  chipTextSel: { color: colors.background, fontWeight: '600' },
  saveBtn: { marginTop: spacing.md },
});
