import {
  costOf,
  emptyLoadout,
  SLOTS,
  TIERS,
  CORE_SLOTS,
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

/** Weapon-floor tier splits, keyed by the floor set from the boss's
 *  difficulty: medium floors at decent (50/35/15), hard at strong (75/25). */
const FLOOR_WEIGHTS: Record<Tier, Record<Tier, number>> = {
  decent: { junk: 0, common: 0, decent: 50, strong: 35, elite: 15 },
  strong: { junk: 0, common: 0, decent: 0, strong: 75, elite: 25 },
  junk: { junk: 0, common: 0, decent: 0, strong: 0, elite: 0 },
  common: { junk: 0, common: 0, decent: 0, strong: 0, elite: 0 },
  elite: { junk: 0, common: 0, decent: 0, strong: 0, elite: 0 },
};

/**
 * Tier-then-item sampling for one slot: weighted tier pick over the tiers that
 * actually have affordable candidates, then uniform within that tier. Returns
 * null when nothing is affordable (the slot stays empty by design).
 *
 * `minTier` (weapons on mid/hard fights): candidates below it are out, and the
 * draw across the remaining upper tiers follows the floor's split. When
 * nothing affordable reaches the floor, the pick degrades to whatever is
 * affordable rather than leaving the slot empty.
 */
const pickForSlot = (
  slot: Slot,
  candidates: Item[],
  remaining: number,
  rng: Rng,
  tierBias = 1,
  minTier?: Tier,
): Item | null => {
  const affordable = candidates.filter((i) => costOf(i) <= remaining);
  if (affordable.length === 0) return null;

  const minRank = minTier != null ? TIERS.indexOf(minTier) : -1;
  const eligible =
    slot === 'weapon' && minRank >= 0
      ? affordable.filter((i) => TIERS.indexOf(i.tier ?? 'common') >= minRank)
      : affordable;
  const pool = eligible.length > 0 ? eligible : affordable;

  const base = slot === 'weapon' ? WEAPON_TIER_WEIGHTS : DEFAULT_TIER_WEIGHTS;
  // Compounding up the ladder: junk is untouched, elite gets bias^4. That keeps
  // the tables' shape and only leans on it, rather than replacing them per
  // difficulty and having three sets of numbers to keep in agreement.
  const weights =
    tierBias === 1
      ? base
      : (Object.fromEntries(
          TIERS.map((t, rank) => [t, base[t] * tierBias ** rank]),
        ) as Record<Tier, number>);
  // A weapon floor replaces the weighted draw with its own split.
  const floorWeights = minTier != null ? FLOOR_WEIGHTS[minTier] : undefined;
  const finalWeights =
    floorWeights != null && pool === eligible ? floorWeights : weights;
  const byTier = new Map<Tier, Item[]>();
  for (const i of pool) {
    const t = i.tier ?? 'common';
    byTier.set(t, [...(byTier.get(t) ?? []), i]);
  }
  const present = TIERS.filter((t) => byTier.has(t));
  const total = present.reduce((s, t) => s + finalWeights[t], 0);
  let r = rng() * total;
  let chosen = present[present.length - 1];
  for (const t of present) {
    r -= finalWeights[t];
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
 * Order: weapon first (first claim on the budget), then the remaining slots in
 * random order, and finally ammo — which only rolls when the weapon consumes
 * it. Each slot picks uniformly among candidates costing no more than the
 * remaining budget (untradeables cost 0); no affordable candidate leaves the
 * slot empty. A two-handed weapon empties the shield slot; ammo must match the
 * weapon's family and sit within its tier ceiling.
 */
/**
 * Decides which core slots owe which tier, before any rolling happens.
 *
 * Rarest first: an elite floor has the fewest slots able to satisfy it, so it
 * has to claim its slots before a common floor takes them. A floor asking for
 * more slots than the pool can serve simply gets as many as exist — the roll
 * degrades rather than failing.
 */
export const assignTierFloors = (
  floors: Partial<Record<Tier, number>>,
  bySlot: Map<Slot, Item[]>,
  rng: Rng,
): Map<Slot, Tier> => {
  const assigned = new Map<Slot, Tier>();
  const free = [...CORE_SLOTS];
  for (const tier of [...TIERS].reverse()) {
    let need = floors[tier] ?? 0;
    if (need <= 0) continue;
    const eligible = shuffled(
      rng,
      free.filter(
        (s) => !assigned.has(s) && (bySlot.get(s) ?? []).some((i) => (i.tier ?? 'common') === tier),
      ),
    );
    for (const s of eligible) {
      if (need <= 0) break;
      assigned.set(s, tier);
      need -= 1;
    }
  }
  return assigned;
};

/**
 * Decides a weapon's poison AFTER it has been rolled, by an even draw between
 * the clean version and each poisoned one.
 *
 * Keeping the variants off the pool and resolving them here is the whole point:
 * the odds of rolling a rune dagger at all are exactly what they were before
 * poison existed, and only then does a second, independent draw decide whether
 * it is poisoned. Adding 141 poisoned weapons as their own entries would have
 * quietly tripled how often the dagger and spear families come up.
 *
 * The variant swaps identity only — id, name, sprite. Stats, price and tier
 * stay the base weapon's, so the budget, the tier weights and the ammo rules
 * never notice the substitution.
 */
export const withPoison = (item: Item, rng: Rng): Item => {
  if (!item.poison?.length) return item;
  const choice = Math.floor(rng() * (item.poison.length + 1));
  if (choice === 0) return item;
  const v = item.poison[choice - 1];
  return { ...item, id: v.id, name: v.name, icon: v.icon };
};

export const roll = (pool: Item[], settings: RollSettings, rng: Rng): Loadout => {
  const { budget, allowUntradeables, tierFloors, tierBias } = settings;
  const bySlot = poolBySlot(pool, allowUntradeables);
  const floored = tierFloors ? assignTierFloors(tierFloors, bySlot, rng) : new Map();

  const loadout = emptyLoadout();

  let remaining = budget ?? Infinity;

  const rollSlot = (slot: Slot, candidates: Item[]): void => {
    const owed = floored.get(slot);
    // A weapon floor below the minimum is overruled by it (a hard fight never
    // gets a junk weapon just because a floor asked for one).
    const floorApplies =
      owed != null &&
      (slot !== 'weapon' ||
        settings.minWeaponTier == null ||
        TIERS.indexOf(owed) >= TIERS.indexOf(settings.minWeaponTier));
    if (floorApplies) {
      const atTier = candidates.filter((i) => (i.tier ?? 'common') === owed);
      if (atTier.length) {
        // Prefer one we can actually afford; overspend only when the tier has
        // nothing within budget, since a floor outranks the cap by design.
        const affordable = atTier.filter((i) => costOf(i) <= remaining);
        const item = pick(rng, affordable.length ? affordable : atTier);
        loadout[slot] = item;
        // Never let an overspend go negative and silently starve later slots of
        // more than it actually cost.
        remaining = Math.max(0, remaining - costOf(item));
        return;
      }
      // This slot has nothing at that tier at all; fall through to a normal roll
      // rather than leaving it empty.
    }
    const item = pickForSlot(
      slot,
      candidates,
      remaining,
      rng,
      tierBias,
      slot === 'weapon' ? settings.minWeaponTier : undefined,
    );
    if (!item) return; // stays empty by design
    loadout[slot] = item;
    remaining -= costOf(item);
  };

  // Weapon first.
  rollSlot('weapon', bySlot.get('weapon')!);

  // A 2h weapon claims the shield slot.
  const twoHanded = loadout.weapon?.twoHanded ?? false;
  if (twoHanded) loadout.shield = null;

  const rest = SLOTS.filter(
    (s) => s !== 'weapon' && s !== 'ammo' && !(s === 'shield' && twoHanded),
  );

  for (const slot of shuffled(rng, rest)) rollSlot(slot, bySlot.get(slot)!);

  // Ammo goes last and only exists at all when the rolled weapon needs it, so
  // it never competes with armour for the budget on a melee run.
  const candidates = ammoCandidatesFor(loadout.weapon, bySlot.get('ammo')!);
  if (candidates.length) rollSlot('ammo', candidates);

  // Poison last of all, once the weapon is settled.
  if (loadout.weapon) loadout.weapon = withPoison(loadout.weapon, rng);

  return loadout;
};

/**
 * Reroll ONE slot in place, leaving every other slot alone.
 *
 * Budget: the other rolled items keep their claim, so this slot may spend
 * whatever is left. Validity is preserved as in a full roll — a new two-handed
 * weapon clears the shield, and ammo the new weapon cannot fire is dropped.
 * Rerolling the shield while a two-handed weapon is equipped is a no-op (the
 * slot is genuinely unusable).
 */
export const rerollSlot = (
  pool: Item[],
  loadout: Loadout,
  slot: Slot,
  settings: RollSettings,
  rng: Rng,
): Loadout => {
  const { budget, allowUntradeables } = settings;
  const bySlot = poolBySlot(pool, allowUntradeables);

  const twoHandedNow = loadout.weapon?.twoHanded ?? false;
  if (slot === 'shield' && twoHandedNow) return loadout;

  // What the OTHER rolled slots already claimed.
  const spentElsewhere = SLOTS.reduce((sum, s) => {
    if (s === slot) return sum;
    const item = loadout[s];
    return sum + (item ? costOf(item) : 0);
  }, 0);
  const remaining = budget == null ? Infinity : Math.max(0, budget - spentElsewhere);

  let candidates = bySlot.get(slot)!;
  if (slot === 'ammo') candidates = ammoCandidatesFor(loadout.weapon, candidates);

  const rolled = pickForSlot(
    slot,
    candidates,
    remaining,
    rng,
    settings.tierBias,
    slot === 'weapon' ? settings.minWeaponTier : undefined,
  );
  if (!rolled) return loadout; // nothing affordable/valid — leave it as it was
  const item = slot === 'weapon' ? withPoison(rolled, rng) : rolled;

  const next: Loadout = { ...loadout, [slot]: item };

  if (slot === 'weapon') {
    // A new 2h claims the shield slot; ammo the new weapon cannot fire is dropped.
    if (item.twoHanded) next.shield = null;
    const ammo = next.ammo;
    if (ammo && !ammoCandidatesFor(item, [ammo]).length) next.ammo = null;
  }

  return next;
};

/** GE value of everything equipped — the informational readout. */
export const loadoutValue = (loadout: Loadout): number =>
  SLOTS.reduce((sum, s) => {
    const item = loadout[s];
    return sum + (item && item.tradeable ? (item.price ?? 0) : 0);
  }, 0);

/**
 * Tier-point score of a loadout, used for wave-based encounters where gear
 * VALUE is meaningless (armour costs don't track survival).
 *
 * junk 0 / common 1 / decent 2 / strong 3 / elite 5, over the nine core slots
 * plus ammo; the weapon counts double. A common-only kit scores the minimum
 * {@link GEAR_SCORE_MIN} and an all-elite kit the maximum
 * {@link GEAR_SCORE_MAX} — the objective power lever scales linearly between.
 */
export const GEAR_SCORE_MIN = 10;
export const GEAR_SCORE_MAX = 55;
/** Doom of Mokhaiotl's ceiling: the main kit at max (55) plus its two extra
 *  weapons at elite (a doubled weapon, +10 each). */
export const GEAR_SCORE_MAX_DOOM = GEAR_SCORE_MAX + 20;
export const gearScore = (loadout: Loadout): number => {
  const POINTS: Record<Tier, number> = { junk: 0, common: 1, decent: 2, strong: 3, elite: 5 };
  let score = 0;
  for (const s of CORE_SLOTS) {
    const item = loadout[s];
    if (!item) continue;
    const p = POINTS[item.tier] ?? 0;
    score += s === 'weapon' ? p * 2 : p;
  }
  const ammo = loadout.ammo;
  if (ammo) score += POINTS[ammo.tier] ?? 0;
  return score;
};

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
 * Restrict a pool's weapons to what a boss permits: any non-melee weapon stays,
 * plus the named melee exceptions. Armour is untouched. Returns the pool
 * unchanged when there is no rule (`null`, or `noMelee` falsy).
 *
 * Drives the "this fight never takes a melee weapon" rules: Kraken allows none
 * at all; Zulrah and Kree'arra keep only the Noxious halberd.
 */
export const filterWeaponsFor = (
  pool: Item[],
  rule: { noMelee?: boolean; meleeExceptions?: string[] } | null,
): Item[] => {
  if (!rule?.noMelee) return pool;
  const exceptions = rule.meleeExceptions ?? [];
  return pool.filter(
    (i) => i.slot !== 'weapon' || styleOf(i) !== 'melee' || exceptions.includes(i.name),
  );
};

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
