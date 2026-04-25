/**
 * voiceService — Daily.co wrapper for multiplayer voice rooms.
 *
 * This module is stub-friendly: installing `@daily-co/react-native-daily-js`
 * requires a native dev build. In Expo Go the native module will be missing,
 * so `createVoiceClient()` returns a no-op stub that logs to the console and
 * fires fake 'joined'/'left' events. Building a dev client (EAS Build) will
 * use the real Daily client automatically.
 */
import { auth } from '../config/firebase';
import { VoiceRoomToken } from '../types';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// ─── Backend token fetch ──────────────────────────────────────────────────────

export async function fetchVoiceToken(roomName: string): Promise<VoiceRoomToken> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Must be signed in to fetch a voice token');
  }
  const idToken = await user.getIdToken();

  const res = await fetch(`${BACKEND_URL}/voice/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ roomName }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Voice token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as VoiceRoomToken;
  return data;
}

// ─── Voice client (real or stub) ──────────────────────────────────────────────

export type VoiceEvent = 'joined' | 'left' | 'error' | 'participant-joined' | 'participant-left';
export type VoiceEventCallback = (payload?: unknown) => void;

export interface VoiceClient {
  join(token: string, roomUrl: string): Promise<void>;
  leave(): Promise<void>;
  toggleMute(): Promise<boolean>; // returns new muted state
  on(event: VoiceEvent, cb: VoiceEventCallback): void;
  isMuted(): boolean;
  isJoined(): boolean;
}

/**
 * Returns a VoiceClient. Tries to use the real `@daily-co/react-native-daily-js`
 * package; if not available (e.g. Expo Go), returns a no-op stub.
 */
export function createVoiceClient(): VoiceClient {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Daily = require('@daily-co/react-native-daily-js');
    return makeRealClient(Daily);
  } catch (err) {
    console.log('[voiceService] Daily native module not available — using stub', err);
    return makeStubClient();
  }
}

// ─── Real Daily client ────────────────────────────────────────────────────────

// Real client uses a very narrow surface of the Daily SDK so we can keep types loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRealClient(Daily: any): VoiceClient {
  const listeners: Partial<Record<VoiceEvent, VoiceEventCallback[]>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let call: any = null;
  let muted = false;
  let joined = false;

  function emit(event: VoiceEvent, payload?: unknown) {
    (listeners[event] || []).forEach((cb) => cb(payload));
  }

  return {
    async join(token, roomUrl) {
      call = Daily.default ? Daily.default.createCallObject() : Daily.createCallObject();
      call.on('joined-meeting', () => {
        joined = true;
        emit('joined');
      });
      call.on('left-meeting', () => {
        joined = false;
        emit('left');
      });
      call.on('participant-joined', (e: unknown) => emit('participant-joined', e));
      call.on('participant-left', (e: unknown) => emit('participant-left', e));
      call.on('error', (e: unknown) => emit('error', e));
      await call.join({ url: roomUrl, token, audioSource: true, videoSource: false });
    },
    async leave() {
      if (call) {
        await call.leave();
        call.destroy?.();
        call = null;
      }
    },
    async toggleMute() {
      if (!call) return muted;
      muted = !muted;
      await call.setLocalAudio(!muted);
      return muted;
    },
    on(event, cb) {
      (listeners[event] ||= []).push(cb);
    },
    isMuted: () => muted,
    isJoined: () => joined,
  };
}

// ─── Stub client (Expo Go / dev) ──────────────────────────────────────────────

function makeStubClient(): VoiceClient {
  const listeners: Partial<Record<VoiceEvent, VoiceEventCallback[]>> = {};
  let muted = false;
  let joined = false;

  function emit(event: VoiceEvent, payload?: unknown) {
    (listeners[event] || []).forEach((cb) => cb(payload));
  }

  return {
    async join(_token, roomUrl) {
      console.log('[voiceService:stub] join', roomUrl);
      joined = true;
      setTimeout(() => emit('joined'), 150);
    },
    async leave() {
      console.log('[voiceService:stub] leave');
      joined = false;
      setTimeout(() => emit('left'), 100);
    },
    async toggleMute() {
      muted = !muted;
      console.log('[voiceService:stub] toggleMute →', muted);
      return muted;
    },
    on(event, cb) {
      (listeners[event] ||= []).push(cb);
    },
    isMuted: () => muted,
    isJoined: () => joined,
  };
}
