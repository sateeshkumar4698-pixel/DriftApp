/**
 * GameSounds — centralised sound & haptic manager for all Drift games.
 *
 * Setup (one-time):
 *   npx expo install expo-av
 *
 * All sounds are streamed from Mixkit CDN (free, no attribution required).
 * You can swap any URL for a local asset:
 *   { uri: SOUND_URLS.dice_roll }  →  require('../../assets/sounds/dice.mp3')
 */

import { Vibration } from 'react-native';

// ─── Lazy-load expo-av so the app doesn't crash if it isn't installed yet ──────
let Audio: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require('expo-av').Audio;
} catch {
  // expo-av not installed — sounds disabled, haptics still work
}

// ─── Sound catalogue ──────────────────────────────────────────────────────────

export type GameSound =
  // Ludo
  | 'dice_roll'    // dice rattling
  | 'piece_move'   // piece slides on board
  | 'capture'      // opponent piece sent home
  | 'six_rolled'   // special chime for a 6
  | 'home'         // piece reaches home
  // Shared
  | 'win'          // victory fanfare
  | 'lose'         // defeat sting
  | 'turn_change'  // subtle ping — next player's turn
  | 'button_tap'   // generic UI tap
  | 'error'        // invalid move / error
  // UNO
  | 'card_play'    // card placed
  | 'card_draw'    // draw a card
  | 'uno_call'     // "UNO!" shout moment
  | 'reverse'      // reverse card played
  | 'skip'         // skip card played
  | 'wild'         // wild / wild-draw played
  // Chess
  | 'chess_move'   // piece placed
  | 'chess_capture'// piece taken
  | 'chess_check'  // check declared
  | 'chess_castle' // castling
  // Truth or Dare / Bet
  | 'spin'         // bottle / wheel spinning
  | 'reveal'       // dramatic reveal
  | 'dare'         // dare card shown
  | 'truth';       // truth card shown

// Free, no-attribution sounds from mixkit.co
const SOUND_URLS: Record<GameSound, string> = {
  // Ludo
  dice_roll:    'https://assets.mixkit.co/sfx/preview/mixkit-dice-roll-1626.mp3',
  piece_move:   'https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3',
  capture:      'https://assets.mixkit.co/sfx/preview/mixkit-player-losing-or-failing-2042.mp3',
  six_rolled:   'https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3',
  home:         'https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3',
  // Shared
  win:          'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
  lose:         'https://assets.mixkit.co/sfx/preview/mixkit-losing-drums-2023.mp3',
  turn_change:  'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3',
  button_tap:   'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
  error:        'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
  // UNO
  card_play:    'https://assets.mixkit.co/sfx/preview/mixkit-quick-positive-feedback-2047.mp3',
  card_draw:    'https://assets.mixkit.co/sfx/preview/mixkit-game-ball-tap-2073.mp3',
  uno_call:     'https://assets.mixkit.co/sfx/preview/mixkit-alert-quick-chime-766.mp3',
  reverse:      'https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3',
  skip:         'https://assets.mixkit.co/sfx/preview/mixkit-negative-answer-lose-2032.mp3',
  wild:         'https://assets.mixkit.co/sfx/preview/mixkit-fairy-arcade-sparkle-866.mp3',
  // Chess
  chess_move:   'https://assets.mixkit.co/sfx/preview/mixkit-chess-piece-movement-on-a-chessboard-1010.mp3',
  chess_capture:'https://assets.mixkit.co/sfx/preview/mixkit-player-losing-or-failing-2042.mp3',
  chess_check:  'https://assets.mixkit.co/sfx/preview/mixkit-alert-quick-chime-766.mp3',
  chess_castle: 'https://assets.mixkit.co/sfx/preview/mixkit-quick-positive-feedback-2047.mp3',
  // Truth or Dare / Bet
  spin:         'https://assets.mixkit.co/sfx/preview/mixkit-game-show-suspense-waiting-667.mp3',
  reveal:       'https://assets.mixkit.co/sfx/preview/mixkit-reveal-game-over-screech-2063.mp3',
  dare:         'https://assets.mixkit.co/sfx/preview/mixkit-horror-game-long-stinger-2003.mp3',
  truth:        'https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3',
};

// Vibration patterns — used even when audio is disabled
const HAPTIC_PATTERNS: Partial<Record<GameSound, number[]>> = {
  dice_roll:    [0, 40, 25, 40, 25, 60],
  piece_move:   [0, 25],
  capture:      [0, 80, 40, 120],
  six_rolled:   [0, 60, 30, 60, 30, 80],
  home:         [0, 80, 40, 80],
  win:          [0, 100, 50, 150, 50, 300],
  lose:         [0, 200, 100, 200],
  turn_change:  [0, 30],
  button_tap:   [0, 15],
  error:        [0, 80, 40, 80],
  uno_call:     [0, 60, 30, 60],
  wild:         [0, 50, 30, 50, 30, 50],
  chess_move:   [0, 20],
  chess_capture:[0, 80, 40, 80],
  chess_check:  [0, 60, 30, 100],
  spin:         [0, 30, 20, 30, 20, 30, 20, 40],
  reveal:       [0, 100, 50, 150],
};

// Volume levels per sound
const VOLUMES: Partial<Record<GameSound, number>> = {
  dice_roll:   0.7,
  piece_move:  0.5,
  turn_change: 0.4,
  button_tap:  0.3,
  spin:        0.6,
};

// ─── Manager ──────────────────────────────────────────────────────────────────

class GameSoundManager {
  private sounds: Partial<Record<GameSound, any>> = {};
  private loading: Partial<Record<GameSound, boolean>> = {};
  private audioEnabled  = true;
  private hapticEnabled = true;
  private initialised   = false;

  private async ensureAudioMode(): Promise<void> {
    if (!Audio || this.initialised) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS:    true,
        staysActiveInBackground: false,
        shouldDuckAndroid:       true,
      });
      this.initialised = true;
    } catch { /* silent */ }
  }

  /** Pre-load a set of sounds (call on screen mount). */
  async preload(names: GameSound[]): Promise<void> {
    await this.ensureAudioMode();
    await Promise.allSettled(names.map((n) => this._load(n)));
  }

  private async _load(name: GameSound): Promise<void> {
    if (!Audio || this.sounds[name] || this.loading[name]) return;
    this.loading[name] = true;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: SOUND_URLS[name] },
        { shouldPlay: false, volume: VOLUMES[name] ?? 1.0 },
      );
      this.sounds[name] = sound;
    } catch { /* silent */ }
    finally { this.loading[name] = false; }
  }

  /** Play a sound + haptic. Safe to call without awaiting. */
  async play(name: GameSound): Promise<void> {
    // Haptic (always — even if audio is off)
    if (this.hapticEnabled) {
      const pat = HAPTIC_PATTERNS[name];
      if (pat) Vibration.vibrate(pat);
    }

    if (!this.audioEnabled || !Audio) return;

    // Load on demand if not preloaded
    if (!this.sounds[name]) await this._load(name);

    try {
      const snd = this.sounds[name];
      if (!snd) return;
      await snd.stopAsync();
      await snd.setPositionAsync(0);
      await snd.playAsync();
    } catch { /* silent */ }
  }

  /** Play without awaiting — fire and forget. */
  fire(name: GameSound): void {
    this.play(name).catch(() => {});
  }

  setAudioEnabled(v: boolean)  { this.audioEnabled  = v; }
  setHapticEnabled(v: boolean) { this.hapticEnabled = v; }
  get isAudioEnabled()  { return this.audioEnabled; }
  get isHapticEnabled() { return this.hapticEnabled; }

  async unloadAll(): Promise<void> {
    await Promise.allSettled(
      Object.values(this.sounds).map((s) => s?.unloadAsync?.()),
    );
    this.sounds  = {};
    this.loading = {};
  }
}

export const gameSounds = new GameSoundManager();
