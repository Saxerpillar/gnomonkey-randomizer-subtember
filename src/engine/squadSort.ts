import type { Style } from './roll';
import { SLOTS, type Item, type Loadout, type Slot } from './types';

export interface SquadLane {
  style: Style;
  loadout: Loadout;
}

/**
 * Slots that may move between raid setups.
 *
 * Weapon is excluded because it IS the lane — `rollForStyle` forced it, and
 * moving it would make the Magic setup melee. Ammo is excluded because it is
 * bound to its lane's weapon: bolts in a lane holding a shortbow are useless.
 * Shield is included, but only ever swaps between lanes that already hold one,
 * so a two-hander's empty shield slot is never filled.
 */
export const MOVABLE_SLOTS: Slot[] = SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo');

/**
 * How well one item suits one combat style, higher is better.
 *
 * Offence dominates: an item's attack and damage bonus for the style is what
 * makes it belong there. Defence only breaks ties between items with no
 * offensive lean at all, and follows the combat triangle — hide resists spells
 * so magic defence marks ranged armour, plate resists arrows so ranged defence
 * marks melee armour. Robes carry neither, so magic takes no defensive
 * affinity and simply receives whatever the other two do not want.
 */
export const styleFit = (item: Item, style: Style): number => {
  const off = item.offensive;
  const def = item.defensive;
  const bon = item.bonuses;

  const offence =
    style === 'magic'
      ? Math.max(off.magic, 0) + Math.max(bon.magic_str, 0) / 10
      : style === 'ranged'
        ? Math.max(off.ranged, 0) + Math.max(bon.ranged_str, 0)
        : Math.max(off.stab, off.slash, off.crush, 0) + Math.max(bon.str, 0);

  const affinity =
    style === 'ranged'
      ? Math.max(def.magic, 0)
      : style === 'melee'
        ? Math.max(def.ranged, 0)
        : 0;

  // Offence is scaled well clear of affinity so a real attack bonus always
  // outranks an armour-type hint.
  return offence * 100 + affinity;
};

/** Every ordering of `xs`. Only ever called with at most three items. */
const permutations = <T,>(xs: T[]): T[][] => {
  if (xs.length <= 1) return [xs];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i++) {
    const rest = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutations(rest)) out.push([xs[i], ...p]);
  }
  return out;
};

/**
 * Redistributes the rolled gear across a raid's setups so each lane ends up
 * with the pieces that suit its style, before anything is revealed.
 *
 * Works slot by slot. For one slot it takes the items the lanes rolled, tries
 * every way of dealing them back out, and keeps the arrangement with the best
 * total fit. With three lanes that is six orderings per slot — small enough to
 * solve exactly rather than approximate.
 *
 * Only lanes that actually rolled something for a slot take part, which is what
 * keeps shields honest: a two-handed lane has no shield to trade and never
 * receives one.
 *
 * The team's items are conserved — this deals the same gear out differently, it
 * never rolls anything new. Individual lane values will shift as a result, even
 * though the team total does not.
 */
export const sortSquadByStyle = (squad: readonly SquadLane[]): SquadLane[] => {
  const sorted = squad.map((lane) => ({ style: lane.style, loadout: { ...lane.loadout } }));

  for (const slot of MOVABLE_SLOTS) {
    // Only lanes holding something for this slot trade; the rest keep their gap.
    const holders = sorted.map((lane, i) => ({ i, item: lane.loadout[slot] })).filter((h) => h.item);
    if (holders.length < 2) continue;

    const items = holders.map((h) => h.item as Item);
    let best = items;
    let bestScore = -Infinity;
    for (const order of permutations(items)) {
      const score = order.reduce((sum, item, n) => sum + styleFit(item, sorted[holders[n].i].style), 0);
      if (score > bestScore) {
        bestScore = score;
        best = order;
      }
    }
    holders.forEach((h, n) => {
      sorted[h.i].loadout[slot] = best[n];
    });
  }

  return sorted;
};
