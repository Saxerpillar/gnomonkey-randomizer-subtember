import type { Rng } from '../engine/rng';
import { pick } from '../engine/rng';
import type { ForceChallenge } from './settings';

export type Difficulty = 'easy' | 'mid' | 'hard';

/**
 * A rolled extra challenge. `timerSeconds` marks the timed one, which the panel
 * renders as a live mm:ss countdown instead of a static line.
 */
export interface Challenge {
  text: string;
  timerSeconds?: number;
}

/**
 * Curated simple challenges. Kept style-agnostic on purpose: the gear roll
 * decides your combat style, so anything that locks a style ("Melee only")
 * could land as an impossible run. Extend freely.
 */
export const CHALLENGES = [
  'No protection prayers',
  'No supplies',
  'No running allowed',
  "Don't fall below 90 HP",
  "Don't go above 10 HP",
  'No movement allowed',
  '10 tile budget',
  'No F-keys',
  'Fullscreen & Stretched Mode disabled',
  'Entity Hider > Hide Attacker',
] as const;

/**
 * The Gauntlets take no gear in, so they get their own pool instead of the
 * generic one — and they ALWAYS draw a challenge. The per-boss lines stack on
 * top of the shared ones.
 */
export const GAUNTLET_SHARED = [
  'No fish allowed',
  'No prayer drain or egniol potions',
  'No running',
  'Fullscreen & Stretched Mode disabled',
  'Entity Hider > Hide Attacker',
] as const;

export const GAUNTLET_ONLY: Record<string, readonly string[]> = {
  'Corrupted Hunllef': ['Defeat your foe in 5:15', 'Tier 1 weapons only'],
  'Crystalline Hunllef': ['Defeat your foe in 3:15', 'Tier 2 weapons only'],
};

/**
 * Gauntlet challenge — guaranteed, drawn only from that boss's pool. The
 * "defeat in m:ss" lines are deliberately plain text, not live countdowns.
 */
export const rollGauntletChallenge = (rng: Rng, bossName: string): Challenge => {
  const options = [...(GAUNTLET_ONLY[bossName] ?? []), ...GAUNTLET_SHARED];
  return { text: pick(rng, options) };
};

/** Kill-timer allowance per difficulty — harder fights get longer. */
export const TIME_LIMIT_SECONDS: Record<Difficulty, number> = {
  easy: 5 * 60,
  mid: 10 * 60,
  hard: 20 * 60,
};

/**
 * How often a run gets an extra challenge, by boss difficulty: easier fights
 * can carry more punishment, so they draw one more often.
 */
export const CHALLENGE_CHANCE: Record<Difficulty, number> = {
  easy: 0.35,
  mid: 0.25,
  hard: 0.15,
};

/** The difficulty tag a boss carries (every boss has exactly one). */
export const difficultyOf = (tags: readonly string[]): Difficulty =>
  tags.includes('easy') ? 'easy' : tags.includes('hard') ? 'hard' : 'mid';

/** mm:ss, the way the countdown reads on screen. */
export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** The timed challenge for a difficulty — 5/10/20 minutes on the clock. */
export const timedChallenge = (difficulty: Difficulty): Challenge => {
  const limit = TIME_LIMIT_SECONDS[difficulty];
  return { text: `Defeat your foe within ${limit / 60} mins`, timerSeconds: limit };
};

/**
 * Roll an extra challenge for a boss of this difficulty, or null. The timed
 * challenge sits in the same pool as the rest; its allowance scales with
 * difficulty (5/10/20 minutes).
 *
 * `force`: 'any' skips the chance roll, 'timed' pins the countdown outright so
 * the clock can be tested without fishing for it.
 */
export const rollChallenge = (
  rng: Rng,
  difficulty: Difficulty,
  force: ForceChallenge = 'off',
): Challenge | null => {
  if (force === 'timed') return timedChallenge(difficulty);
  if (force === 'off' && rng() >= CHALLENGE_CHANCE[difficulty]) return null;
  const options: Challenge[] = [
    ...CHALLENGES.map((text) => ({ text })),
    timedChallenge(difficulty),
  ];
  return pick(rng, options);
};
