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
 * Tier-then-item sampling for one slot: weighted tier pick over the tiers that
 * actually have affordable candidates, then uniform within that tier. Returns
 * null when nothing is affordable (the slot stays empty by design).
 */
const pickForSlot = (slot: Slot, candidates: Item[], remaining: number, rng: Rng): Item | null => {
  const affordable = candidates.filter((i) => costOf(i) <= remaining);
  if (affordable.length === 0) return null;

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
  return pick(rng, byTier.get(chosen)!);
};

/**
 * Ammo the given weapon can actually fire. Matching the family is not enough:
 * a bronze crossbow cannot load runite bolts, so the ammo's tier must also be
 * within the weapon's ceiling (the wiki's "up to X" rule). Weapons that need
 * no ammo get the cosmetic pool, minus anything weapon-exclusive.
 */
export const ammoCandidatesFor = (weapon: Item | null, ammo: Item[]): Item[] => {
  // Only a ranged weapon that actually consumes ammo gets any: no more
  // decorative arrows tucked behind a whip.
  const need = weapon?.requiredAmmo;
  if (!need) return [];
  const max = weapon?.ammoMaxTier;
  return ammo.filter((a) => a.ammoClass === need && (max == null || (a.ammoTier ?? 0) <= max));
};

const poolBySlot = (pool: Item[], allowUntradeables: boolean): Map<Slot, Item[]> => {
  const available = allowUntradeables ? pool : pool.filter((i) => i.tradeable);
  const bySlot = new Map<Slot, Item[]>(SLOTS.map((s) => [s, []]));
  for (const item of available) bySlot.get(item.slot)!.push(item);
  return bySlot;
};

/**
 * Pure gear roller (design doc: docs/plans/2026-07-28-gnome-subtember-design.md).
 *
 * Order: weapon first (first claim on the budget), then the remaining unlocked
 * slots in random order, and finally ammo — which only rolls when the weapon
 * consumes it. Each slot picks uniformly among candidates costing no more than
 * the remaining budget (untradeables and locks cost 0); no affordable candidate
 * leaves the slot empty. A two-handed weapon empties the shield slot; a locked
 * shield excludes two-handed weapons; ammo must match the weapon's family and
 * sit within its tier ceiling.
 *
 * Locks are assumed non-contradictory (the UI resolves 2h-vs-shield conflicts
 * before rolling ever happens).
 */
export const roll = (pool: Item[], settings: RollSettings, rng: Rng): Loadout => {
  const { budget, allowUntradeables, locks } = settings;
  const bySlot = poolBySlot(pool, allowUntradeables);

  const loadout = emptyLoadout();
  for (const slot of SLOTS) {
    const locked = locks[slot];
    if (locked) loadout[slot] = locked;
  }

  let remaining = budget ?? Infinity;

  const rollSlot = (slot: Slot, candidates: Item[]): void => {
    const item = pickForSlot(slot, candidates, remaining, rng);
    if (!item) return; // stays empty by design
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
    (s) => s !== 'weapon' && s !== 'ammo' && !locks[s] && !(s === 'shield' && twoHanded),
  );

  for (const slot of shuffled(rng, rest)) rollSlot(slot, bySlot.get(slot)!);

  // Ammo goes last and only exists at all when the rolled weapon needs it, so
  // it never competes with armour for the budget on a melee run.
  if (!locks.ammo) {
    const candidates = ammoCandidatesFor(loadout.weapon, bySlot.get('ammo')!);
    if (candidates.length) rollSlot('ammo', candidates);
  }

  return loadout;
};

/**
 * Reroll ONE slot in place, leaving every other slot alone.
 *
 * Budget: the other rolled items keep their claim, so this slot may spend
 * whatever is left (locked items cost 0, same rule as a full roll). Validity is
 * preserved as in a full roll — a new two-handed weapon clears the shield, and
 * ammo the new weapon cannot fire is dropped. Rerolling the shield while a
 * two-handed weapon is equipped is a no-op (the slot is genuinely unusable).
 */
export const rerollSlot = (
  pool: Item[],
  loadout: Loadout,
  slot: Slot,
  settings: RollSettings,
  rng: Rng,
): Loadout => {
  const { budget, allowUntradeables, locks } = settings;
  const bySlot = poolBySlot(pool, allowUntradeables);

  const twoHandedNow = loadout.weapon?.twoHanded ?? false;
  if (slot === 'shield' && twoHandedNow) return loadout;

  // What the OTHER rolled (unlocked) slots already claimed.
  const spentElsewhere = SLOTS.reduce((sum, s) => {
    if (s === slot) return sum;
    const item = loadout[s];
    return sum + (item && !locks[s] ? costOf(item) : 0);
  }, 0);
  const remaining = budget == null ? Infinity : Math.max(0, budget - spentElsewhere);

  let candidates = bySlot.get(slot)!;
  if (slot === 'weapon' && locks.shield) candidates = candidates.filter((w) => !w.twoHanded);
  if (slot === 'ammo') candidates = ammoCandidatesFor(loadout.weapon, candidates);

  const item = pickForSlot(slot, candidates, remaining, rng);
  if (!item) return loadout; // nothing affordable/valid — leave it as it was

  const next: Loadout = { ...loadout, [slot]: item };

  if (slot === 'weapon') {
    // A new 2h claims the shield slot; ammo the new weapon cannot fire is dropped.
    if (item.twoHanded && !locks.shield) next.shield = null;
    const ammo = next.ammo;
    if (ammo && !locks.ammo && !ammoCandidatesFor(item, [ammo]).length) next.ammo = null;
  }

  return next;
};

/** GE value of everything equipped (locked included) — the informational readout. */
export const loadoutValue = (loadout: Loadout): number =>
  SLOTS.reduce((sum, s) => {
    const item = loadout[s];
    return sum + (item && item.tradeable ? (item.price ?? 0) : 0);
  }, 0);

/** Combat style a weapon category belongs to, for style-forced rolls (raids). */
export type Style = 'melee' | 'ranged' | 'magic';

const STYLE_BY_CATEGORY: Record<string, Style> = {
  // melee
  'Slash Sword': 'melee',
  'Stab Sword': 'melee',
  '2h Sword': 'melee',
  Blunt: 'melee',
  blunt: 'melee',
  Axe: 'melee',
  Spear: 'melee',
  Spiked: 'melee',
  Claw: 'melee',
  Polearm: 'melee',
  Whip: 'melee',
  Bludgeon: 'melee',
  Scythe: 'melee',
  Flail: 'melee',
  Partisan: 'melee',
  'Multi-Melee': 'melee',
  Pickaxe: 'melee',
  Bulwark: 'melee',
  Unarmed: 'melee',
  // ranged
  Bow: 'ranged',
  Crossbow: 'ranged',
  Thrown: 'ranged',
  Chinchompas: 'ranged',
  Gun: 'ranged',
  Blaster: 'ranged',
  Salamander: 'ranged',
  // magic
  Staff: 'magic',
  'Bladed Staff': 'magic',
  'Powered Staff': 'magic',
  Polestaff: 'magic',
};

export const styleOf = (item: Item): Style | null =>
  item.category ? (STYLE_BY_CATEGORY[item.category] ?? null) : null;

/**
 * Roll a loadout whose weapon is forced to a combat style — raids hand the
 * team one setup per style. Everything else (budget, tiers, ammo, 2h/shield)
 * behaves exactly as a normal roll.
 */
export const rollForStyle = (
  pool: Item[],
  style: Style,
  settings: RollSettings,
  rng: Rng,
): Loadout => {
  const styled = pool.filter((i) => i.slot !== 'weapon' || styleOf(i) === style);
  return roll(styled, settings, rng);
};
