import { UserProfile } from '../types';
import { MoodPreset, MOOD_WEIGHTS } from '../store/moodStore';

// ─── Match breakdown ──────────────────────────────────────────────────────────

export interface MatchBreakdown {
  sharedInterests:  string[];
  sharedVibes:      string[];
  sharedMusic:      string[];
  sameCity:         boolean;
  sharedIntent:     string[];
  ageDelta:         number;       // absolute age difference (0 = same age)
  nightlifeMatch:   boolean;
  completenessBonus: number;      // 0–5 pts from profile completeness
  dimensions: {                   // 0–100 score per dimension for radar display
    interests:  number;
    vibes:      number;
    music:      number;
    location:   number;
    intent:     number;
    energy:     number;
    vibe_vector: number;
  };
}

// ─── Simple vibe hint (used in profile cards) ─────────────────────────────────

export function vibeHint(me: UserProfile, other: UserProfile): string {
  const myInterests    = me.interests    ?? [];
  const otherInterests = other.interests ?? [];
  const shared = myInterests.filter((i) => otherInterests.includes(i));
  if (shared.length >= 3) return `You both love ${shared.slice(0, 2).join(' & ')} ✨`;
  if (shared.length > 0)  return `Shared interest: ${shared[0]} 🎯`;
  const myVibes    = me.vibeProfile?.primaryVibes    ?? [];
  const otherVibes = other.vibeProfile?.primaryVibes ?? [];
  const sharedVibes = myVibes.filter((v) => otherVibes.includes(v));
  if (sharedVibes.length > 0) return `Same vibe: ${sharedVibes[0]} 🔥`;
  const myMusic    = me.vibeProfile?.musicTaste    ?? [];
  const otherMusic = other.vibeProfile?.musicTaste ?? [];
  const sharedMusic = myMusic.filter((m) => otherMusic.includes(m));
  if (sharedMusic.length > 0) return `Both into ${sharedMusic[0]} 🎵`;
  if (me.city && other.city && me.city.toLowerCase() === other.city.toLowerCase())
    return `You're both in ${me.city} 📍`;
  return 'New kind of connection 🌊';
}

// ─── Dynamic vibe match (mood-weighted, 7-dimension) ─────────────────────────

export function dynamicVibeMatch(
  me: UserProfile,
  other: UserProfile,
  mood: MoodPreset = 'chill',
  moodIntensity: number = 1, // 1–3 multiplier for mood weights
): { score: number; breakdown: MatchBreakdown } {

  const w = MOOD_WEIGHTS[mood];
  // Apply mood intensity — at intensity 1 weights are as-is, at 3 they are 50% stronger
  const intensityFactor = 1 + (moodIntensity - 1) * 0.25; // 1.0 → 1.0 / 2.0 → 1.25 / 3.0 → 1.5
  const wi = (base: number) => base * intensityFactor;

  let score = 0;

  // ── Dimension 1: Numeric vibe vector cosine-like similarity (0–28 pts) ─────
  let vectorScore = 0;
  if (me.vibeProfile && other.vibeProfile) {
    const dims    = ['energy', 'social', 'adventure', 'aesthetic'] as const;
    const weights = [w.energyMatch, w.socialMatch, w.adventureMatch, w.aestheticMatch];
    dims.forEach((dim, i) => {
      const diff = Math.abs((me.vibeProfile![dim] ?? 0.5) - (other.vibeProfile![dim] ?? 0.5));
      vectorScore += (1 - diff) * wi(weights[i]) * 7;
    });
    vectorScore = Math.min(vectorScore, 28);
    score += vectorScore;
  }

  // ── Dimension 2: Interest overlap (0–25 pts) ─────────────────────────────
  const sharedInterests = (me.interests ?? []).filter((i) => (other.interests ?? []).includes(i));
  const interestScore = Math.min(sharedInterests.length * 5 * wi(w.interestBonus), 25);
  score += interestScore;

  // ── Dimension 3: Vibe label overlap (0–18 pts) ───────────────────────────
  const sharedVibes = (me.vibeProfile?.primaryVibes ?? []).filter((v) =>
    (other.vibeProfile?.primaryVibes ?? []).includes(v),
  );
  const vibeScore = Math.min(sharedVibes.length * 6 * wi(w.vibeBonus), 18);
  score += vibeScore;

  // ── Dimension 4: Music taste (0–10 pts) ──────────────────────────────────
  const sharedMusic = (me.vibeProfile?.musicTaste ?? []).filter((m) =>
    (other.vibeProfile?.musicTaste ?? []).includes(m),
  );
  const musicScore = Math.min(sharedMusic.length * 4 * wi(w.musicBonus), 10);
  score += musicScore;

  // ── Dimension 5: Location (0–8 pts) ──────────────────────────────────────
  const sameCity =
    !!(me.city && other.city && me.city.toLowerCase() === other.city.toLowerCase());
  const locationScore = sameCity ? 8 * wi(w.locationBonus) : 0;
  score += locationScore;

  // ── Dimension 6: Intent alignment (0–7 pts) ──────────────────────────────
  const sharedIntent = (me.lookingFor ?? []).filter((f) => (other.lookingFor ?? []).includes(f));
  const intentScore = sharedIntent.length > 0 ? 7 * wi(w.intentBonus) : 0;
  score += intentScore;

  // ── Dimension 7: Age proximity (0–4 pts) ─────────────────────────────────
  // Closer ages → higher score; max bonus at 0 age diff, 0 bonus at 10+ years diff
  const ageDelta = (me.age && other.age) ? Math.abs(me.age - other.age) : 10;
  const ageScore = Math.max(0, 4 - ageDelta * 0.4);
  score += ageScore;

  // ── Dimension 8: Nightlife style match (0–5 pts) ──────────────────────────
  const nightlifeMatch =
    !!(me.vibeProfile?.nightlifeStyle &&
       other.vibeProfile?.nightlifeStyle &&
       me.vibeProfile.nightlifeStyle === other.vibeProfile.nightlifeStyle);
  if (nightlifeMatch) score += 5;

  // ── Dimension 9: Profile completeness bonus (0–5 pts) ─────────────────────
  // Reward profiles that have filled in more information (more signal → more reliable match)
  const otherCompleteness = other.profileCompleteness ?? 0;
  const completenessBonus = Math.round((otherCompleteness / 100) * 5);
  score += completenessBonus;

  // ── Normalise to 0–99 ────────────────────────────────────────────────────
  // Max theoretical: 28+25+18+10+8+7+4+5+5 = 110 → scale to 99
  const MAX_RAW = 110;
  const finalScore = Math.round(Math.min((score / MAX_RAW) * 99, 99));

  // ── Per-dimension 0–100 for radar chart in profile detail ─────────────────
  const dimensions: MatchBreakdown['dimensions'] = {
    interests:   Math.round(Math.min(interestScore / 25 * 100, 100)),
    vibes:       Math.round(Math.min(vibeScore     / 18 * 100, 100)),
    music:       Math.round(Math.min(musicScore    / 10 * 100, 100)),
    location:    sameCity ? 100 : 0,
    intent:      sharedIntent.length > 0 ? Math.round(Math.min(intentScore / 7 * 100, 100)) : 0,
    energy:      Math.round(Math.min(vectorScore   / 28 * 100, 100)),
    vibe_vector: Math.round(Math.min(vectorScore   / 28 * 100, 100)),
  };

  return {
    score: finalScore,
    breakdown: {
      sharedInterests,
      sharedVibes,
      sharedMusic,
      sameCity,
      sharedIntent,
      ageDelta,
      nightlifeMatch,
      completenessBonus,
      dimensions,
    },
  };
}

// ─── Badge colour & tier based on score ───────────────────────────────────────

export type MatchTier = 'legendary' | 'high' | 'good' | 'low' | 'none';

export function getMatchTier(score: number): MatchTier {
  if (score >= 90) return 'legendary';
  if (score >= 75) return 'high';
  if (score >= 50) return 'good';
  if (score > 0)   return 'low';
  return 'none';
}

export function matchBadgeColor(score: number): { bg: string; text: string; emoji: string; label: string } {
  if (score >= 90) return { bg: '#FF4B6E', text: '#fff', emoji: '🔥', label: 'Legendary' };
  if (score >= 75) return { bg: '#6C5CE7', text: '#fff', emoji: '💜', label: 'High' };
  if (score >= 50) return { bg: '#0984E3', text: '#fff', emoji: '💙', label: 'Good' };
  return { bg: '#888',     text: '#fff', emoji: '',   label: 'Low' };
}

// ─── Score a list and return sorted ───────────────────────────────────────────

export function rankByVibe(
  me: UserProfile,
  others: UserProfile[],
  mood: MoodPreset,
  moodIntensity = 1,
): Array<{ user: UserProfile; score: number; breakdown: MatchBreakdown }> {
  return others
    .map((user) => {
      const { score, breakdown } = dynamicVibeMatch(me, user, mood, moodIntensity);
      return { user, score, breakdown };
    })
    .sort((a, b) => b.score - a.score);
}
