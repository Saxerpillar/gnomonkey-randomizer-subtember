import { describe, expect, it } from 'vitest';
import { buildTape, effectiveTier, revealBeats, tapeTickDelays } from './reel';
import { mulberry32 } from './rng';
import { SLOTS, type Item, type Slot, type Tier } from './types';

let nextId = 1;
const item = (slot: Slot, name = `${slot}-${nextId}`, tier: Tier = 'common'): Item => ({
  id: nextId++,
  name,
  slot,
  icon: 'x.png',
  tradeable: true,
  twoHanded: false,
  tier,
  offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
  bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
});

describe('revealBeats', () => {
  it('reveals head first, then weapon+shield, with ammo as the coda', () => {
    const beats = revealBeats();
    expect(beats[0]).toEqual(['head']);
    // Ammo only exists for a ranged weapon, so it must not precede the weapon
    // beat — that would give the jackpot away early.
    expect(beats[beats.length - 2]).toEqual(['weapon', 'shield']);
    expect(beats[beats.length - 1]).toEqual(['ammo']);
    expect(beats.flat()).toHaveLength(SLOTS.length);
    expect(new Set(beats.flat())).toEqual(new Set(SLOTS));
  });
});

describe('buildTape', () => {
  it('places the winner at winnerIndex with decoy tails after it', () => {
    const final = item('head', 'winner');
    const pool = [item('head'), item('head'), item('head'), item('head'), item('head'), item('head')];
    const { items, winnerIndex } = buildTape([...pool, final], final, mulberry32(3), 4, 2);
    expect(winnerIndex).toBe(4);
    expect(items[4]).toBe(final);
    expect(items.slice(0, 4)).toHaveLength(4);
    expect(items.slice(5)).toHaveLength(2);
    expect(new Set(items).size).toBe(pool.length + 1); // all distinct
  });

  it('loops the band when the pool is thinner than the reel', () => {
    const final = item('head', 'winner');
    const others = [item('head', 'a'), item('head', 'b')];
    const { items, winnerIndex } = buildTape([...others, final], final, mulberry32(5), 26, 2);
    expect(winnerIndex).toBe(26);
    expect(items).toHaveLength(26 + 1 + 2);
    // The band repeats the same two fillers, never the winner.
    expect(new Set(items.slice(0, 26))).toEqual(new Set(others));
    expect(items[26]).toBe(final);
  });

  it('a single candidate skips the reel entirely', () => {
    const final = item('head', 'only');
    const { items, winnerIndex } = buildTape([final], final, mulberry32(1), 26, 2);
    expect(items).toEqual([final]);
    expect(winnerIndex).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const final = item('head', 'winner');
    const pool = [item('head'), item('head'), item('head')];
    const a = buildTape([...pool, final], final, mulberry32(9), 6, 2);
    const b = buildTape([...pool, final], final, mulberry32(9), 6, 2);
    expect(a.items.map((i) => i.id)).toEqual(b.items.map((i) => i.id));
  });
});

describe('effectiveTier', () => {
  it('prefers the override and falls back to the item tier', () => {
    const junk = item('head', 'junk', 'junk');
    expect(effectiveTier(junk)).toBe('junk');
    expect(effectiveTier(junk, 'elite')).toBe('elite');
  });
});

describe('tapeTickDelays', () => {
  it('strictly increases and sums near the target roll time', () => {
    const delays = tapeTickDelays(27, 3900);
    expect(delays).toHaveLength(27);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
    const sum = delays.reduce((s, d) => s + d, 0);
    expect(Math.abs(sum - 3900)).toBeLessThan(60);
  });

  it('returns empty for zero ticks', () => {
    expect(tapeTickDelays(0, 1000)).toEqual([]);
  });
});
