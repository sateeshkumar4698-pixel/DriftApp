/**
 * GameSounds — centralised sound & haptic manager for all Drift games.
 * Uses expo-audio (SDK 54+). Falls back to haptics-only if the native
 * module isn't compiled into the current binary (e.g. Expo Go / old build).
 *
 * All sounds are streamed from Mixkit CDN (free, no attribution required).
 */

import { Vibration } from 'react-native';

// ─── Lazy-load expo-audio so older binaries don't crash ───────────────────────
let createAudioPlayer: ((src: { uri: string }) => any) | null = null;
let setAudioModeAsync: ((mode: object) => Promise<void>) | null = null;

try {
  const mod = require('expo-audio');
  createAudioPlayer = mod.createAudioPlayer;
  setAudioModeAsync = mod.setAudioModeAsync;
} catch {
  // Native module not available in this binary — sounds disabled, haptics still work
}

// ─── Sound catalogue ──────────────────────────────────────────────────────────

export type GameSound =
  // Ludo
  | 'dice_roll'      // dice rattling
  | 'piece_move'     // piece slides on board
  | 'capture'        // opponent piece sent home
  | 'six_rolled'     // special chime for a 6
  | 'home'           // piece reaches home
  // Shared
  | 'win'            // victory fanfare
  | 'lose'           // defeat sting
  | 'turn_change'    // subtle ping — next player's turn
  | 'button_tap'     // generic UI tap
  | 'error'          // invalid move / error
  // UNO
  | 'card_play'      // card placed
  | 'card_draw'      // draw a card
  | 'uno_call'       // "UNO!" shout moment
  | 'reverse'        // reverse card played
  | 'skip'           // skip card played
  | 'wild'           // wild / wild-draw played
  // Chess
  | 'chess_move'     // piece placed
  | 'chess_capture'  // piece taken
  | 'chess_check'    // check declared
  | 'chess_castle'   // castling
  // Truth or Dare / Bet
  | 'spin'           // bottle / wheel spinning
  | 'reveal'         // dramatic reveal
  | 'dare'           // dare card shown
  | 'truth';         // truth card shown

// Free, no-attribution sounds from mixkit.co
const SOUND_URLS: Record<GameSound, string> = {
  // Ludo
  dice_roll:     'https://assets.mixkit.co/sfx/preview/mixkit-dice-roll-1626.mp3',
  piece_move:    'https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3',
  capture:       'https://assets.mixkit.co/sfx/preview/mixkit-player-losing-or-failing-2042.mp3',
  six_rolled:    'https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3',
  home:          'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3',
  // Shared
  win:           'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
  lose:          'https://assets.mixkit.co/sfx/preview/mixkit-losing-drums-2023.mp3',
  turn_change:   'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3',
  button_tap:    'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
  error:         'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
  // UNO
  card_play:     'https://assets.mixkit.co/sfx/preview/mixkit-quick-positive-feedback-2047.mp3',
  card_draw:     'https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3',
  uno_call:      'https://assets.mixkit.co/sfx/preview/mixkit-alert-quick-chime-766.mp3',
  reverse:       'https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3',
  skip:          'https://assets.mixkit.co/sfx/preview/mixkit-negative-answer-lose-2032.mp3',
  wild:          'https://assets.mixkit.co/sfx/preview/mixkit-fairy-arcade-sparkle-866.mp3',
  // Chess
  chess_move:    'https://assets.mixkit.co/sfx/preview/mixkit-chess-piece-movement-on-a-chessboard-1010.mp3',
  chess_capture: 'https://assets.mixkit.co/sfx/preview/mixkit-player-losing-or-failing-2042.mp3',
  chess_check:   'https://assets.mixkit.co/sfx/preview/mixkit-alert-quick-chime-766.mp3',
  chess_castle:  'https://assets.mixkit.co/sfx/preview/mixkit-quick-positive-feedback-2047.mp3',
  // Truth or Dare / Bet
  spin:          'https://assets.mixkit.co/sfx/preview/mixkit-game-show-suspense-waiting-667.mp3',
  reveal:        'https://assets.mixkit.co/sfx/preview/mixkit-reveal-game-over-screech-2063.mp3',
  dare:          'https://assets.mixkit.co/sfx/preview/mixkit-horror-game-long-stinger-2003.mp3',
  truth:         'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3',
};

// Vibration patterns — used even when audio is disabled
const HAPTIC_PATTERNS: Partial<Record<GameSound, number[]>> = {
  dice_roll:     [0, 40, 25, 40, 25, 60],
  piece_move:    [0, 25],
  capture:       [0, 80, 40, 120],
  six_rolled:    [0, 60, 30, 60, 30, 80],
  home:          [0, 80, 40, 80],
  win:           [0, 100, 50, 150, 50, 300],
  lose:          [0, 200, 100, 200],
  turn_change:   [0, 30],
  button_tap:    [0, 15],
  error:         [0, 80, 40, 80],
  uno_call:      [0, 60, 30, 60],
  wild:          [0, 50, 30, 50, 30, 50],
  chess_move:    [0, 20],
  chess_capture: [0, 80, 40, 80],
  chess_check:   [0, 60, 30, 100],
  spin:          [0, 30, 20, 30, 20, 30, 20, 40],
  reveal:        [0, 100, 50, 150],
};

// Volume levels per sound (0.0 – 1.0)
const VOLUMES: Partial<Record<GameSound, number>> = {
  dice_roll:   0.7,
  piece_move:  0.5,
  turn_change: 0.4,
  button_tap:  0.3,
  spin:        0.6,
};

// ─── Manager ──────────────────────────────────────────────────────────────────

class GameSoundManager {
  private players: Partial<Record<GameSound, any>> = {};
  private loading: Partial<Record<GameSound, boolean>> = {};
  private audioEnabled  = true;
  private hapticEnabled = true;
  private initialised   = false;

  /** Check if audio is available in this binary */
  private get audioAvailable(): boolean {
    return createAudioPlayer !== null;
  }

  private async ensureAudioMode(): Promise<void> {
    if (this.initialised || !setAudioModeAsync) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode:      true,
        interruptionMode:       'duckOthers',
        shouldPlayInBackground: false,
      });
      this.initialised = true;
    } catch { /* silent */ }
  }

  /** Pre-load a set of sounds (call on screen mount). */
  async preload(names: GameSound[]): Promise<void> {
    if (!this.audioAvailable) return;
    await this.ensureAudioMode();
    await Promise.allSettled(names.map((n) => this._load(n)));
  }

  private async _load(name: GameSound): Promise<void> {
    if (!createAudioPlayer || this.players[name] || this.loading[name]) return;
    this.loading[name] = true;
    try {
      const player = createAudioPlayer({ uri: SOUND_URLS[name] });
      player.volume = VOLUMES[name] ?? 1.0;
      this.players[name] = player;
    } catch { /* silent */ }
    finally { this.loading[name] = false; }
  }

  /** Play a sound + haptic. Safe to call without awaiting. */
  async play(name: GameSound): Promise<void> {
    // Haptic always fires — even when audio is unavailable or off
    if (this.hapticEnabled) {
      const pat = HAPTIC_PATTERNS[name];
      if (pat) Vibration.vibrate(pat);
    }

    if (!this.audioEnabled || !this.audioAvailable) return;

    // Load on demand if not preloaded
    if (!this.players[name]) await this._load(name);

    try {
      const player = this.players[name];
      if (!player) return;
      player.seekTo(0);
      player.play();
    } catch { /* silent */ }
  }

  /** Fire-and-forget — never throws. */
  fire(name: GameSound): void {
    this.play(name).catch(() => {});
  }

  setAudioEnabled(v: boolean)  { this.audioEnabled  = v; }
  setHapticEnabled(v: boolean) { this.hapticEnabled = v; }
  get isAudioEnabled()  { return this.audioEnabled; }
  get isHapticEnabled() { return this.hapticEnabled; }

  async unloadAll(): Promise<void> {
    Object.values(this.players).forEach((p) => {
      try { p?.remove?.(); } catch { /* silent */ }
    });
    this.players     = {};
    this.loading     = {};
    this.initialised = false;
  }
}

export const gameSounds = new GameSoundManager();
