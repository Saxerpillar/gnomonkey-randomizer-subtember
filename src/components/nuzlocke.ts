import { pick, type Rng } from '../engine/rng';
import type { Boss } from './DataProvider';

/**
 * Nuzlocke boss selection.
 *
 * A boss is fought exactly once per cycle until the pool is exhausted, then the
 * cycle resets. The `repeatChance` slider trades that away: at 0% every roll is
 * a fresh boss; above 0%, each roll has that chance to land on one already
 * fought instead (which matters once the remaining pool is thin).
 */

/** The bosses still eligible this cycle: the pool minus what's been fought. */
export const unusedBosses = (pool: readonly Boss[], used: readonly string[]): Boss[] =>
  pool.filter((b) => !used.includes(b.name));

/**
 * Roll a boss under the Nuzlocke rule.
 *
 * - `repeatChance` is 0..1; `rng()` returning below it means "repeat".
 * - Nothing to repeat on the first roll (or after a reset), so a repeat draw
 *   falls through to a fresh boss regardless of the slider.
 * - An exhausted pool resets the cycle so rolling can continue.
 *
 * Returns the boss and the next `used` list to persist.
 */
export const rollNuzlockeBoss = (
  pool: readonly Boss[],
  used: readonly string[],
  repeatChance: number,
  rng: Rng,
): { boss: Boss; used: string[] } => {
  const unused = unusedBosses(pool, used);
  const fresh = unused.length === 0;
  const usedPool = fresh ? [] : pool.filter((b) => used.includes(b.name));
  const candidates = fresh ? pool : unused;
  const repeat = usedPool.length > 0 && rng() < repeatChance;
  const boss = pick(rng, repeat ? usedPool : candidates);
  return { boss, used: fresh ? [boss.name] : [...new Set([...used, boss.name])] };
};
