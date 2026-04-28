import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  Unsubscribe,
  QueryConstraint,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  UserProfile,
  Connection,
  ConnectionRequest,
  MeetupProposal,
  Memory,
  Post,
  Event,
  DriftStatus,
  GameRoom,
  GameRoomPlayer,
  GameInvite,
  GameId,
  AppNotification,
  NotifType,
  EventInvite,
} from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as UserProfile;
  // Normalise fields that may be missing in older / partially-written documents
  // to prevent .map() / .length crashes in UI components.
  return {
    ...data,
    interests:  Array.isArray(data.interests)  ? data.interests  : [],
    lookingFor: Array.isArray(data.lookingFor) ? data.lookingFor : [],
    streak: data.streak ?? { current: 0, longest: 0, lastLoginDate: '' },
    coins:  typeof data.coins === 'number'  ? data.coins  : 0,
    profileCompleteness: typeof data.profileCompleteness === 'number' ? data.profileCompleteness : 40,
  };
}

export async function setUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

/**
 * Checks today's login, updates streak, and awards coins.
 * Returns the updated profile fields so the caller can sync the store.
 */
export async function checkDailyLoginAndUpdateStreak(
  uid: string,
  current: { coins: number; streak: UserProfile['streak'] },
): Promise<{ coins: number; streak: UserProfile['streak'] }> {
  const today = new Date().toISOString().slice(0, 10);
  if (current.streak.lastLoginDate === today) {
    return current; // already processed today
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const wasYesterday = current.streak.lastLoginDate === yesterday;

  const newCurrent = wasYesterday ? current.streak.current + 1 : 1;
  const newLongest = Math.max(current.streak.longest, newCurrent);

  const streak: UserProfile['streak'] = {
    current: newCurrent,
    longest: newLongest,
    lastLoginDate: today,
  };

  // Coins: +10 daily, +75 bonus on 7-day streak
  let earnedCoins = 10;
  if (newCurrent === 7) earnedCoins += 75;
  else if (newCurrent === 30) earnedCoins += 300;
  const coins = current.coins + earnedCoins;

  await setDoc(doc(db, 'users', uid), { coins, streak }, { merge: true });
  return { coins, streak };
}

/**
 * Paginated discovery feed — 20 users per page, excludes current user
 * and users already sent/received connections from.
 */
export async function getDiscoverFeed(
  currentUid: string,
  excludeUids: string[],
  lastDoc?: DocumentSnapshot,
  pageSize = 20,
): Promise<{ users: UserProfile[]; lastDoc: DocumentSnapshot | null }> {
  const excludeSet = new Set([currentUid, ...excludeUids]);

  const constraints: QueryConstraint[] = [
    where('isBanned', '==', false),
    orderBy('profileCompleteness', 'desc'),
    orderBy('createdAt', 'desc'),
    limit(pageSize + excludeSet.size + 5), // over-fetch to account for excludes
  ];
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const snap = await getDocs(query(collection(db, 'users'), ...constraints));
  const users = snap.docs
    .filter((d) => !excludeSet.has(d.id))
    .map((d) => d.data() as UserProfile)
    .slice(0, pageSize);

  const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { users, lastDoc: last };
}

/** UIDs the current user has already interacted with (sent/received requests) */
export async function getInteractedUids(uid: string): Promise<string[]> {
  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(query(collection(db, 'connectionRequests'), where('fromUid', '==', uid))),
    getDocs(query(collection(db, 'connectionRequests'), where('toUid', '==', uid))),
  ]);
  const uids: string[] = [];
  sentSnap.docs.forEach((d) => uids.push(d.data().toUid));
  receivedSnap.docs.forEach((d) => uids.push(d.data().fromUid));
  return [...new Set(uids)];
}

// ─── Connection Requests ──────────────────────────────────────────────────────

export async function sendConnectionRequest(
  fromUid: string,
  toUid: string,
  note: string,
): Promise<void> {
  const id = `${fromUid}_${toUid}`;
  await setDoc(doc(db, 'connectionRequests', id), {
    id,
    fromUid,
    toUid,
    note: note.trim(),
    status: 'pending',
    createdAt: Date.now(),
  });
}

export async function respondToConnectionRequest(
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const requestDoc = doc(db, 'connectionRequests', requestId);
  await updateDoc(requestDoc, { status, respondedAt: Date.now() });

  if (status === 'accepted') {
    const [fromUid, toUid] = requestId.split('_');
    const connectionId = [fromUid, toUid].sort().join('_');
    await setDoc(doc(db, 'connections', connectionId), {
      id: connectionId,
      users: [fromUid, toUid],
      connectedAt: Date.now(),
    });
  }
}

export async function withdrawConnectionRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'connectionRequests', requestId));
}

/** Live listener: incoming pending requests for current user */
export function subscribeToPendingRequests(
  uid: string,
  cb: (requests: ConnectionRequest[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'connectionRequests'),
    where('toUid', '==', uid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as ConnectionRequest)),
    (err) => {
      if (err.code === 'failed-precondition') {
        console.log('[connectionRequests] Index building, will retry…');
        cb([]);
        return;
      }
      console.warn('[connectionRequests] snapshot error:', err.message);
    },
  );
}

/** Check if a pending request exists from currentUser → targetUser */
export async function getConnectionRequestStatus(
  fromUid: string,
  toUid: string,
): Promise<ConnectionRequest | null> {
  const id = `${fromUid}_${toUid}`;
  const snap = await getDoc(doc(db, 'connectionRequests', id));
  return snap.exists() ? (snap.data() as ConnectionRequest) : null;
}

// ─── Connections (accepted) ───────────────────────────────────────────────────

export function subscribeToConnections(
  uid: string,
  cb: (connections: Connection[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'connections'),
    where('users', 'array-contains', uid),
    orderBy('connectedAt', 'desc'),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => d.data() as Connection)),
  );
}

export async function areConnected(uid1: string, uid2: string): Promise<boolean> {
  const id = [uid1, uid2].sort().join('_');
  const snap = await getDoc(doc(db, 'connections', id));
  return snap.exists();
}

// ─── Meetup Proposals ────────────────────────────────────────────────────────

export async function proposeMeetup(
  connectionId: string,
  proposal: MeetupProposal,
): Promise<void> {
  await updateDoc(doc(db, 'connections', connectionId), {
    meetupProposal: proposal,
  });
}

export async function respondToMeetup(
  connectionId: string,
  status: 'accepted' | 'declined' | 'done',
): Promise<void> {
  await updateDoc(doc(db, 'connections', connectionId), {
    'meetupProposal.status': status,
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function subscribeToMessages(
  connectionId: string,
  cb: (messages: import('../types').Message[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'connections', connectionId, 'messages'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => d.data() as import('../types').Message)),
  );
}

export async function sendMessage(
  connectionId: string,
  message: import('../types').Message,
): Promise<void> {
  await setDoc(
    doc(db, 'connections', connectionId, 'messages', message.id),
    message,
  );
  await updateDoc(doc(db, 'connections', connectionId), {
    lastMessage: message.text,
    lastMessageAt: message.createdAt,
  });
}

// ─── Memories ────────────────────────────────────────────────────────────────

export async function getMemories(uid: string): Promise<Memory[]> {
  const q = query(
    collection(db, 'users', uid, 'memories'),
    orderBy('date', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Memory);
}

export async function saveMemory(uid: string, memory: Memory): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'memories', memory.id), memory);
}

export async function toggleMemoryFavorite(
  uid: string,
  memoryId: string,
  current: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'memories', memoryId), {
    isFavorite: !current,
  });
}

// ─── Status ──────────────────────────────────────────────────────────────────

export async function postStatus(uid: string, status: DriftStatus): Promise<void> {
  // Firestore rejects documents containing `undefined` values — strip them out.
  const clean = Object.fromEntries(
    Object.entries(status).filter(([, v]) => v !== undefined),
  );
  await setDoc(doc(db, 'statuses', uid), clean);
}

export async function getActiveStatuses(connectionUids: string[]): Promise<DriftStatus[]> {
  if (connectionUids.length === 0) return [];
  const now = Date.now();
  const snap = await getDocs(
    query(collection(db, 'statuses'), where('__name__', 'in', connectionUids.slice(0, 10))),
  );
  return snap.docs
    .map((d) => d.data() as DriftStatus)
    .filter((s) => s.expiresAt > now);
}

export async function getMyStatus(uid: string): Promise<DriftStatus | null> {
  try {
    const snap = await getDoc(doc(db, 'statuses', uid));
    if (!snap.exists()) return null;
    const s = snap.data() as DriftStatus;
    return s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function getEvents(constraints: QueryConstraint[] = []): Promise<Event[]> {
  const q = query(collection(db, 'events'), orderBy('date', 'asc'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Event);
}

export async function createEvent(event: Event): Promise<void> {
  await setDoc(doc(db, 'events', event.id), event);
}

export async function rsvpEvent(eventId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), { attendees: arrayUnion(uid) });
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export async function getPosts(userId?: string): Promise<Post[]> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(50)];
  if (userId) constraints.unshift(where('userId', '==', userId));
  const q = query(collection(db, 'posts'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Post);
}

export async function reportUser(
  reporterUid: string,
  reportedUid: string,
  reason: string,
): Promise<void> {
  const id = `${reporterUid}_${reportedUid}_${Date.now()}`;
  await setDoc(doc(db, 'reports', id), {
    id,
    reporterUid,
    reportedUid,
    reason,
    createdAt: Date.now(),
    status: 'pending',
  });
}

export async function blockUser(
  myUid: string,
  blockedUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', myUid), {
    blockedUsers: arrayUnion(blockedUid),
  });
}

export async function createPost(post: Post): Promise<void> {
  // Firestore rejects documents containing `undefined` values — strip them out.
  const clean = Object.fromEntries(
    Object.entries(post).filter(([, v]) => v !== undefined),
  );
  await setDoc(doc(db, 'posts', post.id), clean);
}

export async function togglePostLike(
  postId: string,
  uid: string,
  liked: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    likes: liked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function togglePostReaction(
  postId: string,
  uid: string,
  emoji: string,
  hasReacted: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    [`reactions.${emoji}`]: hasReacted ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function toggleBookmark(
  postId: string,
  uid: string,
  saved: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    savedBy: saved ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function addPostComment(
  postId: string,
  comment: import('../types').PostComment,
): Promise<void> {
  // Strip undefined values so Firestore doesn't reject the document
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(comment)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }

  // Step 1: Write comment document — this is the critical step
  await setDoc(doc(db, 'posts', postId, 'comments', comment.id), clean);

  // Step 2: Increment comment count — best-effort, never blocks the UI
  try {
    await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
  } catch {
    try {
      await updateDoc(doc(db, 'posts', postId), { comments: increment(1) });
    } catch {
      // Silently ignore — comment was already written, count is cosmetic
    }
  }
}

export async function getPostComments(
  postId: string,
): Promise<import('../types').PostComment[]> {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'desc'),
    limit(3),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as import('../types').PostComment);
}

// ─── Game Rooms (Firestore shell; live state in RTDB) ─────────────────────────

/** Strip undefined values recursively so Firestore doesn't reject the document */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export async function createGameRoom(room: GameRoom): Promise<void> {
  await setDoc(doc(db, 'gameRooms', room.id), stripUndefined(room));
}

export async function getGameRoom(roomId: string): Promise<GameRoom | null> {
  const snap = await getDoc(doc(db, 'gameRooms', roomId));
  return snap.exists() ? (snap.data() as GameRoom) : null;
}

export async function joinGameRoom(roomId: string, player: GameRoomPlayer): Promise<void> {
  await updateDoc(doc(db, 'gameRooms', roomId), {
    [`players.${player.uid}`]: stripUndefined(player),
  });
}

export async function leaveGameRoom(roomId: string, uid: string): Promise<void> {
  const roomRef = doc(db, 'gameRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room = snap.data() as GameRoom;
  const players = { ...room.players };
  delete players[uid];
  if (Object.keys(players).length === 0) {
    await deleteDoc(roomRef);
  } else {
    await updateDoc(roomRef, { players });
  }
}

export async function setPlayerReady(
  roomId: string,
  uid: string,
  ready: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'gameRooms', roomId), {
    [`players.${uid}.ready`]: ready,
  });
}

export async function startGameRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, 'gameRooms', roomId), {
    status: 'playing',
    startedAt: Date.now(),
  });
}

export async function finishGameRoom(roomId: string, winnerUid?: string): Promise<void> {
  await updateDoc(doc(db, 'gameRooms', roomId), {
    status: 'finished',
    finishedAt: Date.now(),
    ...(winnerUid ? { winnerUid } : {}),
  });
}

export function subscribeToGameRoom(
  roomId: string,
  cb: (room: GameRoom | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'gameRooms', roomId), (snap) =>
    cb(snap.exists() ? (snap.data() as GameRoom) : null),
  );
}

// ─── Game Invites ─────────────────────────────────────────────────────────────

export async function sendGameInvite(invite: GameInvite): Promise<void> {
  await setDoc(doc(db, 'gameInvites', invite.id), stripUndefined(invite));
}

export async function respondToGameInvite(
  inviteId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  await updateDoc(doc(db, 'gameInvites', inviteId), {
    status,
    respondedAt: Date.now(),
  });
}

/** Live listener: incoming pending invites for current user (non-expired).
 *  Silently no-ops while the composite index is still building — retries
 *  automatically once Firebase propagates the index (usually < 5 min). */
export function subscribeToIncomingInvites(
  uid: string,
  cb: (invites: GameInvite[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'gameInvites'),
    where('toUid', '==', uid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      cb(
        snap.docs
          .map((d) => d.data() as GameInvite)
          .filter((i) => i.expiresAt > now),
      );
    },
    (err) => {
      // Index still building — silently wait; listener auto-retries.
      if (
        err.code === 'failed-precondition' &&
        (err.message.includes('index') || err.message.includes('Index'))
      ) {
        console.log('[gameInvites] Index building, will retry automatically…');
        cb([]); // empty state while waiting
        return;
      }
      console.warn('[gameInvites] snapshot error:', err.message);
    },
  );
}

export async function expireOldInvites(uid: string): Promise<void> {
  const now = Date.now();
  const snap = await getDocs(
    query(
      collection(db, 'gameInvites'),
      where('fromUid', '==', uid),
      where('status', '==', 'pending'),
    ),
  );
  await Promise.all(
    snap.docs
      .filter((d) => (d.data() as GameInvite).expiresAt <= now)
      .map((d) => updateDoc(d.ref, { status: 'expired' })),
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

/** Write a notification document for a user (called by app + Cloud Functions) */
export async function pushNotification(
  uid: string,
  type: NotifType,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const id = `${uid}_${type}_${Date.now()}`;
  await setDoc(doc(db, 'userNotifications', id), {
    id,
    uid,
    type,
    title,
    body,
    read: false,
    createdAt: Date.now(),
    data,
  } as AppNotification);
}

/** Subscribe to real-time notifications for a user (newest first, max 50) */
export function subscribeToNotifications(
  uid: string,
  callback: (notifs: AppNotification[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'userNotifications'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as AppNotification));
  });
}

/** Mark a single notification as read */
export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'userNotifications', notifId), { read: true });
}

/** Mark all notifications as read for a user */
export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'userNotifications'),
      where('uid', '==', uid),
      where('read', '==', false),
    ),
  );
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}

/** Count unread notifications */
export function subscribeToUnreadCount(
  uid: string,
  callback: (count: number) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'userNotifications'),
    where('uid', '==', uid),
    where('read', '==', false),
  );
  return onSnapshot(q, (snap) => callback(snap.size));
}

// ─── Event Invites ────────────────────────────────────────────────────────────

export async function sendEventInvite(invite: EventInvite): Promise<void> {
  await setDoc(doc(db, 'eventInvites', invite.id), stripUndefined(invite));
  // Write notification so it shows in-app
  await pushNotification(
    invite.toUid,
    'event_invite',
    `📅 ${invite.fromName} invited you to an event!`,
    invite.eventTitle,
    { eventId: invite.eventId, inviteId: invite.id },
  );
}

export function subscribeToEventInvites(
  uid: string,
  callback: (invites: EventInvite[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'eventInvites'),
    where('toUid', '==', uid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as EventInvite));
  });
}

export async function respondToEventInvite(
  inviteId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  await updateDoc(doc(db, 'eventInvites', inviteId), { status });
}
