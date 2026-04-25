/**
 * ludoRoomService — low-latency Ludo state sync via Firebase RTDB.
 *
 * This provides only the sync primitives (subscribe / update / init). The full
 * Ludo game rules and turn logic live inside the game component itself, which
 * uses this service to broadcast piece positions and turn changes to all
 * players in the same room.
 *
 * RTDB path: `gameRooms/{roomId}/ludo`
 */
import { onValue, ref, set, update } from 'firebase/database';
import { rtdb } from '../config/firebase';

export interface LudoPiece {
  id:       string;   // e.g. "red-0"
  owner:    string;   // uid of the player owning this piece
  color:    string;   // 'red' | 'green' | 'blue' | 'yellow'
  position: number;   // -1 = home base, 0..51 = main path, 100+ = home stretch
}

export interface LudoState {
  pieces:      LudoPiece[];
  currentTurn: string;    // uid of whose turn it is
  lastDice:    number;    // 0 = not yet rolled, 1-6 = last roll
  turnOrder:   string[];  // uids in turn order
  winnerUid?:  string;
  updatedAt:   number;
}

function ludoPath(roomId: string): string {
  return `gameRooms/${roomId}/ludo`;
}

/**
 * Subscribe to live Ludo state for a room. Returns an unsubscribe fn.
 */
export function subscribeToLudoState(
  roomId: string,
  cb: (state: LudoState | null) => void,
): () => void {
  const r = ref(rtdb, ludoPath(roomId));
  const unsub = onValue(r, (snap) => {
    cb(snap.exists() ? (snap.val() as LudoState) : null);
  });
  return unsub;
}

/**
 * Patch partial Ludo state. Use for piece moves, turn changes, dice rolls.
 */
export async function updateLudoState(
  roomId: string,
  partial: Partial<LudoState>,
): Promise<void> {
  await update(ref(rtdb, ludoPath(roomId)), {
    ...partial,
    updatedAt: Date.now(),
  });
}

/**
 * Initialise a fresh Ludo state with pieces in their home bases. Called once
 * by the host when the game transitions from 'waiting' to 'playing'.
 */
export async function initLudoState(
  roomId: string,
  players: { uid: string; color: string }[],
): Promise<void> {
  const pieces: LudoPiece[] = [];
  for (const p of players) {
    for (let i = 0; i < 4; i++) {
      pieces.push({
        id:       `${p.color}-${i}`,
        owner:    p.uid,
        color:    p.color,
        position: -1,
      });
    }
  }

  const state: LudoState = {
    pieces,
    currentTurn: players[0]?.uid ?? '',
    lastDice:    0,
    turnOrder:   players.map((p) => p.uid),
    updatedAt:   Date.now(),
  };

  await set(ref(rtdb, ludoPath(roomId)), state);
}
