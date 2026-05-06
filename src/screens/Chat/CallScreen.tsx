import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useAuthStore } from '../../store/authStore';
import { initiateCall, fetchVoiceToken } from '../../services/voiceService';
import { DiscoverStackParamList } from '../../types';
import Avatar from '../../components/Avatar';
import { spacing, typography, radius } from '../../utils/theme';

type RouteProps = RouteProp<DiscoverStackParamList, 'Call'>;

type CallStatus = 'connecting' | 'ringing' | 'active' | 'ended' | 'error';

export default function CallScreen() {
  const navigation   = useNavigation();
  const route        = useRoute<RouteProps>();
  const { userProfile } = useAuthStore();

  const { connectionId, remoteUser, callType, isOutgoing, roomName: incomingRoomName, roomUrl: incomingRoomUrl } =
    route.params;

  const [status, setStatus]     = useState<CallStatus>('connecting');
  const [roomUrl, setRoomUrl]   = useState<string | null>(incomingRoomUrl ?? null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed]   = useState(0);
  const [isMuted, setIsMuted]   = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [showWebView, setShowWebView] = useState(false);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  // Pulse animation for ringing state
  useEffect(() => {
    if (status === 'ringing' || status === 'connecting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status]);

  // Start elapsed timer when call becomes active
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Initiate or join call on mount
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (isOutgoing) {
          const roomName = `drift-${[connectionId].join('-')}-${Date.now()}`;
          setStatus('ringing');
          const result = await initiateCall({
            roomName,
            callType,
            toUid:          remoteUser.uid,
            callerName:     userProfile?.name ?? 'Someone',
            callerPhotoURL: userProfile?.photoURL,
          });
          if (!cancelled) {
            setRoomUrl(result.roomUrl);
            setStatus('active');
            setShowWebView(true);
          }
        } else {
          // Incoming call — roomUrl already provided via push notification
          if (incomingRoomName && !roomUrl) {
            const result = await fetchVoiceToken(incomingRoomName, callType);
            if (!cancelled) {
              setRoomUrl(result.roomUrl);
            }
          }
          setStatus('active');
          setShowWebView(true);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to connect');
          setStatus('error');
        }
      }
    }

    start();
    return () => { cancelled = true; };
  }, []);

  const handleEndCall = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('ended');
    setShowWebView(false);
    setTimeout(() => navigation.goBack(), 600);
  }, [navigation]);

  function formatElapsed(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const statusLabel: Record<CallStatus, string> = {
    connecting: 'Connecting…',
    ringing:    'Ringing…',
    active:     formatElapsed(elapsed),
    ended:      'Call ended',
    error:      errorMsg || 'Connection failed',
  };

  // Build the Daily.co room URL with prebuilt UI params
  const dailyUrl = roomUrl
    ? `${roomUrl}?embed&startVideoOff=${callType === 'audio' ? 'true' : 'false'}&startAudioOff=false&noNav=true`
    : null;

  return (
    <View style={styles.root}>
      {/* Background gradient */}
      <LinearGradient
        colors={
          callType === 'video'
            ? ['#1a1a2e', '#16213e', '#0f3460']
            : ['#0D0D1A', '#1a0a2e', '#2d1b4e']
        }
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.callTypeLabel}>
            {callType === 'video' ? '📹 Video call' : '📞 Voice call'}
          </Text>
          {isOutgoing && status === 'ringing' && (
            <Text style={styles.outgoingLabel}>Outgoing</Text>
          )}
          {!isOutgoing && (
            <Text style={styles.outgoingLabel}>Incoming</Text>
          )}
        </View>

        {/* Remote user info */}
        <View style={styles.remoteInfo}>
          <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatarInner}>
              <Avatar name={remoteUser.name} photoURL={remoteUser.photoURL} size={96} />
            </View>
          </Animated.View>
          <Text style={styles.remoteName}>{remoteUser.name}</Text>
          {remoteUser.city ? (
            <Text style={styles.remoteCity}>{remoteUser.city}</Text>
          ) : null}
          <Text style={[
            styles.statusText,
            status === 'error' && { color: '#FF4B6E' },
            status === 'active' && { color: '#10B981', fontVariant: ['tabular-nums'] },
          ]}>
            {statusLabel[status]}
          </Text>
        </View>

        {/* WebView for Daily.co (active call) */}
        {showWebView && dailyUrl && (
          <View style={styles.webviewContainer}>
            <WebView
              source={{ uri: dailyUrl }}
              style={styles.webview}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              onError={() => {
                setErrorMsg('Could not load call interface');
                setStatus('error');
                setShowWebView(false);
              }}
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator color="#FF4B6E" size="large" />
                  <Text style={styles.webviewLoadingText}>Setting up call…</Text>
                </View>
              )}
              startInLoadingState
            />
          </View>
        )}

        {/* Loading state */}
        {(status === 'connecting' || status === 'ringing') && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
            <Text style={styles.loadingText}>{statusLabel[status]}</Text>
          </View>
        )}

        {/* Error state */}
        {status === 'error' && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={20} color="#FF4B6E" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryBtnText}>Go back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          {/* Mute */}
          <View style={styles.controlGroup}>
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
              onPress={() => setIsMuted((m) => !m)}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={22}
                color={isMuted ? '#FF4B6E' : '#fff'}
              />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </View>

          {/* End call */}
          <View style={styles.controlGroup}>
            <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
              <LinearGradient
                colors={['#FF4B6E', '#D93056']}
                style={styles.endCallGradient}
              >
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.controlLabel}>End</Text>
          </View>

          {/* Speaker / Video toggle */}
          {callType === 'video' ? (
            <View style={styles.controlGroup}>
              <TouchableOpacity
                style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
                onPress={() => setIsVideoOff((v) => !v)}
              >
                <Ionicons
                  name={isVideoOff ? 'videocam-off' : 'videocam'}
                  size={22}
                  color={isVideoOff ? '#FF4B6E' : '#fff'}
                />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>{isVideoOff ? 'Show cam' : 'Hide cam'}</Text>
            </View>
          ) : (
            <View style={styles.controlGroup}>
              <TouchableOpacity style={styles.controlBtn}>
                <Ionicons name="volume-high" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>Speaker</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  header: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  callTypeLabel: {
    ...typography.label,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  outgoingLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.4)',
  },

  remoteInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  remoteName: {
    ...typography.h1,
    color: '#fff',
    textAlign: 'center',
  },
  remoteCity: {
    ...typography.body,
    color: 'rgba(255,255,255,0.5)',
  },
  statusText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
    fontWeight: '500',
  },

  webviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    opacity: 1, // Daily.co WebView fully visible
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webviewLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  webviewLoadingText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.5)',
  },

  errorBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: '#FF4B6E',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  retryBtnText: {
    ...typography.label,
    color: '#fff',
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  controlGroup: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,75,110,0.2)',
  },
  controlLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  endCallGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
