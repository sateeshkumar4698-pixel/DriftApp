import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  arrayRemove,
  arrayUnion,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useTheme, spacing, typography, radius } from '../../utils/useTheme';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../../components/Avatar';

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

// Route params
type RouteParams = {
  VibeRoom: {
    roomId: string;
    role: 'host' | 'speaker' | 'listener';
  };
};

// ─── Floating heart animation ─────────────────────────────────────────────────

function FloatingHeart({ anim }: { anim: Animated.Value }) {
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -120],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0.8, 0],
  });
  const scale = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.5, 1.2, 0.8],
  });

  return (
    <Animated.View
      style={[
        styles.floatingHeart,
        { transform: [{ translateY }, { scale }], opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={{ fontSize: 28 }}>💕</Text>
    </Animated.View>
  );
}

// ─── Speaker card ─────────────────────────────────────────────────────────────

interface SpeakerCardProps {
  uid: string;
  isMuted?: boolean;
  hostUid: string;
}

function SpeakerCard({ uid, isMuted, hostUid }: SpeakerCardProps) {
  const isHost = uid === hostUid;
  const label = isHost ? '👑 Host' : uid.slice(0, 8);

  // Animated pulsing ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.speakerCard}>
      <View style={styles.speakerAvatarWrapper}>
        {/* Pulsing ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Avatar name={label} size={72} />
        {isMuted && (
          <View style={styles.muteOverlay}>
            <Text style={{ fontSize: 12 }}>🔇</Text>
          </View>
        )}
      </View>
      <Text style={styles.speakerName} numberOfLines={1}>
        {isHost ? '👑 Host' : `${uid.slice(0, 6)}…`}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VibeRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'VibeRoom'>>();
  const { roomId, role } = route.params;

  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const userProfile = useAuthStore((s) => s.userProfile);

  const [room, setRoom] = useState<VibeRoom | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const heartAnim = useRef(new Animated.Value(0)).current;

  const uid = firebaseUser?.uid ?? '';
  const roomRef = doc(db, 'vibeRooms', roomId);

  // Subscribe to room snapshot
  useEffect(() => {
    const unsub = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        setRoom({ id: snap.id, ...snap.data() } as VibeRoom);
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Join on mount
  useEffect(() => {
    if (!uid) return;
    if (role === 'speaker' || role === 'host') {
      updateDoc(roomRef, { speakerUids: arrayUnion(uid) }).catch(console.warn);
    } else {
      updateDoc(roomRef, { listenerUids: arrayUnion(uid) }).catch(console.warn);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, role]);

  async function handleLeave() {
    if (!uid) {
      navigation.goBack();
      return;
    }
    try {
      const updates: Record<string, unknown> = {
        speakerUids: arrayRemove(uid),
        listenerUids: arrayRemove(uid),
      };
      if (role === 'host') {
        updates.isLive = false;
      }
      await updateDoc(roomRef, updates);
    } catch (err) {
      console.warn('[VibeRoom] leave error:', err);
    }
    navigation.goBack();
  }

  function handleReact() {
    heartAnim.setValue(0);
    setHeartVisible(true);
    Animated.timing(heartAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => setHeartVisible(false));
  }

  if (!room) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: ROOM_BG }]}>
        <Text style={{ color: '#fff', ...typography.body }}>Loading room…</Text>
      </View>
    );
  }

  const minutesAgo = Math.floor((Date.now() - room.createdAt) / 60000);
  const isSpeakerOrHost = role === 'host' || role === 'speaker';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: ROOM_BG }]}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.headerSide} activeOpacity={0.7}>
          <Text style={styles.leaveText}>← Leave</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {room.title}
        </Text>
        <View style={[styles.headerSide, styles.livePill]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Speaker grid */}
      <View style={styles.speakerGrid}>
        {room.speakerUids.length === 0 ? (
          <Text style={styles.emptyRoomText}>No speakers yet</Text>
        ) : (
          <View style={styles.speakerRow}>
            {room.speakerUids.map((speakerUid) => (
              <SpeakerCard
                key={speakerUid}
                uid={speakerUid}
                isMuted={isMuted && speakerUid === uid}
                hostUid={room.hostUid}
              />
            ))}
          </View>
        )}
      </View>

      {/* Listeners section */}
      <View style={styles.listenersSection}>
        <Text style={styles.listenersLabel}>
          👂 Listening ({room.listenerUids.length})
        </Text>
        {room.listenerUids.length > 0 && (
          <View style={styles.listenerAvatarRow}>
            {room.listenerUids.slice(0, 10).map((lUid, i) => (
              <View key={lUid} style={[styles.listenerAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                <Avatar name={lUid.slice(0, 6)} size={30} />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Room info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoEmoji}>{room.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>{room.title}</Text>
          <Text style={styles.infoMeta}>
            {room.category} · Started {minutesAgo < 1 ? 'just now' : `${minutesAgo} min ago`}
          </Text>
        </View>
      </View>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {isSpeakerOrHost ? (
          <>
            {/* Mute toggle */}
            <TouchableOpacity
              onPress={() => setIsMuted((m) => !m)}
              style={[
                styles.circleBtn,
                { backgroundColor: isMuted ? '#EF444433' : '#ffffff22' },
              ]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 26 }}>{isMuted ? '🔇' : '🎤'}</Text>
            </TouchableOpacity>

            {/* React */}
            <TouchableOpacity
              onPress={handleReact}
              style={[styles.circleBtn, { backgroundColor: '#ffffff22' }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 26 }}>❤️</Text>
            </TouchableOpacity>

            {/* Leave */}
            <TouchableOpacity
              onPress={handleLeave}
              style={[styles.leaveBtn]}
              activeOpacity={0.7}
            >
              <Text style={styles.leaveBtnText}>🚪 Leave</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Request to speak */}
            <TouchableOpacity
              style={[styles.requestSpeakBtn]}
              activeOpacity={0.7}
            >
              <Text style={styles.requestSpeakText}>🙋 Request to Speak</Text>
            </TouchableOpacity>

            {/* React */}
            <TouchableOpacity
              onPress={handleReact}
              style={[styles.circleBtn, { backgroundColor: '#ffffff22' }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 26 }}>❤️</Text>
            </TouchableOpacity>

            {/* Leave */}
            <TouchableOpacity
              onPress={handleLeave}
              style={styles.leaveBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.leaveBtnText}>🚪 Leave</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Floating heart */}
      {heartVisible && <FloatingHeart anim={heartAnim} />}
    </SafeAreaView>
  );
}

// ─── Constants & styles ───────────────────────────────────────────────────────

const ROOM_BG = '#0D0D1A';
const DARK_SURFACE = '#15152A';
const WHITE = '#FFFFFF';
const WHITE_70 = 'rgba(255,255,255,0.7)';
const WHITE_22 = 'rgba(255,255,255,0.13)';
const BORDER_DARK = 'rgba(255,255,255,0.13)';

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerSide: { width: 72, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.body,
    fontWeight: '700',
    color: WHITE,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  leaveText: {
    color: '#EF4444',
    ...typography.body,
    fontWeight: '600',
  },
  speakerGrid: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  speakerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  speakerCard: {
    alignItems: 'center',
    width: 120,
  },
  speakerAvatarWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: '#FF4B6E66',
  },
  muteOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: DARK_SURFACE,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerName: {
    color: WHITE,
    ...typography.small,
    textAlign: 'center',
    maxWidth: 110,
  },
  emptyRoomText: {
    color: WHITE_70,
    textAlign: 'center',
    ...typography.body,
  },
  listenersSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  listenersLabel: {
    color: WHITE_70,
    ...typography.small,
    fontWeight: '600',
  },
  listenerAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listenerAvatar: {},
  infoCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: DARK_SURFACE,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoEmoji: { fontSize: 28 },
  infoTitle: {
    color: WHITE,
    ...typography.body,
    fontWeight: '700',
  },
  infoMeta: {
    color: WHITE_70,
    ...typography.small,
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: BORDER_DARK,
    gap: spacing.md,
  },
  circleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  leaveBtnText: {
    color: '#EF4444',
    ...typography.small,
    fontWeight: '700',
  },
  requestSpeakBtn: {
    borderWidth: 1.5,
    borderColor: WHITE,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  requestSpeakText: {
    color: WHITE,
    ...typography.small,
    fontWeight: '600',
  },
  floatingHeart: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
});
