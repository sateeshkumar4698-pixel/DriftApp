import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme, spacing, typography, radius, shadows } from '../../utils/useTheme';
import { useAuthStore } from '../../store/authStore';
import {
  requestAndGetLocation,
  formatDistance,
  getDistanceKm,
} from '../../utils/locationUtils';
import {
  createMeetupPost,
  joinMeetupPost,
  leaveMeetupPost,
  subscribeToMeetupPosts,
} from '../../utils/meetup-helpers';
import { MeetupPost } from '../../types/meetup-board';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeLeft(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  const totalMinutes = Math.floor(diff / 1000 / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

// ─── Card component ───────────────────────────────────────────────────────────

interface MeetupCardProps {
  post: MeetupPost;
  uid: string;
  userName: string;
  userLat: number;
  userLon: number;
}

function MeetupCard({ post, uid, userName, userLat, userLon }: MeetupCardProps) {
  const { C } = useTheme();
  const isJoined = post.joiners.includes(uid);
  const distKm = getDistanceKm(userLat, userLon, post.lat, post.lon);

  async function handleToggle() {
    if (isJoined) {
      await leaveMeetupPost(post.id, uid, userName);
    } else {
      await joinMeetupPost(post.id, uid, userName);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: C.surface, borderColor: C.border, ...shadows.card },
      ]}
    >
      {/* Top row: avatar + name + time pill */}
      <View style={styles.cardRow}>
        <Avatar name={post.userName} photoURL={post.userPhotoURL} size={48} />
        <Text style={[styles.cardName, { color: C.text }]} numberOfLines={1}>
          {post.userName}
        </Text>
        <View style={[styles.timePill, { backgroundColor: C.border }]}>
          <Text style={[typography.small, { color: C.textSecondary }]}>
            {timeLeft(post.expiresAt)}
          </Text>
        </View>
      </View>

      {/* Venue */}
      <Text style={[typography.body, styles.venueName, { color: C.text }]}>
        📍 {post.venueName}
      </Text>

      {/* Note */}
      {!!post.note && (
        <Text style={[typography.caption, styles.noteText, { color: C.textSecondary }]}>
          {post.note}
        </Text>
      )}

      {/* Bottom row: count + join button */}
      <View style={styles.cardBottomRow}>
        <Text style={[typography.small, { color: C.primary }]}>
          {post.joiners.length} joining
        </Text>
        <TouchableOpacity
          onPress={handleToggle}
          activeOpacity={0.7}
          style={[
            styles.joinBtn,
            isJoined
              ? { backgroundColor: C.primary, borderColor: C.primary }
              : { backgroundColor: 'transparent', borderColor: C.primary },
          ]}
        >
          <Text
            style={[
              typography.small,
              { color: isJoined ? '#fff' : C.primary, fontWeight: '600' },
            ]}
          >
            {isJoined ? '✓ Joined' : "🙋 I'll Join"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Distance badge */}
      <Text style={[typography.small, styles.distanceBadge, { color: C.textSecondary }]}>
        {formatDistance(distKm)} away
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const DEFAULT_LAT = 12.9716;
const DEFAULT_LON = 77.5946;

export default function MeetupBoardScreen() {
  const { C } = useTheme();
  const navigation = useNavigation<any>();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const userProfile = useAuthStore((s) => s.userProfile);

  const [posts, setPosts] = useState<MeetupPost[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [venueInput, setVenueInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [posting, setPosting] = useState(false);

  const userLat = userLocation?.lat ?? DEFAULT_LAT;
  const userLon = userLocation?.lon ?? DEFAULT_LON;

  // Get location on mount
  useEffect(() => {
    requestAndGetLocation().then((loc) => {
      if (loc) setUserLocation(loc);
    });
  }, []);

  // Subscribe to nearby meetup posts
  useEffect(() => {
    const unsub = subscribeToMeetupPosts(userLat, userLon, 10, setPosts);
    return unsub;
  }, [userLat, userLon]);

  async function handlePost() {
    if (!venueInput.trim()) {
      Alert.alert('Venue required', 'Please enter where you are.');
      return;
    }
    if (!firebaseUser || !userProfile) return;

    setPosting(true);
    const loc = await requestAndGetLocation();
    if (!loc) {
      setPosting(false);
      Alert.alert('Location permission needed', 'Please allow location access and try again.');
      return;
    }

    try {
      await createMeetupPost({
        uid: firebaseUser.uid,
        userName: userProfile.name,
        userPhotoURL: userProfile.photoURL,
        venueName: venueInput.trim(),
        note: noteInput.trim() || undefined,
        lat: loc.lat,
        lon: loc.lon,
        city: userProfile.city ?? 'Unknown',
        joiners: [],
        joinerNames: [],
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        createdAt: Date.now(),
      });
      setVenueInput('');
      setNoteInput('');
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to post meetup. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  const uid = firebaseUser?.uid ?? '';
  const userName = userProfile?.name ?? '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: C.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>📍 Nearby Meetups</Text>
        <View style={styles.headerSide} />
      </View>

      {/* Subheader */}
      <View style={styles.subheader}>
        <Text style={[typography.caption, { color: C.textSecondary, flex: 1 }]}>
          People hanging out near you right now
        </Text>
        <View style={[styles.radiusPill, { borderColor: C.border }]}>
          <Text style={[typography.small, { color: C.textSecondary }]}>Within 10 km</Text>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MeetupCard
            post={item}
            uid={uid}
            userName={userName}
            userLat={userLat}
            userLon={userLon}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="🏕️"
            title="No meetups nearby"
            subtitle="Be the first to post one — tap + below"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#FF4B6E', '#FF7A93']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Post modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalSheet, { backgroundColor: C.surface, ...shadows.modal }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>📍 Post a Meetup</Text>

            <TextInput
              style={[
                styles.input,
                { backgroundColor: C.background, borderColor: C.border, color: C.text },
              ]}
              placeholder="Where are you? e.g. Blue Tokai, Koramangala"
              placeholderTextColor={C.textSecondary}
              value={venueInput}
              onChangeText={setVenueInput}
            />

            <TextInput
              style={[
                styles.input,
                { backgroundColor: C.background, borderColor: C.border, color: C.text },
              ]}
              placeholder='Add a note (optional) e.g. "Anyone for coffee? ☕"'
              placeholderTextColor={C.textSecondary}
              value={noteInput}
              onChangeText={setNoteInput}
            />

            <TouchableOpacity
              style={{ opacity: posting ? 0.7 : 1, borderRadius: radius.md, overflow: 'hidden' }}
              onPress={handlePost}
              disabled={posting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF4B6E', '#FF7A93']}
                style={styles.postBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.postBtnText}>
                  {posting ? 'Getting location…' : 'Get my location & Post'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.cancelBtn}
            >
              <Text style={[typography.body, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerSide: { width: 40, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.heading,
  },
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  radiusPill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
    flexGrow: 1,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    fontWeight: '700',
  },
  timePill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  venueName: { marginBottom: spacing.xs },
  noteText: { fontStyle: 'italic', marginBottom: spacing.xs },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  joinBtn: {
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  distanceBadge: { textAlign: 'right', marginTop: spacing.xs },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    borderRadius: 29,
    ...shadows.md,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.heading,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  postBtnGrad: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  postBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
