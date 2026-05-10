import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  addDoc,
} from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useTheme, spacing, typography, radius, shadows } from '../../utils/useTheme';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

type VibeRoomCategory =
  | 'all'
  | 'chill'
  | 'music'
  | 'gaming'
  | 'study'
  | 'rant'
  | 'advice'
  | 'random';

interface VibeRoom {
  id: string;
  hostUid: string;
  hostName: string;
  hostPhotoURL?: string;
  title: string;
  category: Exclude<VibeRoomCategory, 'all'>;
  emoji: string;
  speakerUids: string[];
  listenerUids: string[];
  maxSpeakers: number;
  isLive: boolean;
  dailyRoomUrl?: string;
  createdAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  Exclude<VibeRoomCategory, 'all'>,
  { label: string; emoji: string }
> = {
  chill:  { label: 'Chill',  emoji: '🌙' },
  music:  { label: 'Music',  emoji: '🎵' },
  gaming: { label: 'Gaming', emoji: '🎮' },
  study:  { label: 'Study',  emoji: '📚' },
  rant:   { label: 'Rant',   emoji: '😤' },
  advice: { label: 'Advice', emoji: '💡' },
  random: { label: 'Random', emoji: '✨' },
};

const ALL_CATEGORIES: VibeRoomCategory[] = [
  'all',
  'chill',
  'music',
  'gaming',
  'study',
  'rant',
  'advice',
  'random',
];

function chipLabel(cat: VibeRoomCategory): string {
  if (cat === 'all') return '🌐 All';
  const meta = CATEGORY_META[cat];
  return `${meta.emoji} ${meta.label}`;
}

// ─── Room card ────────────────────────────────────────────────────────────────

interface RoomCardProps {
  room: VibeRoom;
  currentUid: string;
  onJoinListener: () => void;
  onJoinSpeaker: () => void;
}

function RoomCard({ room, currentUid, onJoinListener, onJoinSpeaker }: RoomCardProps) {
  const { C } = useTheme();
  const canSpeak = room.speakerUids.length < room.maxSpeakers;

  // First 4 speaker UIDs for avatar row — we show avatars using names from speakerUids
  const previewSpeakers = room.speakerUids.slice(0, 4);
  const extraSpeakers = Math.max(0, room.speakerUids.length - 4);

  return (
    <View
      style={[
        styles.roomCard,
        { backgroundColor: C.surface, borderColor: C.border, ...shadows.card },
      ]}
    >
      {/* Top row: emoji + title + LIVE */}
      <View style={styles.roomTopRow}>
        <Text style={styles.roomEmoji}>{room.emoji}</Text>
        <Text style={[styles.roomTitle, { color: C.text }]} numberOfLines={2}>
          {room.title}
        </Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Speaker / listener counts */}
      <View style={styles.roomCountRow}>
        <Text style={[typography.small, { color: C.textSecondary }]}>
          🎙️ {room.speakerUids.length} speakers
        </Text>
        <Text style={[typography.small, { color: C.textSecondary, marginLeft: spacing.md }]}>
          👂 {room.listenerUids.length} listening
        </Text>
      </View>

      {/* Speaker avatars */}
      {previewSpeakers.length > 0 && (
        <View style={styles.avatarRow}>
          {previewSpeakers.map((uid, i) => (
            <View key={uid} style={[styles.avatarOverlap, { left: i * 22 }]}>
              <Avatar name={uid} size={30} />
            </View>
          ))}
          {extraSpeakers > 0 && (
            <View
              style={[
                styles.avatarOverlap,
                styles.extraBadge,
                { left: previewSpeakers.length * 22, backgroundColor: C.border },
              ]}
            >
              <Text style={[typography.small, { color: C.textSecondary }]}>
                +{extraSpeakers}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={[styles.roomActions, { marginTop: previewSpeakers.length > 0 ? 36 : spacing.md }]}>
        <TouchableOpacity
          onPress={onJoinListener}
          style={[styles.roomBtn, styles.roomBtnOutlined, { borderColor: C.primary }]}
          activeOpacity={0.7}
        >
          <Text style={[typography.small, { color: C.primary, fontWeight: '600' }]}>
            👂 Join as listener
          </Text>
        </TouchableOpacity>
        {canSpeak && (
          <TouchableOpacity
            onPress={onJoinSpeaker}
            style={[styles.roomBtn, { backgroundColor: C.primary }]}
            activeOpacity={0.7}
          >
            <Text style={[typography.small, { color: '#fff', fontWeight: '600' }]}>
              🎤 Speak
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VibeRoomsScreen() {
  const { C } = useTheme();
  const navigation = useNavigation<any>();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const userProfile = useAuthStore((s) => s.userProfile);

  const [rooms, setRooms] = useState<VibeRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<VibeRoomCategory>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [selectedNewCategory, setSelectedNewCategory] =
    useState<Exclude<VibeRoomCategory, 'all'>>('chill');
  const [creating, setCreating] = useState(false);

  // Subscribe to live rooms
  useEffect(() => {
    const q = query(
      collection(db, 'vibeRooms'),
      where('isLive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VibeRoom));
      setRooms(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredRooms =
    selectedCategory === 'all'
      ? rooms
      : rooms.filter((r) => r.category === selectedCategory);

  async function handleGoLive() {
    if (!roomTitle.trim()) return;
    if (!firebaseUser || !userProfile) return;

    setCreating(true);
    try {
      const meta = CATEGORY_META[selectedNewCategory];
      const ref = await addDoc(collection(db, 'vibeRooms'), {
        hostUid: firebaseUser.uid,
        hostName: userProfile.name,
        hostPhotoURL: userProfile.photoURL ?? null,
        title: roomTitle.trim(),
        category: selectedNewCategory,
        emoji: meta.emoji,
        speakerUids: [firebaseUser.uid],
        listenerUids: [],
        maxSpeakers: 4,
        isLive: true,
        createdAt: Date.now(),
      });
      setRoomTitle('');
      setModalVisible(false);
      navigation.navigate('VibeRoom', { roomId: ref.id, role: 'host' });
    } catch (err) {
      console.warn('[VibeRooms] create error:', err);
    } finally {
      setCreating(false);
    }
  }

  function navigateToRoom(roomId: string, role: 'listener' | 'speaker') {
    navigation.navigate('VibeRoom', { roomId, role });
  }

  const currentUid = firebaseUser?.uid ?? '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: C.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>🎙️ Vibe Rooms</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.headerSide}
        >
          <Text style={[typography.body, { color: C.primary, fontWeight: '700' }]}>Start</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
      >
        {ALL_CATEGORIES.map((cat) => {
          const selected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: C.primary, borderColor: C.primary }
                  : { backgroundColor: 'transparent', borderColor: C.border },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  typography.small,
                  { color: selected ? '#fff' : C.textSecondary, fontWeight: '600' },
                ]}
              >
                {chipLabel(cat)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Room list */}
      <FlatList
        data={filteredRooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <RoomCard
            room={item}
            currentUid={currentUid}
            onJoinListener={() => navigateToRoom(item.id, 'listener')}
            onJoinSpeaker={() => navigateToRoom(item.id, 'speaker')}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              emoji="🎙️"
              title="No rooms live right now"
              subtitle="Start a room and vibe with people"
            />
          )
        }
      />

      {/* Start Room modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface, ...shadows.modal }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>🎙️ Start a Room</Text>

            <TextInput
              style={[
                styles.input,
                { backgroundColor: C.background, borderColor: C.border, color: C.text },
              ]}
              placeholder='Room title e.g. "Late night chill 🌙"'
              placeholderTextColor={C.textSecondary}
              value={roomTitle}
              onChangeText={setRoomTitle}
            />

            {/* Category picker */}
            <Text style={[typography.caption, { color: C.textSecondary }]}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPicker}
            >
              {(Object.keys(CATEGORY_META) as Exclude<VibeRoomCategory, 'all'>[]).map((cat) => {
                const meta = CATEGORY_META[cat];
                const picked = selectedNewCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedNewCategory(cat)}
                    style={[
                      styles.categoryChip,
                      picked
                        ? { backgroundColor: C.primary, borderColor: C.primary }
                        : { backgroundColor: 'transparent', borderColor: C.border },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                    <Text
                      style={[
                        typography.small,
                        { color: picked ? '#fff' : C.textSecondary, fontWeight: '600' },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={{ opacity: creating ? 0.7 : 1, borderRadius: radius.md, overflow: 'hidden' }}
              onPress={handleGoLive}
              disabled={creating}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF4B6E', '#FF7A93']}
                style={styles.goLiveGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.goLiveText}>
                  {creating ? 'Creating…' : 'Go Live'}
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
        </View>
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
  headerSide: { width: 56, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.heading,
  },
  chipList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  roomCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  roomTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  roomEmoji: { fontSize: 32, lineHeight: 38 },
  roomTitle: {
    flex: 1,
    ...typography.heading,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: '#EF444422',
    borderRadius: radius.full,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  roomCountRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    height: 34,
    position: 'relative',
    marginBottom: spacing.xs,
  },
  avatarOverlap: {
    position: 'absolute',
    top: 0,
  },
  extraBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  roomBtn: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roomBtnOutlined: {
    borderWidth: 1.5,
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
  categoryPicker: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  goLiveGrad: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  goLiveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
