import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, filterBossPool, type Settings } from './settings';
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
