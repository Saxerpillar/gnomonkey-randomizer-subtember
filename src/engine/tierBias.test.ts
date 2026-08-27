import { describe, expect, it } from 'vitest';
import { roll } from './roll';
import { mulberry32 } from './rng';
import { TIERS, type Item, type RollSettings, type Slot, type Tier } from './types';
import { TIER_BIAS } from '../components/challenges';

let nextId = 1;
const zero = () => ({ stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 });
const item = (slot: Slot, tier: Tier): Item => ({
  id: nextId++,
  name: `${slot}-${tier}-${nextId}`,
  slot,
  icon: 'x.png',
  tradeable: true,
  twoHanded: false,
  price: 100,
  tier,
  offensive: zero(),
  defensive: zero(),
  bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
});

/** Every slot carries several items of every tier, so nothing is forced. */
const pool = (): Item[] =>
  (['head', 'cape', 'neck', 'body', 'legs', 'hands', 'feet', 'ring', 'weapon'] as Slot[]).flatMap(
    (s) => TIERS.flatMap((t) => [item(s, t), item(s, t), item(s, t)]),
  );

const settings = (over: Partial<RollSettings> = {}): RollSettings => ({
  budget: null,
  allowUntradeables: false,
  locks: {},
  ...over,
});

/** Mean tier rank across a lot of rolls — junk 0 … elite 4. */
const meanRank = (bias: number, runs = 900): number => {
  const p = pool();
  let sum = 0;
  let n = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const out = roll(p, settings({ tierBias: bias }), mulberry32(seed));
    for (const s of Object.keys(out) as Slot[]) {
      const t = out[s]?.tier;
      if (t) {
        sum += TIERS.indexOf(t);
        n += 1;
      }
    }
  }
  return sum / n;
};

describe('tierBias', () => {
  it('changes nothing at 1 — the tuned tables are the baseline', () => {
    const p = pool();
    for (let seed = 1; seed <= 25; seed++) {
      const biased = roll(p, settings({ tierBias: 1 }), mulberry32(seed));
      const plain = roll(p, settings(), mulberry32(seed));
      expect(Object.values(biased).map((i) => i?.name)).toEqual(
        Object.values(plain).map((i) => i?.name),
      );
    }
  });

  it('lifts the gear as the bias rises', () => {
    const easy = meanRank(1);
    const mid = meanRank(1.25);
    const hard = meanRank(1.6);
    expect(mid).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(mid);
  });

  it('is a nudge, not a guarantee — junk still happens on a hard fight', () => {
    const p = pool();
    let sawJunk = false;
    for (let seed = 1; seed <= 400 && !sawJunk; seed++) {
      const out = roll(p, settings({ tierBias: TIER_BIAS.hard }), mulberry32(seed));
      sawJunk = Object.values(out).some((i) => i?.tier === 'junk');
    }
    expect(sawJunk).toBe(true);
  });

  it('never reorders the ladder — elite stays rarer than decent', () => {
    const p = pool();
    const counts = { decent: 0, elite: 0 };
    for (let seed = 1; seed <= 600; seed++) {
      const out = roll(p, settings({ tierBias: TIER_BIAS.hard }), mulberry32(seed));
      for (const i of Object.values(out)) {
        if (i?.tier === 'decent') counts.decent++;
        if (i?.tier === 'elite') counts.elite++;
      }
    }
    expect(counts.elite).toBeLessThan(counts.decent);
  });
});

describe('TIER_BIAS by difficulty', () => {
  it('leaves easy fights on the tuned tables', () => {
    expect(TIER_BIAS.easy).toBe(1);
  });

  it('rises with difficulty', () => {
    expect(TIER_BIAS.mid).toBeGreaterThan(TIER_BIAS.easy);
    expect(TIER_BIAS.hard).toBeGreaterThan(TIER_BIAS.mid);
  });
});
