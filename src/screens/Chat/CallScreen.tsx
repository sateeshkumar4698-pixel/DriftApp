/**
 * CallScreen — audio / video calls via Jitsi Meet WebView.
 *
 * NO backend required. Call signaling uses a Firestore `calls` doc.
 * The Cloud Function `onCallCreated` sends push to the callee.
 * Both parties open the same Jitsi room URL.
 *
 * Flow:
 *   Outgoing: caller writes calls/{callId} → CF pushes callee → caller shows Jitsi
 *   Incoming: push tap passes roomName → callee opens same Jitsi room
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
// ─── Lazy-load react-native-webview so older binaries don't crash ─────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeWebView: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NativeWebView = require('react-native-webview').WebView;
} catch { /* Native module not compiled into this binary */ }
import { useAuthStore } from '../../store/authStore';
import {
  createCall,
  updateCallStatus,
  subscribeToCall,
} from '../../utils/firestore-helpers';
import { DiscoverStackParamList } from '../../types';
import Avatar from '../../components/Avatar';
import { spacing, typography, radius } from '../../utils/theme';

type RouteProps = RouteProp<DiscoverStackParamList, 'Call'>;

// Jitsi domain — free, no API key, no backend
const JITSI = 'https://meet.jit.si';

function jitsiUrl(roomName: string, callType: 'audio' | 'video'): string {
  const params = [
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    'config.startWithAudioMuted=false',
    callType === 'audio' ? 'config.startWithVideoMuted=true' : '',
    callType === 'audio' ? 'config.disableVideo=true' : '',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.SHOW_BRAND_WATERMARK=false',
    'interfaceConfig.SHOW_POWERED_BY=false',
    'interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","hangup"]',
  ].filter(Boolean).join('&');
  return `${JITSI}/${encodeURIComponent(roomName)}#${params}`;
}

type Status = 'connecting' | 'active' | 'ended';

export default function CallScreen() {
  const navigation = useNavigation();
  const route      = useRoute<RouteProps>();
  const { firebaseUser, userProfile } = useAuthStore();

  const {
    connectionId,
    remoteUser,
    callType,
    isOutgoing,
    roomName: incomingRoomName,
  } = route.params;

  const [status, setStatus]     = useState<Status>('connecting');
  const [roomName, setRoomName] = useState<string | null>(incomingRoomName ?? null);
  const [callId, setCallId]     = useState<string | null>(null);
  const [elapsed, setElapsed]   = useState(0);
  const [webviewReady, setWebviewReady] = useState(false);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const callUnsub = useRef<(() => void) | null>(null);

  // Pulse animation while connecting
  useEffect(() => {
    if (status === 'connecting') {
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

  // Elapsed timer
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Initiate or join on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (isOutgoing) {
        // Outgoing: generate room, write Firestore doc → CF sends push to callee
        const room = `drift-${connectionId}-${Date.now()}`;
        if (!cancelled) setRoomName(room);

        if (firebaseUser && userProfile) {
          try {
            const id = await createCall({
              callerUid:      firebaseUser.uid,
              calleeUid:      remoteUser.uid,
              callerName:     userProfile.name,
              callerPhotoURL: userProfile.photoURL,
              callType,
              roomName:       room,
            });
            if (!cancelled) {
              setCallId(id);
              // Watch for callee to decline
              callUnsub.current = subscribeToCall(id, (call) => {
                if (call?.status === 'declined') handleEndCall(id);
                if (call?.status === 'active') setStatus('active');
              });
            }
          } catch (err) {
            console.warn('[CallScreen] createCall failed:', err);
          }
        }
        if (!cancelled) setStatus('active'); // Show Jitsi immediately
      } else {
        // Incoming: roomName already provided via push notification param
        // Update call status to active if callId is available
        if (!cancelled) setStatus('active');
      }
    }

    init();
    return () => {
      cancelled = true;
      callUnsub.current?.();
    };
  }, []);

  const handleEndCall = useCallback(async (cId?: string | null) => {
    if (timerRef.current) clearInterval(timerRef.current);
    callUnsub.current?.();
    setStatus('ended');
    const id = cId ?? callId;
    if (id) await updateCallStatus(id, 'ended').catch(() => {});
    setTimeout(() => navigation.goBack(), 500);
  }, [callId, navigation]);

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  const jUrl = roomName ? jitsiUrl(roomName, callType) : null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={callType === 'video' ? ['#1a1a2e','#16213e','#0f3460'] : ['#0D0D1A','#1a0a2e','#2d1b4e']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.flex} edges={['top','bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.callTypeLabel}>
            {callType === 'video' ? '📹 Video call' : '📞 Voice call'}
          </Text>
          <Text style={styles.dirLabel}>{isOutgoing ? 'Outgoing' : 'Incoming'}</Text>
        </View>

        {/* ── Remote user avatar + status (shown while Jitsi loads) ── */}
        {(!webviewReady || status !== 'active') && (
          <View style={styles.remoteInfo}>
            <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.avatarInner}>
                <Avatar name={remoteUser.name} photoURL={remoteUser.photoURL} size={96} />
              </View>
            </Animated.View>
            <Text style={styles.remoteName}>{remoteUser.name}</Text>
            {remoteUser.city ? <Text style={styles.remoteCity}>{remoteUser.city}</Text> : null}
            <Text style={styles.statusText}>
              {status === 'connecting' ? 'Connecting…' :
               status === 'active'    ? (webviewReady ? formatElapsed(elapsed) : 'Setting up call…') :
                                        'Call ended'}
            </Text>
            {status === 'connecting' && (
              <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" style={{ marginTop: 8 }} />
            )}
          </View>
        )}

        {/* ── Jitsi WebView ── */}
        {jUrl && status === 'active' && (
          <View style={[styles.webviewWrap, webviewReady && styles.webviewVisible]}>
            {NativeWebView ? (
              <NativeWebView
                source={{ uri: jUrl }}
                style={styles.webview}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                allowsFullscreenVideo
                onLoad={() => { setWebviewReady(true); setStatus('active'); }}
                onError={() => handleEndCall()}
                renderLoading={() => (
                  <View style={styles.webviewLoading}>
                    <ActivityIndicator color="#FF4B6E" size="large" />
                    <Text style={styles.webviewLoadingText}>Connecting to call…</Text>
                  </View>
                )}
                startInLoadingState
              />
            ) : (
              <View style={[styles.webviewLoading, { flex: 1 }]}>
                <Text style={styles.webviewLoadingText}>
                  Calls require a development build.{'\n'}Run: npx expo run:ios
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── End call button (always visible) ── */}
        <View style={styles.endRow}>
          <TouchableOpacity style={styles.endBtn} onPress={() => handleEndCall()}>
            <LinearGradient colors={['#FF4B6E','#D93056']} style={styles.endGrad}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.endLabel}>End</Text>
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
  dirLabel: {
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
    width: 116, height: 116, borderRadius: 58,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarInner: {
    width: 104, height: 104, borderRadius: 52, overflow: 'hidden',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)',
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
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
    fontWeight: '500',
  },

  webviewWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 100,
    opacity: 0,           // invisible until loaded
  },
  webviewVisible: {
    opacity: 1,           // show once WebView fires onLoad
  },
  webview: { flex: 1 },
  webviewLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    backgroundColor: '#0D0D1A',
  },
  webviewLoadingText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
  },

  endRow: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  endBtn: {
    borderRadius: 40,
    ...({
      shadowColor: '#FF4B6E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 8,
    } as any),
  },
  endGrad: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  endLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
});
