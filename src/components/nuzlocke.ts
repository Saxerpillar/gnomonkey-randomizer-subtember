import { pick, type Rng } from '../engine/rng';
import type { Boss } from './DataProvider';

/**
 * Nuzlocke boss selection.
 *
 * A boss is fought exactly once per cycle until the pool is exhausted, then the
 * cycle resets. Every roll draws a fresh boss — no repeat slider.
 *
 * State is tracked per boss, so the board can show how each fight ended and the
 * streamer can correct it by clicking: `not rolled` (absent), `completed` or
 * `failed`. Only "not rolled" bosses are available.
 */

export type BossRollState = 'completed' | 'failed';
/** Boss name -> how that fight ended. Absent = not rolled. */
export type BossStates = Record<string, BossRollState>;

/**
 * The current nuzlocke run. `id` is null until the first roll commits. The run
 * is effectively paused by leaving the Nuzlocke view (which unlocks the
 * gameplay settings) and resumed by entering it — no explicit flag needed.
 */
export interface NuzlockeRun {
  states: BossStates;
  /** Stable id, used to group history runs and resolve a user-editable name. */
  id: string | null;
}

/** The default label for a nuzlocke before the streamer renames it. */
export const nuzlockeLabel = (id: string): string => `Nuzlocke ${id}`;

/** The bosses still eligible this cycle: the pool minus anything already rolled. */
export const availableBosses = (pool: readonly Boss[], states: BossStates): Boss[] =>
  pool.filter((b) => !(b.name in states));

/**
 * Roll a boss under the Nuzlocke rule.
 *
 * - `repeatChance` is 0..1; `rng()` returning below it means "repeat".
 * - Nothing to repeat on the first roll (or after a reset), so a repeat draw
 *   falls through to a fresh boss regardless of the slider.
 * - An exhausted pool resets the cycle so rolling can continue.
 *
 * Returns the boss and the next `states` map to persist.
 */
export const rollNuzlockeBoss = (
  pool: readonly Boss[],
  states: BossStates,
  repeatChance: number,
  rng: Rng,
): { boss: Boss; states: BossStates } => {
  const unused = availableBosses(pool, states);
  const fresh = unused.length === 0;
  const usedPool = fresh ? [] : pool.filter((b) => b.name in states);
  const candidates = fresh ? pool : unused;
  const repeat = usedPool.length > 0 && rng() < repeatChance;
  const boss = pick(rng, repeat ? usedPool : candidates);
  return {
    boss,
    states: fresh
      ? { [boss.name]: 'completed' }
      : { ...states, [boss.name]: 'completed' },
  };
};
