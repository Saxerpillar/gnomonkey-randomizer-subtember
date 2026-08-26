import { shuffled, type Rng } from './rng';
import type { Item, Slot, Tier } from './types';

/**
 * The tier a reveal should use: a per-slot override wins, else the item's own
 * tier. This is the seam chat/subs will drive later (a gifted sub upgrades a
 * slot's tier) — the roll engine itself is untouched.
 */
export const effectiveTier = (item: Item, override?: Tier): Tier => override ?? item.tier;

/**
 * Top-down gear reveal order for the ceremony. Slots are revealed in
 * equipment-tab order with the weapon + shield landing together as the final
 * jackpot pair (a rolled 2h leaves the shield ghosted). Locked slots are
 * excluded — they're already "owned", never re-rolled.
 */
export const revealBeats = (locked: ReadonlySet<Slot>): Slot[][] => {
  const sequence: Slot[][] = [
    ['head'],
    ['cape'],
    ['neck'],
    ['body'],
    ['legs'],
    ['hands'],
    ['feet'],
    ['ring'],
    ['weapon', 'shield'],
    // Ammo last: it only exists for a ranged weapon, so revealing it earlier
    // would give the weapon away before the jackpot beat.
    ['ammo'],
  ];
  return sequence.map((beat) => beat.filter((s) => !locked.has(s))).filter((beat) => beat.length > 0);
};

/**
 * Builds the slot-machine tape for a slot's roll: `fillers` random same-slot
 * items, then the winner, then a couple of decoy tails so the reel can wobble
 * past the winner before snapping back. `winnerIndex` marks the winner's slot.
 */
export interface Tape<T = Item> {
  items: T[];
  winnerIndex: number;
}

/**
 * Generic over the reel's payload so the boss finale reels on a tape of boss
 * faces with the same machinery the gear slots use. Entries are compared by
 * reference (both pools hand out the same objects the winner came from).
 */
export const buildTape = <T,>(
  candidates: readonly T[],
  final: T,
  rng: Rng,
  fillers: number,
  decoys = 2,
): Tape<T> => {
  const others = shuffled(rng, candidates.filter((c) => c !== final));
  const fill = others.slice(0, fillers);
  const tail = others.slice(fillers, fillers + decoys);
  return { items: [...fill, final, ...tail], winnerIndex: fill.length };
};

/**
 * Decelerating per-tick delays for the tape: each tick is `growth`× longer
 * than the last, sized so the sum lands on `rollMs`. Returns one delay per tick.
 */
export const tapeTickDelays = (totalTicks: number, rollMs: number, growth = 1.08): number[] => {
  if (totalTicks <= 0) return [];
  const g = Math.pow(growth, totalTicks);
  const base = (rollMs * (growth - 1)) / (g - 1);
  const delays: number[] = [];
  let t = base;
  for (let i = 0; i < totalTicks; i++) {
    delays.push(Math.round(t));
    t *= growth;
  }
  return delays;
};
