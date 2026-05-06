import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { IncomingCallPayload } from '../types';
import Avatar from './Avatar';
import { radius, spacing, typography } from '../utils/theme';

export default function IncomingCallBanner() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const slideY     = useRef(new Animated.Value(-140)).current;
  const [call, setCall] = useState<IncomingCallPayload | null>(null);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      if (data?.type !== 'incoming_call') return;

      const payload: IncomingCallPayload = {
        type:           'incoming_call',
        callType:       (data.callType as 'audio' | 'video') ?? 'audio',
        roomName:       (data.roomName as string) ?? '',
        roomUrl:        (data.roomUrl  as string) ?? '',
        callerUid:      (data.callerUid as string) ?? '',
        callerName:     (data.callerName as string) ?? 'Someone',
        callerPhotoURL: (data.callerPhotoURL as string) ?? '',
      };
      setCall(payload);
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      // Auto-dismiss after 30 seconds
      const timer = setTimeout(() => dismiss(), 30_000);
      return () => clearTimeout(timer);
    });
    return () => sub.remove();
  }, []);

  function dismiss() {
    Animated.timing(slideY, {
      toValue: -140,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setCall(null));
  }

  function accept() {
    if (!call) return;
    dismiss();
    setTimeout(() => {
      (navigation as any).navigate('Discover', {
        screen: 'Call',
        params: {
          connectionId: call.roomName,
          remoteUser: {
            uid:      call.callerUid,
            name:     call.callerName,
            photoURL: call.callerPhotoURL || undefined,
            age:      0,
            bio:      '',
            interests: [],
            lookingFor: [],
            coins:    0,
            streak:   { current: 0, longest: 0, lastLoginDate: '' },
            profileCompleteness: 0,
            isVerified: false,
            isBanned:   false,
            createdAt:  0,
          },
          callType:   call.callType,
          isOutgoing: false,
          roomName:   call.roomName,
          roomUrl:    call.roomUrl,
        },
      });
    }, 50);
  }

  if (!call) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, transform: [{ translateY: slideY }] },
      ]}
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Caller info */}
        <View style={styles.callerRow}>
          <Avatar
            name={call.callerName}
            photoURL={call.callerPhotoURL || undefined}
            size={44}
          />
          <View style={styles.callerInfo}>
            <Text style={styles.callerLabel}>
              {call.callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
            </Text>
            <Text style={styles.callerName}>{call.callerName}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={dismiss}>
            <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={accept} style={styles.acceptBtnWrapper}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.acceptBtn}
            >
              <Ionicons name="call" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  gradient: {
    padding: spacing.md,
    gap: spacing.md,
  },
  callerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  callerInfo: {
    flex: 1,
  },
  callerLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  callerName: {
    ...typography.h3,
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  declineBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  acceptBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
