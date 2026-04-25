import { create } from 'zustand';
import { Connection, Message } from '../types';

interface MatchState {
  connections: Connection[];
  activeMessages: Record<string, Message[]>;
  setMatches: (connections: Connection[]) => void;
  setMessages: (connectionId: string, messages: Message[]) => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  connections: [],
  activeMessages: {},
  setMatches: (connections) => set({ connections }),
  setMessages: (connectionId, messages) =>
    set((state) => ({
      activeMessages: { ...state.activeMessages, [connectionId]: messages },
    })),
}));
