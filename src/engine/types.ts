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

export type AmmoClass = 'arrow' | 'bolt' | 'javelin' | 'tar' | 'atlatl' | 'any';

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
  /** Weapons only: the ammo class this weapon needs to fire, if any. */
  requiredAmmo?: Exclude<AmmoClass, 'any'>;
  /** GE price snapshot (midpoint). Absent for untradeables. */
  price?: number;
}

export type Loadout = Record<Slot, Item | null>;

export interface RollSettings {
  /** Max total gp the ROLLED tradeable items may cost. null = no budget. */
  budget: number | null;
  /** When false, untradeable items never roll. */
  allowUntradeables: boolean;
  /** Slots the roller must not touch. Locked items cost 0 against the budget. */
  locks: Partial<Record<Slot, Item>>;
}

export const emptyLoadout = (): Loadout =>
  Object.fromEntries(SLOTS.map((s) => [s, null])) as Loadout;

/** Budget cost of an item: GE price for tradeables, 0 for untradeables. */
export const costOf = (item: Item): number => (item.tradeable ? (item.price ?? 0) : 0);
