import { create } from 'zustand';
import { Event } from '../types';

interface EventState {
  events: Event[];
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [event, ...state.events] })),
}));
