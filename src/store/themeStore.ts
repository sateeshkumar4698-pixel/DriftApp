import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@drift_theme';

interface ThemeState {
  isDark: boolean;
  hydrated: boolean;
  setDark: (v: boolean) => void;
  toggle: () => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark:    true,   // default dark
  hydrated:  false,

  setDark: (v: boolean) => {
    set({ isDark: v });
    AsyncStorage.setItem(THEME_KEY, v ? '1' : '0').catch(() => {});
  },

  toggle: () => {
    const next = !get().isDark;
    set({ isDark: next });
    AsyncStorage.setItem(THEME_KEY, next ? '1' : '0').catch(() => {});
  },

  hydrate: async () => {
    try {
      const val = await AsyncStorage.getItem(THEME_KEY);
      // null = first launch → default dark
      set({ isDark: val === null ? true : val === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
