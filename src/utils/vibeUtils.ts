/**
 * vibeUtils.ts
 * Lightweight vibe compatibility helpers used by UI components.
 *
 * getVibeScore  — returns a 0-100 compatibility % between two VibeProfiles.
 * getConversationStarters — returns exactly 3 rule-based ice-breaker strings
 *   derived from two UserProfiles' shared interests / vibe deltas.
 */

import { UserProfile, VibeProfile } from '../types';

// ─── Vibe Compatibility Score ─────────────────────────────────────────────────

/**
 * Returns a 0–100 compatibility score between two VibeProfiles.
 * Weights:
 *   energy    20 %
 *   social    25 %
 *   adventure 25 %
 *   aesthetic 15 %
 *   shared primaryVibes bonus  15 %   (split across matched vibes, capped)
 *   shared musicTaste bonus    10 %   (bonus on top, total normalised to 100)
 *
 * Returns 0 if either profile is undefined.
 */
export function getVibeScore(a?: VibeProfile, b?: VibeProfile): number {
  if (!a || !b) return 0;

  // Axis similarity: 1 - |a - b|  (both values are 0–1)
  const energySim    = 1 - Math.abs((a.energy    ?? 0.5) - (b.energy    ?? 0.5));
  const socialSim    = 1 - Math.abs((a.social    ?? 0.5) - (b.social    ?? 0.5));
  const adventureSim = 1 - Math.abs((a.adventure ?? 0.5) - (b.adventure ?? 0.5));
  const aestheticSim = 1 - Math.abs((a.aesthetic ?? 0.5) - (b.aesthetic ?? 0.5));

  // Weighted axis score (max = 0.85)
  const axisScore =
    energySim    * 0.20 +
    socialSim    * 0.25 +
    adventureSim * 0.25 +
    aestheticSim * 0.15;

  // Shared primaryVibes bonus (max = 0.15)
  const aVibes = a.primaryVibes ?? [];
  const bVibes = b.primaryVibes ?? [];
  const sharedVibes = aVibes.filter((v) => bVibes.includes(v));
  const vibeBonus = Math.min(sharedVibes.length / Math.max(aVibes.length, 1), 1) * 0.15;

  // Shared musicTaste bonus (max = 0.10)
  const aMusic = a.musicTaste ?? [];
  const bMusic = b.musicTaste ?? [];
  const sharedMusic = aMusic.filter((m) => bMusic.includes(m));
  const musicBonus = Math.min(sharedMusic.length / Math.max(aMusic.length, 1), 1) * 0.10;

  // Total raw (0–1.10), normalised back to 0–100
  const raw = axisScore + vibeBonus + musicBonus;
  return Math.round(Math.min(raw / 1.10, 1) * 100);
}

// ─── Conversation Starters ────────────────────────────────────────────────────

/**
 * Returns exactly 3 distinct conversation starters for two connected users.
 * All logic is rule-based — no API call is made.
 * Returns [] if either profile is undefined/null.
 */
export function getConversationStarters(
  me?: UserProfile | null,
  other?: UserProfile | null,
): string[] {
  if (!me || !other) return [];

  const starters: string[] = [];
  const used = new Set<string>();

  function push(s: string) {
    if (used.has(s) || starters.length >= 3) return;
    used.add(s);
    starters.push(s);
  }

  const myInterests    = me.interests    ?? [];
  const otherInterests = other.interests ?? [];
  const shared = myInterests.filter((i) => otherInterests.includes(i));

  // 1. Shared interests
  if (shared.length >= 2) {
    push(`You're both into ${shared[0]} and ${shared[1]} — what got you started with ${shared[0]}?`);
  } else if (shared.length === 1) {
    push(`You both love ${shared[0]} — what's your favourite ${shared[0]} spot or experience?`);
  }

  // 2. College / work match
  if (me.college && other.college && me.college.toLowerCase() === other.college.toLowerCase()) {
    push(`Oh, you're at ${other.college} too? Small world — what's your favourite hangout there?`);
  } else if (other.college) {
    push(`I see you're at ${other.college} — what's the vibe like there?`);
  } else if (other.work) {
    push(`What's it like working at ${other.work}? Sounds interesting!`);
  }

  // 3. Shared vibes
  const myVibes    = me.vibeProfile?.primaryVibes    ?? [];
  const otherVibes = other.vibeProfile?.primaryVibes ?? [];
  const sharedVibes = myVibes.filter((v) => otherVibes.includes(v));
  if (sharedVibes.length > 0) {
    push(`We're both ${sharedVibes[0]} — what does that usually look like for you on a weekend?`);
  }

  // 4. Shared music taste
  const myMusic    = me.vibeProfile?.musicTaste    ?? [];
  const otherMusic = other.vibeProfile?.musicTaste ?? [];
  const sharedMusic = myMusic.filter((m) => otherMusic.includes(m));
  if (sharedMusic.length > 0) {
    push(`We're both into ${sharedMusic[0]} — any artist you've been loving lately?`);
  }

  // 5. Adventure vibe delta (other is more adventurous)
  const myAdventure    = me.vibeProfile?.adventure    ?? 0.5;
  const otherAdventure = other.vibeProfile?.adventure ?? 0.5;
  if (otherAdventure - myAdventure >= 0.25) {
    push(`You seem like a spontaneous person — what's the most unexpected thing you've done recently?`);
  } else if (myAdventure - otherAdventure >= 0.25) {
    push(`I'm pretty spontaneous — would you ever be up for a last-minute adventure?`);
  }

  // 6. Nightlife style match
  const myNightlife    = me.vibeProfile?.nightlifeStyle;
  const otherNightlife = other.vibeProfile?.nightlifeStyle;
  if (myNightlife && otherNightlife && myNightlife === otherNightlife) {
    const nightlifeLabel: Record<string, string> = {
      club:       'hitting clubs',
      lounge:     'lounges',
      houseparty: 'house parties',
      homebody:   'cosy nights in',
      outdoor:    'outdoor nights',
    };
    push(`We're both into ${nightlifeLabel[myNightlife] ?? myNightlife} — any favourite spots?`);
  }

  // 7. Same city
  if (me.city && other.city && me.city.toLowerCase() === other.city.toLowerCase()) {
    push(`What's your go-to spot in ${other.city}? Always looking for new recommendations!`);
  } else if (other.city) {
    push(`${other.city} sounds cool — what's the best thing about living there?`);
  }

  // 8. Warm generic fallbacks so we always return exactly 3
  const fallbacks = [
    `What's something you've been really excited about lately?`,
    `If you could travel anywhere right now, where would you go?`,
    `What's your idea of a perfect day off?`,
    `Any shows or movies you've been obsessed with recently?`,
    `What's the last new thing you tried and loved?`,
  ];

  for (const fb of fallbacks) {
    if (starters.length >= 3) break;
    push(fb);
  }

  return starters.slice(0, 3);
}
