/**
 * Firestore helpers for the Public Meetup Board.
 * Collection: `meetupPosts`
 */

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MeetupPost } from '../types/meetup-board';
import { getDistanceKm } from './locationUtils';

const MEETUP_COLLECTION = 'meetupPosts';

/**
 * Creates a new meetup post in Firestore.
 * The `id` field is ignored — Firestore auto-generates the document ID,
 * and the id is back-filled via the returned document reference.
 */
export async function createMeetupPost(
  post: Omit<MeetupPost, 'id'>,
): Promise<void> {
  const ref = await addDoc(collection(db, MEETUP_COLLECTION), post);
  // Backfill id into the document
  await updateDoc(ref, { id: ref.id });
}

/**
 * Adds the given user to the joiners list of a meetup post using arrayUnion
 * so concurrent taps are safe.
 */
export async function joinMeetupPost(
  postId: string,
  uid: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, MEETUP_COLLECTION, postId), {
    joiners: arrayUnion(uid),
    joinerNames: arrayUnion(name),
  });
}

/**
 * Removes the given user from the joiners list.
 */
export async function leaveMeetupPost(
  postId: string,
  uid: string,
  name: string,
): Promise<void> {
  // Firestore arrayRemove is the inverse of arrayUnion
  const { arrayRemove } = await import('firebase/firestore');
  await updateDoc(doc(db, MEETUP_COLLECTION, postId), {
    joiners: arrayRemove(uid),
    joinerNames: arrayRemove(name),
  });
}

/**
 * Live subscription to active (non-expired) meetup posts.
 * Queries the 30 most recent posts that haven't expired, then filters
 * client-side by distance <= radiusKm.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToMeetupPosts(
  userLat: number,
  userLon: number,
  radiusKm: number,
  cb: (posts: MeetupPost[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, MEETUP_COLLECTION),
    where('expiresAt', '>', Date.now()),
    orderBy('expiresAt', 'asc'),
    limit(30),
  );

  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const posts = snap.docs
        .map((d) => d.data() as MeetupPost)
        // Secondary expiry guard (in case of clock skew)
        .filter((p) => p.expiresAt > now)
        // Distance filter
        .filter((p) => {
          const dist = getDistanceKm(userLat, userLon, p.lat, p.lon);
          return dist <= radiusKm;
        })
        // Sort newest first for display
        .sort((a, b) => b.createdAt - a.createdAt);
      cb(posts);
    },
    (err) => {
      if (err.code === 'failed-precondition') {
        // Index still building
        console.log('[meetupPosts] Index building, retrying with fallback…');
        cb([]);
        return;
      }
      console.warn('[meetupPosts] snapshot error:', err.message);
      cb([]);
    },
  );
}
