// Bad-RNG mitigation: floors guarantee a minimum number of core slots at a
// given tier. They deliberately outrank the gp budget.
import { describe, expect, it } from 'vitest';
import { assignTierFloors, roll, rollForStyle } from './roll';
import { mulberry32 } from './rng';
import {
  CORE_SLOTS,
  SLOTS,
  type Item,
  type RollSettings,
  type Slot,
  type Tier,
} from './types';

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

/** Every core slot carries one item of every tier. */
const fullPool = (): Item[] =>
  CORE_SLOTS.flatMap((s) =>
    (['junk', 'common', 'decent', 'strong', 'elite'] as Tier[]).map((tier) =>
      item(s, {
        tier,
        price: tier === 'elite' ? 100_000_000 : 1000,
        category: s === 'weapon' ? 'Slash Sword' : undefined,
      }),
    ),
  );

const settings = (over: Partial<RollSettings> = {}): RollSettings => ({
  budget: null,
  allowUntradeables: false,
  locks: {},
  ...over,
});

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
const countTier = (loadout: Record<string, Item | null>, tier: Tier) =>
  CORE_SLOTS.filter((s) => loadout[s]?.tier === tier).length;

describe('assignTierFloors', () => {
  const bySlot = new Map<Slot, Item[]>();
  for (const i of fullPool()) bySlot.set(i.slot, [...(bySlot.get(i.slot) ?? []), i]);

  it('claims exactly as many slots as asked for', () => {
    const assigned = assignTierFloors({ elite: 3 }, bySlot, {}, mulberry32(1));
    expect([...assigned.values()].filter((t) => t === 'elite')).toHaveLength(3);
  });

  it('never assigns the same slot twice', () => {
    const assigned = assignTierFloors({ elite: 3, strong: 3, decent: 3 }, bySlot, {}, mulberry32(7));
    expect(assigned.size).toBe(9);
    expect(new Set(assigned.keys()).size).toBe(9);
  });

  it('leaves locked slots alone — they already hold what they hold', () => {
    const locks = { head: item('head'), cape: item('cape') };
    const assigned = assignTierFloors({ elite: 9 }, bySlot, locks, mulberry32(3));
    expect(assigned.has('head')).toBe(false);
    expect(assigned.has('cape')).toBe(false);
    expect(assigned.size).toBe(CORE_SLOTS.length - 2);
  });

  it('degrades instead of failing when asked for more than exists', () => {
    const assigned = assignTierFloors({ elite: 99 }, bySlot, {}, mulberry32(5));
    expect(assigned.size).toBe(CORE_SLOTS.length);
  });

  it('never touches shield or ammo — neither is guaranteed to fill', () => {
    const assigned = assignTierFloors({ elite: 9 }, bySlot, {}, mulberry32(9));
    expect(assigned.has('shield')).toBe(false);
    expect(assigned.has('ammo')).toBe(false);
  });
});

describe('roll with tier floors', () => {
  it('meets the floor on every seed', () => {
    for (const seed of seeds) {
      const out = roll(fullPool(), settings({ tierFloors: { strong: 3 } }), mulberry32(seed));
      expect(countTier(out, 'strong')).toBeGreaterThanOrEqual(3);
    }
  });

  it('honours several floors at once', () => {
    for (const seed of seeds.slice(0, 20)) {
      const out = roll(
        fullPool(),
        settings({ tierFloors: { elite: 2, strong: 2, decent: 2 } }),
        mulberry32(seed),
      );
      expect(countTier(out, 'elite')).toBeGreaterThanOrEqual(2);
      expect(countTier(out, 'strong')).toBeGreaterThanOrEqual(2);
      expect(countTier(out, 'decent')).toBeGreaterThanOrEqual(2);
    }
  });

  it('outranks the budget — the floor is honoured even when unaffordable', () => {
    // Elites cost 100m here; the budget allows one cheap item at most.
    for (const seed of seeds.slice(0, 20)) {
      const out = roll(
        fullPool(),
        settings({ budget: 5000, tierFloors: { elite: 2 } }),
        mulberry32(seed),
      );
      expect(countTier(out, 'elite')).toBeGreaterThanOrEqual(2);
    }
  });

  it('leaves the rest of the loadout to chance', () => {
    // With only 2 slots floored, the other 7 should not all land on one tier
    // across many seeds — otherwise the floors have flattened the roll.
    const seen = new Set<Tier>();
    for (const seed of seeds) {
      const out = roll(fullPool(), settings({ tierFloors: { elite: 2 } }), mulberry32(seed));
      for (const s of CORE_SLOTS) {
        const t = out[s]?.tier;
        if (t) seen.add(t);
      }
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('changes nothing when no floor is set', () => {
    // One pool for both rolls: fullPool() mints fresh ids each call, so two
    // pools would differ by construction and prove nothing.
    const pool = fullPool();
    for (const seed of seeds.slice(0, 10)) {
      const withEmpty = roll(pool, settings({ tierFloors: {} }), mulberry32(seed));
      const without = roll(pool, settings(), mulberry32(seed));
      expect(SLOTS.map((s) => withEmpty[s]?.name)).toEqual(SLOTS.map((s) => without[s]?.name));
    }
  });
});

describe('raid floors', () => {
  it('are satisfied per skeleton, not pooled across the team', () => {
    const floors = { strong: 3 };
    for (const seed of seeds.slice(0, 15)) {
      for (const style of ['melee', 'ranged', 'magic'] as const) {
        const lane = rollForStyle(
          fullPool(),
          style,
          settings({ tierFloors: floors }),
          mulberry32(seed),
        );
        // Each lane owes the full floor on its own.
        expect(countTier(lane, 'strong')).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
