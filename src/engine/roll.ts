import { costOf, emptyLoadout, SLOTS, type Item, type Loadout, type RollSettings, type Slot } from './types';
import { pick, shuffled, type Rng } from './rng';

/**
 * Pure gear roller (design doc: docs/plans/2026-07-28-gnome-subtember-design.md).
 *
 * Order: weapon first (first claim on the budget), then the remaining unlocked
 * slots in random order. Each slot picks uniformly among candidates costing no
 * more than the remaining budget (untradeables and locks cost 0); no affordable
 * candidate leaves the slot empty. A two-handed weapon empties the shield slot;
 * a locked shield excludes two-handed weapons; ammo is constrained by the
 * weapon's required ammo class.
 *
 * Locks are assumed non-contradictory (the UI resolves 2h-vs-shield conflicts
 * before rolling ever happens).
 */
export const roll = (pool: Item[], settings: RollSettings, rng: Rng): Loadout => {
  const { budget, allowUntradeables, locks } = settings;

  const available = allowUntradeables ? pool : pool.filter((i) => i.tradeable);
  const bySlot = new Map<Slot, Item[]>(SLOTS.map((s) => [s, []]));
  for (const item of available) bySlot.get(item.slot)!.push(item);

  const loadout = emptyLoadout();
  for (const slot of SLOTS) {
    const locked = locks[slot];
    if (locked) loadout[slot] = locked;
  }

  let remaining = budget ?? Infinity;

  const rollSlot = (slot: Slot, candidates: Item[]): void => {
    const affordable = candidates.filter((i) => costOf(i) <= remaining);
    if (affordable.length === 0) return; // stays empty by design
    const item = pick(rng, affordable);
    loadout[slot] = item;
    remaining -= costOf(item);
  };

  // Weapon first.
  if (!locks.weapon) {
    let weapons = bySlot.get('weapon')!;
    if (locks.shield) weapons = weapons.filter((w) => !w.twoHanded);
    rollSlot('weapon', weapons);
  }

  // A 2h weapon (rolled or locked) claims the shield slot.
  const twoHanded = loadout.weapon?.twoHanded ?? false;
  if (twoHanded && !locks.shield) loadout.shield = null;

  const rest = SLOTS.filter(
    (s) => s !== 'weapon' && !locks[s] && !(s === 'shield' && twoHanded),
  );

  for (const slot of shuffled(rng, rest)) {
    let candidates = bySlot.get(slot)!;
    if (slot === 'ammo') {
      const need = loadout.weapon?.requiredAmmo;
      if (need) candidates = candidates.filter((a) => a.ammoClass === need);
    }
    rollSlot(slot, candidates);
  }

  return loadout;
};

/** GE value of everything equipped (locked included) — the informational readout. */
export const loadoutValue = (loadout: Loadout): number =>
  SLOTS.reduce((sum, s) => {
    const item = loadout[s];
    return sum + (item && item.tradeable ? (item.price ?? 0) : 0);
  }, 0);
