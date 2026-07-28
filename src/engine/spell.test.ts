import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import { isPoweredStaff, rollSpell, type Spell } from './spell';
import type { Item, Slot } from './types';

const weapon = (name: string, category?: string): Item => ({
  id: 1,
  name,
  slot: 'weapon' as Slot,
  icon: 'x.png',
  tradeable: true,
  twoHanded: false,
  category,
});

const SPELLS: Spell[] = [
  { name: 'Fire Surge', icon: 'f.png', book: 'standard', maxHit: 24 },
  { name: 'Ice Barrage', icon: 'i.png', book: 'ancient', maxHit: 30 },
  { name: 'Iban Blast', icon: 'ib.png', book: 'standard', maxHit: 25, requiresWeapon: ["Iban's staff"] },
];

const seeds = Array.from({ length: 100 }, (_, i) => i * 31 + 1);

describe('rollSpell', () => {
  it('castable staves roll a spell; weapon-locked spells stay out', () => {
    for (const cat of ['Staff', 'Bladed Staff', 'Polestaff']) {
      const seen = new Set<string>();
      for (const seed of seeds) {
        const s = rollSpell(weapon('Mystic staff', cat), SPELLS, mulberry32(seed));
        expect(s).not.toBeNull();
        seen.add(s!.name);
      }
      expect(seen.has('Iban Blast')).toBe(false);
      expect(seen).toEqual(new Set(['Fire Surge', 'Ice Barrage']));
    }
  });

  it("the locked spell becomes eligible for its own staff", () => {
    const seen = new Set<string>();
    for (const seed of seeds) {
      seen.add(rollSpell(weapon("Iban's staff", 'Staff'), SPELLS, mulberry32(seed))!.name);
    }
    expect(seen.has('Iban Blast')).toBe(true);
  });

  it('powered staves and non-magic weapons roll no spell', () => {
    expect(rollSpell(weapon('Sanguinesti staff', 'Powered Staff'), SPELLS, mulberry32(1))).toBeNull();
    expect(rollSpell(weapon('Abyssal whip', 'Whip'), SPELLS, mulberry32(1))).toBeNull();
    expect(rollSpell(null, SPELLS, mulberry32(1))).toBeNull();
    expect(isPoweredStaff(weapon('Sanguinesti staff', 'Powered Staff'))).toBe(true);
  });

  it('same seed -> same spell', () => {
    const a = rollSpell(weapon('Kodai wand', 'Staff'), SPELLS, mulberry32(7));
    const b = rollSpell(weapon('Kodai wand', 'Staff'), SPELLS, mulberry32(7));
    expect(a).toEqual(b);
  });
});
