import { describe, expect, it } from 'vitest';
import { sortSquadByStyle, styleFit, type SquadLane } from './squadSort';
import { emptyLoadout, SLOTS, type Item, type Slot } from './types';

let nextId = 1;
const zero = () => ({ stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 });
const item = (slot: Slot, name: string, over: Partial<Item> = {}): Item => ({
  id: nextId++,
  name,
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

const lane = (style: SquadLane['style'], items: Partial<Record<Slot, Item>>): SquadLane => ({
  style,
  loadout: { ...emptyLoadout(), ...items },
});

describe('styleFit', () => {
  it('sends attack bonuses to the style they serve', () => {
    const wand = item('hands', 'wand', { offensive: { ...zero(), magic: 20 } });
    expect(styleFit(wand, 'magic')).toBeGreaterThan(styleFit(wand, 'ranged'));
    expect(styleFit(wand, 'magic')).toBeGreaterThan(styleFit(wand, 'melee'));

    const vambs = item('hands', 'vambs', { offensive: { ...zero(), ranged: 20 } });
    expect(styleFit(vambs, 'ranged')).toBeGreaterThan(styleFit(vambs, 'magic'));

    const gloves = item('hands', 'gloves', { offensive: { ...zero(), slash: 20 } });
    expect(styleFit(gloves, 'melee')).toBeGreaterThan(styleFit(gloves, 'ranged'));
  });

  it('counts damage bonuses, not just accuracy', () => {
    const str = item('ring', 'str ring', { bonuses: { str: 8, ranged_str: 0, magic_str: 0, prayer: 0 } });
    expect(styleFit(str, 'melee')).toBeGreaterThan(styleFit(str, 'magic'));
  });

  it('falls back to the combat triangle when nothing has an attack bonus', () => {
    // Hide resists spells, so magic defence marks ranged armour.
    const hide = item('body', 'hide', { defensive: { ...zero(), magic: 30 } });
    expect(styleFit(hide, 'ranged')).toBeGreaterThan(styleFit(hide, 'melee'));
    expect(styleFit(hide, 'ranged')).toBeGreaterThan(styleFit(hide, 'magic'));

    // Plate resists arrows, so ranged defence marks melee armour.
    const plate = item('body', 'plate', { defensive: { ...zero(), ranged: 30 } });
    expect(styleFit(plate, 'melee')).toBeGreaterThan(styleFit(plate, 'ranged'));
    expect(styleFit(plate, 'melee')).toBeGreaterThan(styleFit(plate, 'magic'));
  });

  it('lets a real attack bonus outrank an armour-type hint', () => {
    // A magic hat with token defence still belongs on the magic setup, even
    // against an item whose defence screams "ranged armour".
    const hat = item('head', 'hat', { offensive: { ...zero(), magic: 10 } });
    const hide = item('head', 'coif', { defensive: { ...zero(), magic: 40 } });
    expect(styleFit(hat, 'magic')).toBeGreaterThan(styleFit(hide, 'magic'));
  });
});

describe('sortSquadByStyle', () => {
  it('deals each piece to the setup it suits', () => {
    // Rolled backwards on purpose: melee holds the wand, magic holds the sword.
    const squad = [
      lane('melee', { hands: item('hands', 'wand', { offensive: { ...zero(), magic: 20 } }) }),
      lane('ranged', { hands: item('hands', 'vambs', { offensive: { ...zero(), ranged: 20 } }) }),
      lane('magic', { hands: item('hands', 'gloves', { offensive: { ...zero(), slash: 20 } }) }),
    ];
    const out = sortSquadByStyle(squad);
    expect(out.find((l) => l.style === 'magic')!.loadout.hands?.name).toBe('wand');
    expect(out.find((l) => l.style === 'ranged')!.loadout.hands?.name).toBe('vambs');
    expect(out.find((l) => l.style === 'melee')!.loadout.hands?.name).toBe('gloves');
  });

  it('never moves a weapon — the weapon IS the lane', () => {
    const squad = [
      lane('melee', { weapon: item('weapon', 'sword', { offensive: { ...zero(), magic: 99 } }) }),
      lane('ranged', { weapon: item('weapon', 'bow') }),
      lane('magic', { weapon: item('weapon', 'staff') }),
    ];
    const out = sortSquadByStyle(squad);
    expect(out.map((l) => l.loadout.weapon?.name)).toEqual(['sword', 'bow', 'staff']);
  });

  it('never moves ammo — it is bound to its own lane’s weapon', () => {
    const squad = [
      lane('melee', { ammo: item('ammo', 'bolts', { offensive: { ...zero(), magic: 99 } }) }),
      lane('ranged', { ammo: item('ammo', 'arrows') }),
      lane('magic', { ammo: item('ammo', 'darts') }),
    ];
    const out = sortSquadByStyle(squad);
    expect(out.map((l) => l.loadout.ammo?.name)).toEqual(['bolts', 'arrows', 'darts']);
  });

  it('never hands a shield to a two-handed lane', () => {
    // Only the ranged and magic lanes rolled one; melee is holding a 2h.
    const squad = [
      lane('melee', { weapon: item('weapon', 'godsword', { twoHanded: true }) }),
      lane('ranged', { shield: item('shield', 'ward', { offensive: { ...zero(), magic: 20 } }) }),
      lane('magic', { shield: item('shield', 'kite', { defensive: { ...zero(), ranged: 20 } }) }),
    ];
    const out = sortSquadByStyle(squad);
    expect(out.find((l) => l.style === 'melee')!.loadout.shield).toBeNull();
    // The pair still trade with each other: the ward suits magic.
    expect(out.find((l) => l.style === 'magic')!.loadout.shield?.name).toBe('ward');
    expect(out.find((l) => l.style === 'ranged')!.loadout.shield?.name).toBe('kite');
  });

  it('conserves the team’s gear — it deals differently, it does not reroll', () => {
    const squad = [
      lane('melee', {
        head: item('head', 'a', { offensive: { ...zero(), magic: 5 } }),
        body: item('body', 'b'),
      }),
      lane('ranged', {
        head: item('head', 'c', { offensive: { ...zero(), ranged: 5 } }),
        body: item('body', 'd', { defensive: { ...zero(), magic: 9 } }),
      }),
      lane('magic', {
        head: item('head', 'e'),
        body: item('body', 'f', { defensive: { ...zero(), ranged: 9 } }),
      }),
    ];
    const before = squad.flatMap((l) => SLOTS.map((s) => l.loadout[s]?.name).filter(Boolean)).sort();
    const after = sortSquadByStyle(squad)
      .flatMap((l) => SLOTS.map((s) => l.loadout[s]?.name).filter(Boolean))
      .sort();
    expect(after).toEqual(before);
  });

  it('leaves the input untouched', () => {
    const squad = [
      lane('melee', { hands: item('hands', 'wand', { offensive: { ...zero(), magic: 20 } }) }),
      lane('magic', { hands: item('hands', 'gloves', { offensive: { ...zero(), slash: 20 } }) }),
    ];
    sortSquadByStyle(squad);
    expect(squad[0].loadout.hands?.name).toBe('wand');
  });
});
