import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';

import { useAuthStore } from '../store/authStore';
import {
  subscribeToIncomingInvites,
  respondToGameInvite,
  joinGameRoom,
} from '../utils/firestore-helpers';
import Avatar from './Avatar';
import { useTheme, AppColors, spacing, typography, radius, shadows } from '../utils/useTheme';
import { GameInvite, GameRoomPlayer } from '../types';

const GAME_DISPLAY: Record<string, { name: string; emoji: string }> = {
  ludo:         { name: 'Ludo',          emoji: '🎲' },
  'truth-dare': { name: 'Truth or Dare', emoji: '🎯' },
};

const AUTO_HIDE_MS = 15_000;

/**
 * Root-mounted bottom toast that listens for incoming game invites and lets
 * the user accept/decline without leaving their current screen.
 */
export default function GameInviteBanner() {
  const { firebaseUser, userProfile } = useAuthStore();
  // We use a loose NavigationProp so this can be mounted anywhere inside the
  // nav tree — actual navigation happens by name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<NavigationProp<any>>();

  const { C } = useTheme();

  const [current, setCurrent] = useState<GameInvite | null>(null);
  const [acting, setActing] = useState(false);
  const dismissedIds = useRef<Set<string>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideY = useRef(new Animated.Value(120)).current;

  // Subscribe to incoming invites
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeToIncomingInvites(firebaseUser.uid, (invites) => {
      const fresh = invites.find((i) => !dismissedIds.current.has(i.id));
      if (fresh && (!current || current.id !== fresh.id)) {
        setCurrent(fresh);
      } else if (!fresh && current && !invites.some((i) => i.id === current.id)) {
        // The current invite expired or was responded to elsewhere
        setCurrent(null);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid]);

  // Slide in / auto-hide
  useEffect(() => {
    if (current) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        dismiss();
      }, AUTO_HIDE_MS);
    } else {
      Animated.timing(slideY, {
        toValue: 120,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function dismiss() {
    if (current) dismissedIds.current.add(current.id);
    setCurrent(null);
  }

  async function handleAccept() {
    if (!current || !firebaseUser || !userProfile || acting) return;
    setActing(true);
    try {
      await respondToGameInvite(current.id, 'accepted');
      const selfPlayer: GameRoomPlayer = {
        uid:      firebaseUser.uid,
        name:     userProfile.name,
        photoURL: userProfile.photoURL,
        ready:    false,
        isHost:   false,
        joinedAt: Date.now(),
      };
      await joinGameRoom(current.roomId, selfPlayer);

      // Navigate into the Play tab → GameLobby
      const inviteRoomId = current.roomId;
      const inviteGameId = current.gameId;
      dismiss();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation as any).navigate('Play', {
        screen: 'GameLobby',
        params: { roomId: inviteRoomId, gameId: inviteGameId },
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Could not join', 'The room may no longer be available.');
    } finally {
      setActing(false);
    }
  }

  async function handleDecline() {
    if (!current || acting) return;
    setActing(true);
    try {
      await respondToGameInvite(current.id, 'declined');
    } catch {
      // non-fatal
    } finally {
      setActing(false);
      dismiss();
    }
  }

  if (!current) return null;

  const display = GAME_DISPLAY[current.gameId] ?? { name: current.gameId, emoji: '🎮' };
  const styles = makeStyles(C);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY: slideY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <Avatar name={current.fromName} photoURL={current.fromPhoto} size={44} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {display.emoji} {current.fromName}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            invited you to play {display.name}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={handleDecline}
          disabled={acting}
        >
          <Text style={styles.declineText}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={handleAccept}
          disabled={acting}
        >
          <Text style={styles.acceptText}>Join</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl + 60, // above tab bar
      zIndex: 1000,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: C.background,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: C.border,
      ...shadows.modal,
    },
    info: { flex: 1 },
    title: { ...typography.body, fontWeight: '700', color: C.text },
    sub:   { ...typography.small, color: C.textSecondary, marginTop: 2 },
    declineBtn: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
    },
    declineText: { ...typography.small, color: C.textSecondary, fontWeight: '600' },
    acceptBtn: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: C.primary,
    },
    acceptText: { ...typography.small, color: '#fff', fontWeight: '700' },
  });
}
