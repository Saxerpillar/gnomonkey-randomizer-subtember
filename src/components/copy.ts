import type { Slot } from '../engine/types';

/** One place for all ceremony copy so it's trivially editable. */
export const SLOT_LABEL: Record<Slot, string> = {
  head: 'Helmet',
  cape: 'Cape',
  neck: 'Neck',
  ammo: 'Ammo',
  weapon: 'Weapon',
  body: 'Body',
  shield: 'Shield',
  legs: 'Legs',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
};

export const BOSS_SUSPENSE_LINE = 'Your fate is sealed…';
export const CHALLENGER_SUBTITLE = 'Your Challenger';

/**
 * Alphabetical sort key with leading articles stripped: "The Inferno" sorts as
 * "Inferno", "An" / "A" likewise. Use for every name sort so articles never
 * decide placement.
 */
export const alphaKey = (name: string): string => name.replace(/^(a|an|the)\s+/i, '');

