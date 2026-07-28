import { describe, expect, it } from 'vitest';
import { loadoutBonuses, speedSeconds } from './bonuses';
import { emptyLoadout, type Item } from './types';

const zeroOff = () => ({ stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 });

describe('loadoutBonuses', () => {
  it('empty loadout is all zeros with no speed', () => {
    const b = loadoutBonuses(emptyLoadout());
    expect(b.attack).toEqual(zeroOff());
    expect(b.defence).toEqual(zeroOff());
    expect(b.meleeStr).toBe(0);
    expect(b.speedTicks).toBeNull();
  });

  it('sums across items and decodes magic damage percent', () => {
    const loadout = emptyLoadout();
    loadout.weapon = {
      id: 1,
      name: 'whip',
      slot: 'weapon',
      icon: 'x.png',
      tradeable: true,
      twoHanded: false,
      tier: 'strong',
      speed: 4,
      offensive: { stab: 0, slash: 82, crush: 0, magic: 0, ranged: 0 },
      defensive: zeroOff(),
      bonuses: { str: 82, ranged_str: 0, magic_str: 0, prayer: 0 },
    } as Item;
    loadout.neck = {
      id: 2,
      name: 'occult',
      slot: 'neck',
      icon: 'x.png',
      tradeable: true,
      twoHanded: false,
      tier: 'elite',
      offensive: { stab: 0, slash: 0, crush: 0, magic: 12, ranged: 0 },
      defensive: { stab: 1, slash: 1, crush: 1, magic: 5, ranged: 1 },
      bonuses: { str: 0, ranged_str: 0, magic_str: 50, prayer: 2 },
    } as Item;

    const b = loadoutBonuses(loadout);
    expect(b.attack.slash).toBe(82);
    expect(b.attack.magic).toBe(12);
    expect(b.defence.magic).toBe(5);
    expect(b.meleeStr).toBe(82);
    expect(b.magicDmgPercent).toBe(5);
    expect(b.prayer).toBe(2);
    expect(b.speedTicks).toBe(4);
  });
});

describe('speedSeconds', () => {
  it('converts ticks at 0.6s each', () => {
    expect(speedSeconds(4)).toBe('2.4s');
    expect(speedSeconds(5)).toBe('3.0s');
  });
});
