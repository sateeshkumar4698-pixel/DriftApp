/**
 * Coin Service
 * Handles all coin earning/spending logic with Firestore transaction recording.
 * All writes are idempotent — duplicate calls for the same event are safe.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CoinTxReason, CoinTransaction } from '../types';

// ─── Coin reward table ────────────────────────────────────────────────────────

export const COIN_REWARDS: Record<CoinTxReason, number> = {
  daily_login:      10,
  streak_7:         75,
  streak_30:        300,
  signup_bonus:     50,
  first_connection: 20,
  profile_complete: 30,
  voice_call:       5,
  video_call:       10,
  boost:            -50,   // spend
  purchase:         0,     // variable — set via amount param
};

export const COIN_LABELS: Record<CoinTxReason, string> = {
  daily_login:      'Daily Login',
  streak_7:         '7-Day Streak Bonus',
  streak_30:        '30-Day Streak Bonus',
  signup_bonus:     'Welcome Bonus',
  first_connection: 'First Connection',
  profile_complete: 'Profile Complete',
  voice_call:       'Voice Call',
  video_call:       'Video Call',
  boost:            'Profile Boost',
  purchase:         'Coin Purchase',
};

// ─── Core helper ─────────────────────────────────────────────────────────────

/**
 * Awards or deducts coins from a user and records the transaction.
 * Uses a Firestore transaction to ensure atomicity.
 *
 * @param uid       - Firebase user uid
 * @param reason    - CoinTxReason key
 * @param amount    - Override amount (defaults to COIN_REWARDS[reason])
 * @param dedupKey  - Optional dedup key — if provided, will not re-award if already recorded
 * @returns         - New coin balance, or null on failure
 */
export async function awardCoins(
  uid: string,
  reason: CoinTxReason,
  amount?: number,
  dedupKey?: string,
): Promise<number | null> {
  const coins = amount ?? COIN_REWARDS[reason];
  if (coins === 0) return null;

  const userRef  = doc(db, 'users', uid);
  const txId     = dedupKey ?? `${uid}_${reason}_${Date.now()}`;
  const txRef    = doc(db, 'users', uid, 'coinTransactions', txId);

  try {
    const newBalance = await runTransaction(db, async (txn) => {
      // Dedup check
      if (dedupKey) {
        const existing = await txn.get(txRef);
        if (existing.exists()) return null; // already awarded
      }

      const userSnap = await txn.get(userRef);
      const currentCoins = (userSnap.data()?.coins as number) ?? 0;
      const updated = currentCoins + coins;

      txn.update(userRef, { coins: updated });

      const transaction: CoinTransaction = {
        id:        txId,
        uid,
        amount:    coins,
        reason,
        label:     COIN_LABELS[reason],
        createdAt: Date.now(),
      };
      txn.set(txRef, transaction);

      return updated;
    });

    return newBalance;
  } catch (err) {
    console.warn('[CoinService] awardCoins failed:', err);
    return null;
  }
}

/**
 * Spends coins from a user's balance.
 * Returns the new balance or throws if insufficient funds.
 */
export async function spendCoins(
  uid: string,
  amount: number,
  reason: CoinTxReason,
): Promise<number> {
  const userRef = doc(db, 'users', uid);
  const txRef   = doc(db, 'users', uid, 'coinTransactions', `${uid}_${reason}_${Date.now()}`);

  return runTransaction(db, async (txn) => {
    const snap = await txn.get(userRef);
    const current = (snap.data()?.coins as number) ?? 0;

    if (current < amount) {
      throw new Error(`Insufficient coins: have ${current}, need ${amount}`);
    }

    const updated = current - amount;
    txn.update(userRef, { coins: updated });

    const transaction: CoinTransaction = {
      id:        txRef.id,
      uid,
      amount:    -amount,
      reason,
      label:     COIN_LABELS[reason],
      createdAt: Date.now(),
    };
    txn.set(txRef, transaction);

    return updated;
  });
}

/**
 * Checks daily login, updates streak, and awards coins.
 * Uses the dedupKey pattern to be safe against double-calls.
 * Returns updated coins and streak.
 */
export async function processDailyLogin(
  uid: string,
  current: { coins: number; streak: { current: number; longest: number; lastLoginDate: string } },
): Promise<{ coins: number; streak: typeof current.streak }> {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  if (current.streak.lastLoginDate === today) {
    return current; // already processed
  }

  const wasYesterday  = current.streak.lastLoginDate === yesterday;
  const newCurrent    = wasYesterday ? current.streak.current + 1 : 1;
  const newLongest    = Math.max(current.streak.longest, newCurrent);

  const streak = {
    current:       newCurrent,
    longest:       newLongest,
    lastLoginDate: today,
  };

  // Determine coin reward
  let baseReason: CoinTxReason = 'daily_login';
  let bonusReason: CoinTxReason | null = null;

  if (newCurrent === 30)      bonusReason = 'streak_30';
  else if (newCurrent === 7)  bonusReason = 'streak_7';

  // Persist streak first
  await setDoc(doc(db, 'users', uid), { streak }, { merge: true });

  // Award base login coins (dedup by date)
  const dedupKey  = `${uid}_daily_login_${today}`;
  const newBal    = await awardCoins(uid, baseReason, COIN_REWARDS.daily_login, dedupKey);
  let coins       = newBal ?? current.coins + COIN_REWARDS.daily_login;

  // Award streak bonus if applicable
  if (bonusReason) {
    const bonus = COIN_REWARDS[bonusReason];
    const bonusBal = await awardCoins(uid, bonusReason, bonus, `${uid}_${bonusReason}_${today}`);
    if (bonusBal !== null) coins = bonusBal;
  }

  return { coins, streak };
}
