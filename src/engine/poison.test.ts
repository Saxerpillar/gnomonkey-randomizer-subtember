import { describe, expect, it } from 'vitest';
import { roll, withPoison } from './roll';
import { mulberry32 } from './rng';
import { SLOTS, type Item, type RollSettings, type Slot } from './types';

let nextId = 1;
const zero = () => ({ stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 });
const item = (slot: Slot, over: Partial<Item> = {}): Item => ({
  id: nextId++,
  name: over.name ?? `${slot}-${nextId}`,
  slot,
  icon: 'x.png',
  tradeable: true,
  twoHanded: false,
  price: 1000,
  tier: 'common',
  offensive: zero(),
  defensive: zero(),
  bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
  ...over,
});

const dagger = () =>
  item('weapon', {
    name: 'Rune dagger',
    id: 1213,
    icon: '1213.png',
    price: 5000,
    poison: [
      { id: 1229, name: 'Rune dagger (p)', icon: '1229.png' },
      { id: 5678, name: 'Rune dagger (p+)', icon: '5678.png' },
      { id: 5696, name: 'Rune dagger (p++)', icon: '5696.png' },
    ],
  });

const settings = (over: Partial<RollSettings> = {}): RollSettings => ({
  budget: null,
  allowUntradeables: false,
  ...over,
});

describe('withPoison', () => {
  it('leaves a weapon with no variants alone', () => {
    const plain = item('weapon', { name: 'Abyssal whip' });
    expect(withPoison(plain, mulberry32(1))).toBe(plain);
  });

  it('draws evenly between clean and each poisoned version', () => {
    const base = dagger();
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 4000; seed++) {
      const name = withPoison(base, mulberry32(seed)).name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([
      'Rune dagger',
      'Rune dagger (p)',
      'Rune dagger (p+)',
      'Rune dagger (p++)',
    ]);
    // Four outcomes, so each should land near a quarter.
    for (const n of counts.values()) expect(n / 4000).toBeGreaterThan(0.2);
    for (const n of counts.values()) expect(n / 4000).toBeLessThan(0.3);
  });

  it('swaps identity only — stats, price and tier stay the base weapon’s', () => {
    const base = dagger();
    for (let seed = 1; seed <= 60; seed++) {
      const out = withPoison(base, mulberry32(seed));
      expect(out.price).toBe(base.price);
      expect(out.tier).toBe(base.tier);
      expect(out.slot).toBe(base.slot);
      expect(out.twoHanded).toBe(base.twoHanded);
      expect(out.offensive).toEqual(base.offensive);
      // The sprite follows the identity, so the icon must track the id.
      expect(out.icon).toBe(`${out.id}.png`);
    }
  });
});

describe('poison does not disturb the weapon odds', () => {
  // Two weapons, one poisonable. If poison were pool entries the dagger family
  // would come up four times as often; as a rider it stays at half.
  const pool = () => [
    dagger(),
    item('weapon', { name: 'Abyssal whip', price: 5000 }),
    ...SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo').map((s) => item(s, { price: 10 })),
  ];

  it('picks each base weapon about half the time', () => {
    const p = pool();
    let daggerRuns = 0;
    const runs = 2000;
    for (let seed = 1; seed <= runs; seed++) {
      const out = roll(p, settings(), mulberry32(seed));
      if (out.weapon?.name.startsWith('Rune dagger')) daggerRuns++;
    }
    const share = daggerRuns / runs;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it('still produces poisoned daggers among those runs', () => {
    const p = pool();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 2000; seed++) {
      const w = roll(p, settings(), mulberry32(seed)).weapon;
      if (w?.name.startsWith('Rune dagger')) seen.add(w.name);
    }
    expect(seen.size).toBe(4);
  });
});
