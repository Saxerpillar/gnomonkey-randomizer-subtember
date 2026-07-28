import {
  costOf,
  emptyLoadout,
  SLOTS,
  TIERS,
  type Item,
  type Loadout,
  type RollSettings,
  type Slot,
  type Tier,
} from './types';
import { pick, shuffled, type Rng } from './rng';

/**
 * Tier weights: chaotic but not bullshit. The weapon decides the run (OSRS is
 * weapon-heavy), so its table is strict — junk weapons are a rare punchline.
 * Armour matters far less, so its table stays looser and chaos survives there.
 * Sampling picks a tier (renormalized over tiers that actually have affordable
 * candidates), then uniform within the tier.
 */
export const WEAPON_TIER_WEIGHTS: Record<Tier, number> = {
  junk: 2,
  common: 18,
  decent: 40,
  strong: 30,
  elite: 10,
};
export const DEFAULT_TIER_WEIGHTS: Record<Tier, number> = {
  junk: 10,
  common: 30,
  decent: 35,
  strong: 20,
  elite: 5,
};

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

    // Tier-then-item: weighted tier pick over tiers with candidates, uniform within.
    const weights = slot === 'weapon' ? WEAPON_TIER_WEIGHTS : DEFAULT_TIER_WEIGHTS;
    const byTier = new Map<Tier, Item[]>();
    for (const i of affordable) {
      const t = i.tier ?? 'common';
      byTier.set(t, [...(byTier.get(t) ?? []), i]);
    }
    const present = TIERS.filter((t) => byTier.has(t));
    const total = present.reduce((s, t) => s + weights[t], 0);
    let r = rng() * total;
    let chosen = present[present.length - 1];
    for (const t of present) {
      r -= weights[t];
      if (r < 0) {
        chosen = t;
        break;
      }
    }
    const item = pick(rng, byTier.get(chosen)!);
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
      candidates = need
        ? candidates.filter((a) => a.ammoClass === need)
        : // no ammo requirement -> cosmetic pool, minus weapon-exclusive ammo
          // (atlatl darts with a blowpipe was the reported nonsense pairing)
          candidates.filter((a) => !a.ammoExclusive);
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
