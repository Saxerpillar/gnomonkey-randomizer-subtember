import { pick, type Rng } from '../engine/rng';
import type { Boss } from './DataProvider';

/**
 * Nuzlocke boss selection.
 *
 * A boss is fought exactly once per cycle until the pool is exhausted, then the
 * cycle resets. The `repeatChance` slider trades that away: at 0% every roll is
 * a fresh boss; above 0%, each roll has that chance to land on one already
 * fought instead (which matters once the remaining pool is thin).
 *
 * State is tracked per boss, so the board can show how each fight ended and the
 * streamer can correct it by clicking: `not rolled` (absent), `completed`
 * (cleared) or `uncompleted` (failed). Only "not rolled" bosses are available.
 */

export type BossRollState = 'completed' | 'uncompleted';
/** Boss name -> how that fight ended. Absent = not rolled. */
export type BossStates = Record<string, BossRollState>;

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
