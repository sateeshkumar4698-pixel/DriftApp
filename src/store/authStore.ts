import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';

interface AuthState {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  // null = not yet read from AsyncStorage; true/false = known
  onboardingDone: boolean | null;
  setFirebaseUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingDone: (done: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser:    null,
  userProfile:     null,
  isLoading:       true,
  onboardingDone:  null,
  setFirebaseUser:   (firebaseUser)   => set({ firebaseUser }),
  setUserProfile:    (userProfile)    => set({ userProfile }),
  setLoading:        (isLoading)      => set({ isLoading }),
  setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
  reset: () => set({ firebaseUser: null, userProfile: null, isLoading: false }),
}));
