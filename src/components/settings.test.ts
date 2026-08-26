import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  effectiveBudget,
  filterBossPool,
  WILDY_DEFAULT_GP,
  type Settings,
} from './settings';
import type { Boss } from './DataProvider';

const boss = (name: string, tags: string[]): Boss => ({ name, image: `${name}.png`, tags });

const withPool = (over: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('filterBossPool', () => {
  it('excludes wildy, off slayer/sporadic, and excluded pool tags', () => {
    const pool = [
      boss('A', ['wildy']),
      boss('B', ['slayer']),
      boss('C', ['sporadic']),
      boss('D', ['gwd']),
      boss('E', []),
    ];
    const out = filterBossPool(pool, withPool({ excludeWildy: true, excludedPools: ['gwd'] }));
    expect(out.map((b) => b.name)).toEqual(['E']);
  });

  it('includes slayer/sporadic when toggled on', () => {
    const pool = [boss('B', ['slayer']), boss('C', ['sporadic'])];
    expect(filterBossPool(pool, withPool({}))).toEqual([]);
    expect(filterBossPool(pool, withPool({ slayerBosses: true, sporadicBosses: true }))).toHaveLength(2);
  });
});

describe('effectiveBudget', () => {
  const M = 1_000_000;

  it('leaves a non-wildy run on its own budget', () => {
    expect(effectiveBudget(384 * M, 5 * M, false)).toBe(384 * M);
    expect(effectiveBudget(null, 5 * M, false)).toBeNull();
  });

  it('caps a wildy run rather than raising it', () => {
    // The bug this pins: Math.max here handed a 384m loadout to Spindel,
    // because the normal budget was simply the larger of the two numbers.
    expect(effectiveBudget(384 * M, null, true)).toBe(WILDY_DEFAULT_GP);
    expect(effectiveBudget(384 * M, 5 * M, true)).toBe(5 * M);
  });

  it('caps an unlimited budget too', () => {
    expect(effectiveBudget(null, null, true)).toBe(WILDY_DEFAULT_GP);
    expect(effectiveBudget(null, 20 * M, true)).toBe(20 * M);
  });

  it('keeps a budget already under the cap', () => {
    expect(effectiveBudget(300_000, null, true)).toBe(300_000);
  });

  it('never lets the wildy allowance fall below the 1m default', () => {
    expect(effectiveBudget(384 * M, 50_000, true)).toBe(WILDY_DEFAULT_GP);
  });
});
