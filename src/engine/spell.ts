import { pick, type Rng } from './rng';
import type { Item } from './types';

export interface Spell {
  name: string;
  icon: string;
  book: 'standard' | 'ancient' | 'arceuus';
  maxHit: number;
  /** Only castable with one of these staves; rolls only when that weapon rolled. */
  requiresWeapon?: string[];
}

/** Weapon categories that autocast player spells (vs Powered Staff = built-in). */
const CASTABLE_CATEGORIES = new Set(['Staff', 'Bladed Staff', 'Polestaff']);

export const isCastableStaff = (weapon: Item | null): boolean =>
  weapon != null && CASTABLE_CATEGORIES.has(weapon.category ?? '');

export const isPoweredStaff = (weapon: Item | null): boolean =>
  weapon?.category === 'Powered Staff';

/**
 * Roll the spell that goes with the rolled weapon.
 * - Castable staff -> a random spell (weapon-locked spells only for their staff).
 * - Powered staff  -> null (its attack is built in; UI says so).
 * - Anything else  -> null.
 */
export const rollSpell = (weapon: Item | null, spells: Spell[], rng: Rng): Spell | null => {
  if (!isCastableStaff(weapon)) return null;
  const eligible = spells.filter(
    (s) => !s.requiresWeapon || s.requiresWeapon.includes(weapon!.name),
  );
  return eligible.length > 0 ? pick(rng, eligible) : null;
};
