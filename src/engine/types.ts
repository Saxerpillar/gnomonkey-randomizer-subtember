/** The 11 OSRS equipment slots, in in-game tab order (top to bottom). */
export const SLOTS = [
  'head',
  'cape',
  'neck',
  'ammo',
  'weapon',
  'body',
  'shield',
  'legs',
  'hands',
  'feet',
  'ring',
] as const;

export type Slot = (typeof SLOTS)[number];

/**
 * Ammo family. A weapon fires its own family only, and (for the tiered
 * families) only up to its own tier — the wiki's "up to mithril arrows" rule.
 */
export type AmmoClass =
  | 'arrow'
  | 'bolt'
  | 'javelin'
  | 'tar'
  | 'atlatl'
  // families only their own weapon can fire
  | 'kebbit'
  | 'antler'
  | 'boltrack'
  | 'bone'
  | 'ogre'
  | 'any';

/** Rarity tier, assigned per slot by combat-power percentile at refresh time. */
export type Tier = 'junk' | 'common' | 'decent' | 'strong' | 'elite';
export const TIERS: Tier[] = ['junk', 'common', 'decent', 'strong', 'elite'];

export interface OffensiveBonuses {
  stab: number;
  slash: number;
  crush: number;
  magic: number;
  ranged: number;
}
export interface OtherBonuses {
  str: number;
  ranged_str: number;
  /** Magic damage, percent x10 (50 = +5.0%). */
  magic_str: number;
  prayer: number;
}

/** One rollable item (public/data/equipment.json entry, price joined on at load). */
export interface Item {
  id: number;
  name: string;
  version?: string;
  slot: Slot;
  icon: string;
  tradeable: boolean;
  twoHanded: boolean;
  category?: string;
  /** Ammo-slot items only: what kind of ammo this is ('any' = blessings/misc). */
  ammoClass?: AmmoClass;
  /** Ammo only usable with the weapon that requires its class (atlatl darts,
   *  salamander tars) — never rolls into the cosmetic any-ammo pool. */
  ammoExclusive?: boolean;
  /** Ammo-slot items: metal tier (bronze 1 ... dragon 8). */
  ammoTier?: number;
  /** Weapons: the highest ammo tier this weapon can fire (undefined = any). */
  ammoMaxTier?: number;
  /** Weapons only: the ammo class this weapon needs to fire, if any. */
  requiredAmmo?: Exclude<AmmoClass, 'any'>;
  /**
   * Weapons only: poisoned versions of this exact weapon.
   *
   * They are riders rather than pool entries on purpose. A poisoned weapon is
   * stat-identical to its clean version, so adding all 141 as separate items
   * would inflate the dagger and spear families and change how often a dagger
   * rolls at all. Instead the weapon is rolled at its normal odds and the
   * poison is decided afterwards, by an independent draw.
   */
  poison?: ItemVariant[];
  /** GE price snapshot (midpoint). Absent for untradeables. */
  price?: number;
  /** Rarity tier (per-slot power percentile). */
  tier: Tier;
  /** Weapons only: attack interval in game ticks. */
  speed?: number;
  offensive: OffensiveBonuses;
  defensive: OffensiveBonuses;
  bonuses: OtherBonuses;
}

export type Loadout = Record<Slot, Item | null>;

/** A cosmetic variant of an item: same stats and price, different label and
 *  sprite. Poisoned weapons are the only ones so far. */
export interface ItemVariant {
  id: number;
  name: string;
  icon: string;
}

export interface RollSettings {
  /** Max total gp the ROLLED tradeable items may cost. null = no budget. */
  budget: number | null;
  /** When false, untradeable items never roll. */
  allowUntradeables: boolean;
  /** Slots the roller must not touch. Locked items cost 0 against the budget. */
  locks: Partial<Record<Slot, Item>>;
  /**
   * Bad-RNG mitigation: the minimum number of CORE_SLOTS that must land on each
   * tier. Floors deliberately outrank the budget — a floor you asked for is
   * honoured even when the gp cap cannot afford it.
   */
  tierFloors?: Partial<Record<Tier, number>>;
  /**
   * Skews the tier draw toward better gear, for fights that deserve it.
   *
   * Each tier's weight is multiplied by `tierBias ** rank`, rank counting from
   * junk at 0 to elite at 4 — so the effect compounds up the ladder and never
   * reorders it. 1 leaves the tables exactly as tuned; above 1 lifts the top
   * end and squeezes junk.
   */
  tierBias?: number;
}

/**
 * The nine slots every loadout fills. Shield is empty under a two-handed weapon
 * (39% of them) and ammo only fills for a launcher (7%), so neither can carry a
 * guarantee — tier floors are counted over these nine and nothing else.
 */
export const CORE_SLOTS: Slot[] = [
  'head',
  'cape',
  'neck',
  'body',
  'legs',
  'hands',
  'feet',
  'ring',
  'weapon',
];

export const emptyLoadout = (): Loadout =>
  Object.fromEntries(SLOTS.map((s) => [s, null])) as Loadout;

/** Budget cost of an item: GE price for tradeables, 0 for untradeables. */
export const costOf = (item: Item): number => (item.tradeable ? (item.price ?? 0) : 0);
