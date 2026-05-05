import { create } from 'zustand';

// ─── Mood types ───────────────────────────────────────────────────────────────

export type MoodPreset = 'energetic' | 'chill' | 'creative' | 'social' | 'romantic' | 'focused';

export interface MoodWeights {
  energyMatch:    number;
  socialMatch:    number;
  adventureMatch: number;
  aestheticMatch: number;
  interestBonus:  number;
  vibeBonus:      number;
  locationBonus:  number;
  intentBonus:    number;
  musicBonus:     number;
}

export const MOOD_META: Record<MoodPreset, { icon: string; label: string; color: string; description: string }> = {
  energetic: { icon: '⚡', label: 'Energetic', color: '#FF6B35', description: 'High-energy, active & adventurous' },
  chill:     { icon: '🌊', label: 'Chill',     color: '#00B4D8', description: 'Relaxed, aesthetic & mellow' },
  creative:  { icon: '🎨', label: 'Creative',  color: '#9B5DE5', description: 'Artistic, expressive & curious' },
  social:    { icon: '🫂', label: 'Social',    color: '#F72585', description: 'Open, friendly & outgoing' },
  romantic:  { icon: '🌹', label: 'Romantic',  color: '#FF4B6E', description: 'Intimate, warm & intentional' },
  focused:   { icon: '🧠', label: 'Focused',   color: '#4361EE', description: 'Purposeful, ambitious & sharp' },
};

export const MOOD_WEIGHTS: Record<MoodPreset, MoodWeights> = {
  energetic: { energyMatch: 2.0, socialMatch: 1.5, adventureMatch: 1.5, aestheticMatch: 0.5, interestBonus: 1.0, vibeBonus: 1.0, locationBonus: 1.2, intentBonus: 1.0, musicBonus: 0.8 },
  chill:     { energyMatch: 0.5, socialMatch: 0.8, adventureMatch: 0.5, aestheticMatch: 2.0, interestBonus: 1.5, vibeBonus: 2.0, locationBonus: 1.0, intentBonus: 0.8, musicBonus: 1.5 },
  creative:  { energyMatch: 0.8, socialMatch: 1.0, adventureMatch: 1.0, aestheticMatch: 2.5, interestBonus: 2.0, vibeBonus: 1.5, locationBonus: 0.8, intentBonus: 1.0, musicBonus: 1.2 },
  social:    { energyMatch: 1.2, socialMatch: 2.5, adventureMatch: 1.2, aestheticMatch: 0.8, interestBonus: 1.2, vibeBonus: 1.0, locationBonus: 1.5, intentBonus: 2.0, musicBonus: 1.0 },
  romantic:  { energyMatch: 1.0, socialMatch: 1.5, adventureMatch: 1.2, aestheticMatch: 1.5, interestBonus: 1.5, vibeBonus: 1.5, locationBonus: 1.0, intentBonus: 2.5, musicBonus: 2.0 },
  focused:   { energyMatch: 0.8, socialMatch: 0.8, adventureMatch: 0.5, aestheticMatch: 1.0, interestBonus: 2.0, vibeBonus: 0.8, locationBonus: 1.2, intentBonus: 2.5, musicBonus: 0.5 },
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface MoodState {
  moodPreset:    MoodPreset;
  moodIntensity: 1 | 2 | 3;      // 1=subtle, 2=balanced, 3=strong
  dialVisible:   boolean;
  setMood:       (mood: MoodPreset) => void;
  setIntensity:  (level: 1 | 2 | 3) => void;
  showDial:      () => void;
  hideDial:      () => void;
  toggleDial:    () => void;
}

export const useMoodStore = create<MoodState>((set) => ({
  moodPreset:    'chill',
  moodIntensity: 2,
  dialVisible:   true,
  setMood:       (mood)      => set({ moodPreset: mood }),
  setIntensity:  (level)     => set({ moodIntensity: level }),
  showDial:      ()          => set({ dialVisible: true }),
  hideDial:      ()          => set({ dialVisible: false }),
  toggleDial:    ()          => set((s) => ({ dialVisible: !s.dialVisible })),
}));
