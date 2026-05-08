/**
 * InGameVoice — tap-to-talk mic button for in-game group voice.
 *
 * No calling screen, no modal, no backend required.
 * All players in the same roomId auto-join the same Jitsi voice room.
 *
 * Architecture:
 *   - Jitsi Meet runs in a hidden off-screen WebView (audio-only)
 *   - A compact mic button lives inline in the game UI
 *   - postMessage bridge detects join; injectJavaScript controls mute
 *   - Automatic retry (3×) if WebView loses connection
 *   - Falls back to an error state with retry if WebRTC is unavailable
 *
 * Usage: <InGameVoice roomId={roomId} myName={playerName} />
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Lazy-load WebView so Expo Go doesn't crash (native module missing there)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeWebView: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NativeWebView = require('react-native-webview').WebView;
} catch { /* no-op */ }

// ─── Types ────────────────────────────────────────────────────────────────────

type VoicePhase = 'idle' | 'joining' | 'live' | 'muted' | 'error';

interface Props {
  roomId: string;
  myName: string;
}

// ─── Jitsi URL builder ────────────────────────────────────────────────────────

function buildJitsiUrl(room: string, displayName: string): string {
  const cfg = [
    'config.prejoinPageEnabled=false',
    'config.disableDeepLinking=true',
    'config.startWithVideoMuted=true',
    'config.disableVideo=true',
    'config.startWithAudioMuted=false',
    'config.enableNoAudioDetection=false',
    'config.enableNoisyMicDetection=false',
    'config.disableThirdPartyRequests=true',
    'config.p2p.enabled=true',
    `config.displayName=${encodeURIComponent(displayName)}`,
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.TOOLBAR_BUTTONS=[]',
    'interfaceConfig.FILM_STRIP_MAX_HEIGHT=0',
    'interfaceConfig.DISABLE_VIDEO_BACKGROUND=true',
  ].join('&');
  return `https://meet.jit.si/${encodeURIComponent(room)}#${cfg}`;
}

// ─── Scripts injected into the WebView ────────────────────────────────────────

// Polls until Jitsi's conference is fully joined, then posts back to RN.
// Fallback: auto-posts 'joined' after 18s so the UI never gets stuck.
const BRIDGE_SCRIPT = `
(function() {
  var fired = false;
  function notifyJoined() {
    if (fired) return;
    fired = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'joined' }));
  }
  var attempts = 0;
  var poll = setInterval(function() {
    attempts++;
    try {
      var conf = typeof APP !== 'undefined' && APP.conference;
      if (conf && typeof conf.isJoined === 'function' && conf.isJoined()) {
        clearInterval(poll);
        notifyJoined();
        return;
      }
    } catch(e) {}
    if (attempts >= 36) { clearInterval(poll); notifyJoined(); }
  }, 500);
  true;
})();
`;

// Toggles mute using Jitsi's internal API, with two fallback strategies.
const TOGGLE_MUTE_SCRIPT = `
(function() {
  try {
    var conf = typeof APP !== 'undefined' && APP.conference;
    if (conf && typeof conf.isLocalAudioMuted === 'function') {
      if (conf.isLocalAudioMuted()) { conf.unmuteAudio(); } else { conf.muteAudio(); }
    } else if (typeof APP !== 'undefined' && APP.keyboardshortcut) {
      APP.keyboardshortcut.trigger('m');
    } else {
      var btn = document.querySelector('[aria-label*="mute"]') || document.querySelector('[aria-label*="Mute"]');
      if (btn) btn.click();
    }
  } catch(e) {}
  true;
})();
`;

// Politely hangs up before we destroy the WebView.
const HANGUP_SCRIPT = `
(function() {
  try {
    var conf = typeof APP !== 'undefined' && APP.conference;
    if (conf && typeof conf.hangup === 'function') conf.hangup();
  } catch(e) {}
  true;
})();
`;

// ─── Phase UI map ─────────────────────────────────────────────────────────────

const PHASE: Record<VoicePhase, { color: string; icon: string; label: string }> = {
  idle:    { color: '#64748B', icon: 'mic-outline',  label: 'Voice'    },
  joining: { color: '#F59E0B', icon: 'mic-outline',  label: 'Joining…' },
  live:    { color: '#10B981', icon: 'mic',           label: 'Live'     },
  muted:   { color: '#EF4444', icon: 'mic-off',       label: 'Muted'    },
  error:   { color: '#EF4444', icon: 'mic-off-outline', label: 'Retry'  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InGameVoice({ roomId, myName }: Props) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webRef   = useRef<any>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const retryCount = useRef(0);
  const joinTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted    = useRef(true);

  const jitsiRoom = `drift-game-${roomId.slice(0, 12)}`;
  const jitsiUrl  = buildJitsiUrl(jitsiRoom, myName || 'Player');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      joinTimer.current && clearTimeout(joinTimer.current);
      pulseRef.current?.stop();
    };
  }, []);

  // ── Pulse animation (plays when live or joining) ──────────────────────────
  function startPulse() {
    pulseRef.current?.stop();
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.22, duration: 680, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 680, useNativeDriver: true }),
    ]));
    pulseRef.current = a;
    a.start();
  }
  function stopPulse() {
    pulseRef.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  }

  // ── Tap handler ──────────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (!mounted.current) return;

    if (phase === 'idle' || phase === 'error') {
      if (!NativeWebView) {
        setPhase('error');
        return;
      }
      retryCount.current = 0;
      setPhase('joining');
      startPulse();
      // Safety net: assume joined after 18s (bridge script's fallback also fires)
      joinTimer.current = setTimeout(() => {
        if (mounted.current) setPhase(p => p === 'joining' ? 'live' : p);
      }, 18000);
      return;
    }

    if (phase === 'joining') {
      // Cancel join
      joinTimer.current && clearTimeout(joinTimer.current);
      setPhase('idle');
      stopPulse();
      return;
    }

    if (phase === 'live') {
      webRef.current?.injectJavaScript(TOGGLE_MUTE_SCRIPT);
      setPhase('muted');
      stopPulse();
      return;
    }

    if (phase === 'muted') {
      webRef.current?.injectJavaScript(TOGGLE_MUTE_SCRIPT);
      setPhase('live');
      startPulse();
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Leave voice ──────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    if (!mounted.current) return;
    webRef.current?.injectJavaScript(HANGUP_SCRIPT);
    joinTimer.current && clearTimeout(joinTimer.current);
    setPhase('idle');
    stopPulse();
    retryCount.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebView event handlers ───────────────────────────────────────────────
  function onWebViewLoad() {
    // Inject bridge after page finishes loading (Jitsi's JS hasn't run yet)
    setTimeout(() => {
      webRef.current?.injectJavaScript(BRIDGE_SCRIPT);
    }, 1500);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onMessage(e: any) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string };
      if (msg.type === 'joined' && mounted.current) {
        joinTimer.current && clearTimeout(joinTimer.current);
        setPhase('live');
        startPulse();
        retryCount.current = 0;
      }
    } catch { /* ignore */ }
  }

  function onWebViewError() {
    if (!mounted.current) return;
    joinTimer.current && clearTimeout(joinTimer.current);
    if (retryCount.current < 3) {
      // Auto-retry up to 3 times — WebView will remount when key changes
      retryCount.current += 1;
      setPhase('joining'); // re-render forces WebView remount via key
    } else {
      setPhase('error');
      stopPulse();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isActive = phase === 'joining' || phase === 'live' || phase === 'muted';
  const ui = PHASE[phase];

  return (
    <>
      {/* ── Hidden off-screen Jitsi WebView (audio bridge) ── */}
      {isActive && NativeWebView && (
        <View style={sc.hiddenWrap} pointerEvents="none">
          <NativeWebView
            key={retryCount.current}       // remounts on retry
            ref={webRef}
            source={{ uri: jitsiUrl }}
            style={sc.hiddenWebView}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            // iOS 15+: grant mic without prompting inside WebView
            mediaCapturePermissionGrantType="grant"
            onLoad={onWebViewLoad}
            onError={onWebViewError}
            onMessage={onMessage}
          />
        </View>
      )}

      {/* ── Mic button ── */}
      <View style={sc.wrap}>
        {/* Outer pulse ring */}
        <Animated.View
          style={[
            sc.ring,
            isActive && { borderColor: ui.color + '44', borderWidth: 2 },
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <TouchableOpacity
            style={[sc.btn, { backgroundColor: ui.color }]}
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <Ionicons name={ui.icon as 'mic'} size={16} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Label */}
        <Text style={[sc.label, isActive && { color: ui.color }]}>{ui.label}</Text>

        {/* Leave button — only when connected */}
        {(phase === 'live' || phase === 'muted') && (
          <TouchableOpacity style={sc.endBtn} onPress={handleLeave} activeOpacity={0.8}>
            <Text style={sc.endTxt}>End</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  // WebView is rendered off-screen — NOT zero-size (iOS needs real dimensions for WebRTC)
  hiddenWrap: {
    position: 'absolute',
    top: -600,
    left: -600,
    width: 200,
    height: 200,
    overflow: 'hidden',
  },
  hiddenWebView: { width: 200, height: 200 },

  // Mic button UI
  wrap: {
    alignItems: 'center',
    gap: 3,
    minWidth: 44,
  },
  ring: {
    borderRadius: 22,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 2,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  endBtn: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#FEE2E2',
  },
  endTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
  },
});
