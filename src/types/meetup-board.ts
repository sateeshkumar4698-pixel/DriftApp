/**
 * Types for the Public Meetup Board feature.
 * DO NOT add to src/types/index.ts — this is a separate module to avoid
 * conflicts with the agent managing that file.
 */

export interface MeetupPost {
  id: string;
  uid: string;
  userName: string;
  userPhotoURL?: string;
  venueName: string;       // e.g. "Blue Tokai, Koramangala"
  note?: string;           // e.g. "Anyone for coffee? ☕"
  lat: number;
  lon: number;
  city: string;
  joiners: string[];       // UIDs who tapped "I'll join"
  joinerNames: string[];
  expiresAt: number;       // createdAt + 2 hours (epoch ms)
  createdAt: number;       // epoch ms
}
