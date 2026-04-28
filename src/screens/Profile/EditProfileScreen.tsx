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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { setUserProfile } from '../../utils/firestore-helpers';
import { colors, spacing, typography, radius, shadows } from '../../utils/theme';
import { LookingForOption } from '../../types';
import { validateDriftId, generateUsername } from '../../utils/profileShare';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';


// ─── Design tokens (dark theme) ───────────────────────────────────────────────
const D = {
  bg:        '#0D0D1A',
  bgCard:    '#15152A',
  bgInput:   '#1C1C35',
  border:    '#2A2A4A',
  borderBrt: '#3D3D6B',
  text:      '#FFFFFF',
  textSub:   '#8888BB',
  textMuted: '#555580',
  pink:      '#FF4B6E',
  purple:    '#6C5CE7',
  cyan:      '#00D2FF',
  gold:      '#FFD700',
};

const GRAD_HEADER  = ['#1A0A2E', '#0D1744', '#0A1628'] as const;
const GRAD_PINK    = ['#FF4B6E', '#C2185B'] as const;
const GRAD_PURPLE  = ['#6C5CE7', '#4834D4'] as const;
const GRAD_CYAN    = ['#00D2FF', '#0077FF'] as const;
const GRAD_GOLD    = ['#FFD700', '#FF8C00'] as const;
const GRAD_SAVE    = ['#FF4B6E', '#C2185B', '#6C5CE7'] as const;
const GRAD_SLOT    = ['#FF4B6E', '#6C5CE7'] as const;

// ─── Interest icon map ────────────────────────────────────────────────────────
const INTEREST_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  Music: 'musical-notes-outline', Sports: 'football-outline', Travel: 'airplane-outline',
  Food: 'restaurant-outline', Tech: 'hardware-chip-outline', Art: 'color-palette-outline',
  Movies: 'film-outline', Books: 'book-outline', Fitness: 'barbell-outline',
  Gaming: 'game-controller-outline', Photography: 'camera-outline', Dancing: 'musical-note-outline',
  Cooking: 'flame-outline', Nature: 'leaf-outline', Fashion: 'shirt-outline', Startups: 'rocket-outline',
};

const INTERESTS = Object.keys(INTEREST_ICON);

const LOOKING_FOR: { label: string; value: LookingForOption; icon: React.ComponentProps<typeof Ionicons>['name']; grad: readonly [string, string] }[] = [
  { label: 'Friends',    value: 'friends',    icon: 'people-outline',    grad: GRAD_CYAN   },
  { label: 'Dating',     value: 'dating',     icon: 'heart-outline',     grad: GRAD_PINK   },
  { label: 'Networking', value: 'networking', icon: 'briefcase-outline',  grad: GRAD_PURPLE },
  { label: 'Events',     value: 'events',     icon: 'calendar-outline',   grad: GRAD_GOLD   },
];

function calcCompleteness(fields: {
  name: string; bio: string; city: string; college: string; work: string;
  interests: string[]; photos: string[]; vibeProfile: boolean;
}): number {
  let score = 20;
  if (fields.name.trim().length >= 2)    score += 10;
  if (fields.bio.trim().length >= 20)    score += 10;
  if (fields.city.trim())                score += 8;
  if (fields.college.trim() || fields.work.trim()) score += 7;
  if (fields.interests.length >= 3)      score += 10;
  if (fields.photos.length >= 1)         score += 15;
  if (fields.photos.length >= 3)         score += 10;
  if (fields.vibeProfile)               score += 10;
  return Math.min(100, score);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon, grad }: {
  title: string; subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
}) {
  return (
    <View style={sc.sectionHeader}>
      <LinearGradient colors={grad} style={sc.sectionIconBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name={icon} size={14} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={sc.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={sc.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[sc.glassCard, style]}>{children}</View>;
}

function DarkInput({
  label, value, onChangeText, placeholder, multiline, icon,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; multiline?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={sc.inputWrap}>
      <View style={sc.inputLabel}>
        <Ionicons name={icon} size={13} color={D.textSub} style={{ marginRight: 4 }} />
        <Text style={sc.inputLabelText}>{label}</Text>
      </View>
      <View style={[sc.inputBox, focused && sc.inputBoxFocused, multiline && sc.inputBoxMulti]}>
        <TextInput
          style={[sc.inputText, multiline && sc.inputTextMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={D.textMuted}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();

  const [name,        setName]        = useState(userProfile?.name        ?? '');
  const [bio,         setBio]         = useState(userProfile?.bio         ?? '');
  const [city,        setCity]        = useState(userProfile?.city        ?? '');
  const [college,     setCollege]     = useState(userProfile?.college     ?? '');
  const [work,        setWork]        = useState(userProfile?.work        ?? '');
  const [instagram,   setInstagram]   = useState(userProfile?.instagram   ?? '');
  const [driftId,     setDriftId]     = useState(userProfile?.driftId     ?? '');
  const [driftIdError,setDriftIdError]= useState('');
  const [interests,   setInterests]   = useState<string[]>(userProfile?.interests  ?? []);
  const [lookingFor,  setLookingFor]  = useState<LookingForOption[]>(userProfile?.lookingFor ?? []);
  const [photos,      setPhotos]      = useState<string[]>(
    userProfile?.photos ?? (userProfile?.photoURL ? [userProfile.photoURL] : [])
  );
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);

  // live completeness
  const completeness = calcCompleteness({
    name, bio, city, college, work, interests, photos,
    vibeProfile: !!userProfile?.vibeProfile,
  });

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
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8,
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
      setPhotos((prev) => { const u = [...prev]; u[index] = url; return u; });
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
    const trimmedDriftId = driftId.toLowerCase().trim();
    if (trimmedDriftId && trimmedDriftId !== userProfile.driftId) {
      const idErr = validateDriftId(trimmedDriftId);
      if (idErr) { setDriftIdError(idErr); return; }
    }
    setDriftIdError('');
    setLoading(true);
    try {
      let resolvedDriftId = userProfile.driftId;
      if (trimmedDriftId && trimmedDriftId !== userProfile.driftId) {
        const idDoc = await getDoc(doc(db, 'driftIds', trimmedDriftId));
        if (idDoc.exists() && idDoc.data()?.uid !== firebaseUser.uid) {
          setDriftIdError('This Drift ID is already taken. Try another.');
          setLoading(false); return;
        }
        await setDoc(doc(db, 'driftIds', trimmedDriftId), { uid: firebaseUser.uid });
        if (userProfile.driftId)
          await setDoc(doc(db, 'driftIds', userProfile.driftId), { uid: null }).catch(() => {});
        resolvedDriftId = trimmedDriftId;
      }
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
        photoURL, photos, profileCompleteness, username,
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
    <View style={sc.root}>
      {/* ── Full-screen dark background ───────────────────────────────────── */}
      <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={sc.safeArea}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <LinearGradient colors={GRAD_HEADER} style={sc.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={sc.backBtn} onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#ffffff18', '#ffffff0A']} style={sc.backBtnGrad}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={sc.headerCenter}>
            <Text style={sc.headerTitle}>Edit Profile</Text>
            <Text style={sc.headerSub}>Make it shine ✨</Text>
          </View>
          {/* Completeness badge */}
          <View style={sc.headerRight}>
            <LinearGradient
              colors={completeness >= 80 ? GRAD_CYAN : completeness >= 50 ? GRAD_PURPLE : GRAD_PINK}
              style={sc.completenessRing}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Text style={sc.completenessNum}>{completeness}</Text>
              <Text style={sc.completenessLabel}>%</Text>
            </LinearGradient>
          </View>
        </LinearGradient>

        <KeyboardAvoidingView style={sc.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={sc.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Completeness bar ──────────────────────────────────────── */}
            <GlassCard style={sc.completeCard}>
              <View style={sc.completeRow}>
                <Ionicons name="sparkles-outline" size={14} color={D.cyan} />
                <Text style={sc.completeTitle}>Profile Strength</Text>
                <Text style={[sc.completePct, { color: completeness >= 80 ? D.cyan : completeness >= 50 ? D.purple : D.pink }]}>
                  {completeness}%
                </Text>
              </View>
              <View style={sc.barBg}>
                <LinearGradient
                  colors={completeness >= 80 ? GRAD_CYAN : completeness >= 50 ? GRAD_PURPLE : GRAD_PINK}
                  style={[sc.barFill, { width: `${completeness}%` as any }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={sc.completeHint}>
                {completeness < 50  ? 'Add bio, city and interests to level up'
                : completeness < 80 ? 'Add 3+ photos and complete your details'
                :                     'Looking great! 🔥 Almost perfect'}
              </Text>
            </GlassCard>

            {/* ── Photos ────────────────────────────────────────────────── */}
            <GlassCard>
              <SectionHeader
                title={`Photos  ${photos.length}/6`}
                subtitle="First photo is your main pic. Add 3+ for better matches."
                icon="images-outline"
                grad={GRAD_PINK}
              />
              <View style={sc.photoGrid}>
                {Array.from({ length: PHOTO_SLOTS }).map((_, i) => {
                  const photoUrl = photos[i];
                  const isMain   = i === 0;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={sc.photoSlotWrap}
                      onPress={() => !photoUrl && pickPhoto(i)}
                      activeOpacity={0.8}
                    >
                      {/* gradient border ring for main slot */}
                      {isMain ? (
                        <LinearGradient colors={GRAD_SLOT} style={sc.photoRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <View style={sc.photoInner}>
                            {renderSlot(i, photoUrl, uploadingIdx, pickPhoto, removePhoto, isMain)}
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={sc.photoSlotPlain}>
                          {renderSlot(i, photoUrl, uploadingIdx, pickPhoto, removePhoto, isMain)}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {/* ── Basic info ────────────────────────────────────────────── */}
            <GlassCard>
              <SectionHeader title="Basic Info" icon="person-outline" grad={GRAD_PURPLE} />
              <DarkInput label="Name"      icon="person-outline"    value={name}      onChangeText={setName}      placeholder="Your name" />
              <DarkInput label="Bio"       icon="create-outline"    value={bio}       onChangeText={setBio}       placeholder="A little about yourself..." multiline />
              <DarkInput label="City"      icon="location-outline"  value={city}      onChangeText={setCity}      placeholder="e.g. Bengaluru" />
              <DarkInput label="College"   icon="school-outline"    value={college}   onChangeText={setCollege}   placeholder="e.g. IIT Bombay (optional)" />
              <DarkInput label="Work"      icon="briefcase-outline" value={work}      onChangeText={setWork}      placeholder="e.g. Google (optional)" />
              <DarkInput label="Instagram" icon="logo-instagram"    value={instagram} onChangeText={setInstagram} placeholder="@username (optional)" />
            </GlassCard>

            {/* ── Drift ID ──────────────────────────────────────────────── */}
            <GlassCard>
              <SectionHeader
                title="Drift ID"
                subtitle="Your unique @handle — others can find you with it."
                icon="at-outline"
                grad={GRAD_CYAN}
              />
              <View style={sc.driftIdRow}>
                <LinearGradient colors={GRAD_CYAN} style={sc.driftAtBox}>
                  <Text style={sc.driftAt}>@</Text>
                </LinearGradient>
                <TextInput
                  style={[sc.driftIdInput, driftIdError ? sc.driftIdInputErr : null]}
                  value={driftId}
                  onChangeText={(v) => { setDriftId(v.toLowerCase().replace(/[^a-z0-9_.]/g, '')); setDriftIdError(''); }}
                  placeholder="yourhandle"
                  placeholderTextColor={D.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
              {driftIdError ? (
                <View style={sc.driftErrRow}>
                  <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
                  <Text style={sc.driftErrText}>{driftIdError}</Text>
                </View>
              ) : (
                <Text style={sc.driftIdHint}>
                  {userProfile?.driftId ? 'Change anytime.' : 'Leave blank to auto-generate.'}
                </Text>
              )}
            </GlassCard>

            {/* ── Interests ─────────────────────────────────────────────── */}
            <GlassCard>
              <SectionHeader
                title={`Interests  ${interests.length} selected`}
                subtitle="Pick at least 3 for better matches."
                icon="heart-outline"
                grad={GRAD_GOLD}
              />
              <View style={sc.interestGrid}>
                {INTERESTS.map((item) => {
                  const sel  = interests.includes(item);
                  const icon = INTEREST_ICON[item];
                  return (
                    <TouchableOpacity key={item} style={sc.interestChipWrap} onPress={() => toggleInterest(item)} activeOpacity={0.7}>
                      {sel ? (
                        <LinearGradient colors={GRAD_PINK} style={sc.interestChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Ionicons name={icon} size={13} color="#fff" />
                          <Text style={sc.interestChipTextSel}>{item}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={sc.interestChipUnsel}>
                          <Ionicons name={icon} size={13} color={D.textSub} />
                          <Text style={sc.interestChipText}>{item}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {/* ── Looking For ───────────────────────────────────────────── */}
            <GlassCard>
              <SectionHeader title="Looking For" icon="search-outline" grad={GRAD_PURPLE} />
              <View style={sc.lfGrid}>
                {LOOKING_FOR.map(({ label, value, icon, grad }) => {
                  const sel = lookingFor.includes(value);
                  return (
                    <TouchableOpacity key={value} style={sc.lfCardWrap} onPress={() => toggleLookingFor(value)} activeOpacity={0.75}>
                      {sel ? (
                        <LinearGradient colors={grad} style={sc.lfCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Ionicons name={icon} size={20} color="#fff" />
                          <Text style={sc.lfLabelSel}>{label}</Text>
                          <View style={sc.lfCheck}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={sc.lfCardUnsel}>
                          <Ionicons name={icon} size={20} color={D.textSub} />
                          <Text style={sc.lfLabel}>{label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>

            {/* ── Save button ───────────────────────────────────────────── */}
            <TouchableOpacity onPress={handleSave} activeOpacity={0.85} disabled={loading} style={sc.saveBtnWrap}>
              <LinearGradient colors={GRAD_SAVE} style={sc.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={sc.saveBtnText}>Save Changes</Text>
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

// ─── Photo slot renderer (extracted to keep JSX clean) ────────────────────────

function renderSlot(
  i: number, photoUrl: string | undefined,
  uploadingIdx: number | null,
  pickPhoto: (i: number) => void,
  removePhoto: (i: number) => void,
  isMain: boolean,
) {
  if (uploadingIdx === i) {
    return <ActivityIndicator color={D.pink} />;
  }
  if (photoUrl) {
    return (
      <>
        <Image source={{ uri: photoUrl }} style={sc.photoThumb} />
        <TouchableOpacity style={sc.photoRemove} onPress={() => removePhoto(i)}>
          <Ionicons name="close" size={11} color="#fff" />
        </TouchableOpacity>
        {isMain && (
          <LinearGradient colors={GRAD_PINK} style={sc.mainBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={sc.mainBadgeText}>MAIN</Text>
          </LinearGradient>
        )}
      </>
    );
  }
  return (
    <TouchableOpacity style={sc.photoAddBtn} onPress={() => pickPhoto(i)} activeOpacity={0.7}>
      <LinearGradient colors={['#ffffff0F', '#ffffff05']} style={sc.photoAddGrad}>
        <Ionicons name="add" size={24} color={isMain ? D.pink : D.textMuted} />
        {isMain && <Text style={sc.photoAddLabel}>Add Photo</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  root:      { flex: 1, backgroundColor: D.bg },
  safeArea:  { flex: 1 },
  flex:      { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#ffffff10',
  },
  backBtn:     { marginRight: spacing.sm },
  backBtnGrad: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff20' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  headerSub:   { fontSize: 12, color: D.textSub, marginTop: 1 },
  headerRight: { marginLeft: spacing.sm },
  completenessRing: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  completenessNum:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  completenessLabel: { fontSize: 10, fontWeight: '600', color: '#ffffffCC', marginTop: 3 },

  // Scroll
  scroll: { padding: spacing.lg, paddingTop: spacing.md },

  // Glass card
  glassCard: {
    backgroundColor: D.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: D.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
    shadowColor: '#000',
    shadowOpacity: 0.4,
  },

  // Completeness card
  completeCard: { paddingVertical: spacing.sm + 4 },
  completeRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  completeTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: D.text },
  completePct:   { fontSize: 13, fontWeight: '800' },
  barBg:  { height: 6, backgroundColor: '#ffffff15', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  barFill:{ height: 6, borderRadius: 3 },
  completeHint: { fontSize: 11, color: D.textSub },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: 10 },
  sectionIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: D.text },
  sectionSubtitle: { fontSize: 11, color: D.textSub, marginTop: 2, lineHeight: 15 },

  // Input
  inputWrap:       { marginBottom: spacing.sm + 2 },
  inputLabel:      { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  inputLabelText:  { fontSize: 12, fontWeight: '600', color: D.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputBox:        { backgroundColor: D.bgInput, borderRadius: radius.md, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: spacing.md, height: 48, justifyContent: 'center' },
  inputBoxFocused: { borderColor: D.purple },
  inputBoxMulti:   { height: 88, paddingVertical: spacing.sm },
  inputText:       { fontSize: 14, color: D.text, fontWeight: '400' },
  inputTextMulti:  { height: 72 },

  // Photos — 3-column, percentage widths so no pixel math needed
  photoGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  photoSlotWrap: { width: '32%', aspectRatio: 4 / 5 },
  photoRing:     { width: '100%', height: '100%', borderRadius: radius.md + 2, padding: 2 },
  photoInner:    { flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: D.bgInput, alignItems: 'center', justifyContent: 'center' },
  photoSlotPlain:{ width: '100%', height: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: D.bgInput, borderWidth: 1.5, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  photoThumb:    { width: '100%', height: '100%' },
  photoRemove:   { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  mainBadge:     { position: 'absolute', bottom: 5, left: 5, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  photoAddBtn:   { width: '100%', height: '100%' },
  photoAddGrad:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddLabel: { fontSize: 10, color: D.pink, fontWeight: '600' },

  // Drift ID
  driftIdRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  driftAtBox:    { width: 40, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  driftAt:       { fontSize: 18, fontWeight: '800', color: '#fff' },
  driftIdInput:  { flex: 1, height: 46, backgroundColor: D.bgInput, borderRadius: radius.md, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: spacing.md, fontSize: 15, color: D.text, fontWeight: '500' },
  driftIdInputErr:{ borderColor: colors.error },
  driftErrRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driftErrText:  { fontSize: 12, color: colors.error },
  driftIdHint:   { fontSize: 12, color: D.textMuted },

  // Interests
  interestGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  interestChipWrap:   {},
  interestChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  interestChipUnsel:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: D.bgInput, borderWidth: 1, borderColor: D.border },
  interestChipText:    { fontSize: 12, color: D.textSub, fontWeight: '500' },
  interestChipTextSel: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Looking for — 2-column, percentage widths so no pixel math needed
  lfGrid:        { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  lfCardWrap:    { width: '48.5%' },
  lfCard:        { width: '100%', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 90, position: 'relative' },
  lfCardUnsel:   { width: '100%', borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 90, backgroundColor: D.bgInput, borderWidth: 1.5, borderColor: D.border },
  lfLabelSel:    { fontSize: 13, fontWeight: '700', color: '#fff' },
  lfLabel:       { fontSize: 13, fontWeight: '600', color: D.textSub },
  lfCheck:       { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff30', alignItems: 'center', justifyContent: 'center' },

  // Save
  saveBtnWrap:  { marginTop: spacing.sm },
  saveBtn:      { height: 56, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...shadows.md },
  saveBtnText:  { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
