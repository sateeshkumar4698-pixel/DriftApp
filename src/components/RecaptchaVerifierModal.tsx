/**
 * RecaptchaVerifierModal — drop-in replacement for expo-firebase-recaptcha.
 *
 * Uses react-native-webview (already installed) to load Firebase's reCAPTCHA
 * widget and returns a token compatible with signInWithPhoneNumber's
 * ApplicationVerifier interface.
 *
 * In __DEV__ mode, auth.settings.appVerificationDisabledForTesting = true
 * (set in firebase.ts), so this modal is never shown and verify() resolves
 * immediately with an empty string — Firebase skips reCAPTCHA entirely.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { firebaseConfig } from '../config/firebase';
import { useTheme } from '../utils/useTheme';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RecaptchaVerifierRef {
  /** Must be 'recaptcha' — required by Firebase ApplicationVerifier interface */
  readonly type: 'recaptcha';
  /** Call before signInWithPhoneNumber; resolves with the reCAPTCHA token */
  verify(): Promise<string>;
}

interface Props {
  title?: string;
  cancelLabel?: string;
  /** Use invisible reCAPTCHA (no checkbox; auto-verifies for most users) */
  attemptInvisibleVerification?: boolean;
}

// ─── WebView HTML (self-contained Firebase compat reCAPTCHA page) ─────────────

function buildHtml(cfg: object, invisible: boolean): string {
  const size = invisible ? 'invisible' : 'normal';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;justify-content:center;align-items:center;
         min-height:100vh;background:#fff;font-family:-apple-system,sans-serif}
    #rc{display:flex;justify-content:center}
  </style>
</head>
<body>
  <div id="rc"></div>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
  <script>
    (function(){
      try{
        firebase.initializeApp(${JSON.stringify(cfg)});
        var auth=firebase.auth();
        var v=new firebase.auth.RecaptchaVerifier('rc',{
          size:'${size}',
          callback:function(t){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'success',token:t}));
          },
          'expired-callback':function(){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'expired'}));
          }
        });
        v.render().then(function(){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
          ${invisible ? 'v.verify();' : ''}
        }).catch(function(e){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.message}));
        });
      }catch(e){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.message}));
      }
    })();
  </script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RecaptchaVerifierModal = forwardRef<RecaptchaVerifierRef, Props>(
  ({ title = 'Quick Verification', cancelLabel = 'Cancel', attemptInvisibleVerification = false }, ref) => {
    const { C } = useTheme();
    const [visible, setVisible]   = useState(false);
    const [loading, setLoading]   = useState(true);
    const resolveRef = useRef<((token: string) => void) | null>(null);
    const rejectRef  = useRef<((err: Error) => void) | null>(null);

    // Expose ApplicationVerifier interface via ref
    useImperativeHandle(ref, () => ({
      type: 'recaptcha' as const,
      verify() {
        // In dev mode Firebase bypasses reCAPTCHA; still show modal if somehow
        // appVerificationDisabledForTesting is false in prod
        if (__DEV__) {
          // Resolve immediately — Firebase ignores the token in test mode
          return Promise.resolve('test-token');
        }
        return new Promise<string>((resolve, reject) => {
          resolveRef.current = resolve;
          rejectRef.current  = reject;
          setLoading(true);
          setVisible(true);
        });
      },
    }));

    function onMessage(e: WebViewMessageEvent) {
      try {
        const data = JSON.parse(e.nativeEvent.data) as {
          type: string; token?: string; message?: string;
        };
        if (data.type === 'success' && data.token) {
          resolveRef.current?.(data.token);
          setVisible(false);
        } else if (data.type === 'error') {
          rejectRef.current?.(new Error(data.message || 'reCAPTCHA failed'));
          setVisible(false);
        } else if (data.type === 'ready') {
          setLoading(false);
        } else if (data.type === 'expired') {
          setLoading(true); // show spinner while user re-ticks
        }
      } catch { /* ignore parse errors */ }
    }

    function onCancel() {
      rejectRef.current?.(new Error('reCAPTCHA cancelled by user'));
      setVisible(false);
    }

    const html = buildHtml(firebaseConfig, attemptInvisibleVerification);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onCancel}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.surface }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: C.border }]}>
              <Text style={[styles.title, { color: C.text }]}>{title}</Text>
              <TouchableOpacity onPress={onCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={[styles.cancelTxt, { color: C.primary }]}>{cancelLabel}</Text>
              </TouchableOpacity>
            </View>

            {/* reCAPTCHA WebView */}
            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={[styles.loaderTxt, { color: C.textSecondary }]}>
                  Loading verification…
                </Text>
              </View>
            )}
            <WebView
              source={{ html }}
              onMessage={onMessage}
              onLoad={() => setLoading(false)}
              style={[styles.webview, loading && styles.webviewHidden]}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
            />
          </View>
        </View>
      </Modal>
    );
  },
);

RecaptchaVerifierModal.displayName = 'RecaptchaVerifierModal';
export default RecaptchaVerifierModal;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    minHeight: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cancelTxt: {
    fontSize: 16,
    fontWeight: '600',
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loaderTxt: {
    fontSize: 14,
  },
  webview: {
    width: '100%',
    height: 220,
  },
  webviewHidden: {
    height: 0,
    opacity: 0,
  },
});
