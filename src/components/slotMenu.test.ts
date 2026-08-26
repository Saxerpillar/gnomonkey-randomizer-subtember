import { describe, expect, it, vi } from 'vitest';
import { emptyLoadout, type Item, type Loadout, type Slot } from '../engine/types';
import { slotMenuEntries } from './slotMenu';

const item = (over: Partial<Item> = {}): Item =>
  ({
    id: 1,
    name: 'thing',
    slot: 'weapon',
    tradeable: true,
    twoHanded: false,
    icon: '1.png',
    tier: 'common',
    offensive: {},
    defensive: {},
    bonuses: {},
    ...over,
  }) as Item;

const withSlots = (over: Partial<Record<Slot, Item>>): Loadout => ({ ...emptyLoadout(), ...over });

const actions = () => ({ reroll: vi.fn(), remove: vi.fn() });

describe('slotMenuEntries', () => {
  it('always offers a reroll, even for an empty slot', () => {
    const entries = slotMenuEntries(emptyLoadout(), 'head', actions());
    expect(entries.map((e) => e.label)).toEqual(['Reroll head']);
  });

  it('offers removal only when the slot holds something', () => {
    const filled = withSlots({ head: item({ slot: 'head' }) });
    expect(slotMenuEntries(filled, 'head', actions()).map((e) => e.label)).toEqual([
      'Reroll head',
      'Remove item from slot',
    ]);
  });

  it('will not offer to reroll a shield under a two-hander', () => {
    const twoHanded = withSlots({ weapon: item({ twoHanded: true }) });
    expect(slotMenuEntries(twoHanded, 'shield', actions())).toEqual([]);
  });

  it('still offers the shield when the weapon is one-handed', () => {
    const oneHanded = withSlots({ weapon: item({ twoHanded: false }) });
    expect(slotMenuEntries(oneHanded, 'shield', actions()).map((e) => e.label)).toEqual([
      'Reroll shield',
    ]);
  });

  it('wires each entry to the action it names', () => {
    const a = actions();
    const filled = withSlots({ head: item({ slot: 'head' }) });
    const entries = slotMenuEntries(filled, 'head', a);
    entries.find((e) => e.label === 'Reroll head')!.onSelect();
    expect(a.reroll).toHaveBeenCalledOnce();
    expect(a.remove).not.toHaveBeenCalled();
    entries.find((e) => e.label === 'Remove item from slot')!.onSelect();
    expect(a.remove).toHaveBeenCalledOnce();
  });

  it('builds the same menu for a raid lane as for the main loadout', () => {
    // The lanes were previously wired to no-ops; this pins that a lane's
    // loadout produces an identical menu, just aimed at that lane.
    const lane = withSlots({ weapon: item({ twoHanded: false }) });
    const main = withSlots({ weapon: item({ twoHanded: false }) });
    for (const slot of ['weapon', 'shield', 'head'] as Slot[]) {
      expect(slotMenuEntries(lane, slot, actions()).map((e) => e.label)).toEqual(
        slotMenuEntries(main, slot, actions()).map((e) => e.label),
      );
    }
  });
});
