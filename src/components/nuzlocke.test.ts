import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import type { Boss } from './DataProvider';
import { rollNuzlockeBoss, unusedBosses } from './nuzlocke';

const boss = (name: string): Boss => ({ name, image: `${name}.png`, tags: [] });

describe('rollNuzlockeBoss', () => {
  it('at 0% repeat, rolls every boss once per cycle before resetting', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    let used: string[] = [];
    const seen: string[] = [];
    for (let seed = 1; seed <= 9; seed++) {
      const r = rollNuzlockeBoss(pool, used, 0, mulberry32(seed));
      used = r.used;
      seen.push(r.boss.name);
    }
    // Three consecutive picks make up one cycle: all three bosses, none twice.
    for (let i = 0; i < 3; i++) {
      expect(seen.slice(i * 3, i * 3 + 3).sort()).toEqual(['A', 'B', 'C']);
    }
  });

  it('never repeats on the very first roll, however high the slider', () => {
    const pool = [boss('A'), boss('B')];
    const { boss: b } = rollNuzlockeBoss(pool, [], 1, mulberry32(1));
    expect(pool.map((p) => p.name)).toContain(b.name);
  });

  it('at 100% repeat, lands on an already-fought boss', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    const { boss: b } = rollNuzlockeBoss(pool, ['B'], 1, mulberry32(5));
    expect(b.name).toBe('B');
  });

  it('a middle repeat chance mixes repeats and fresh bosses', () => {
    const pool = [boss('A'), boss('B'), boss('C'), boss('D')];
    let used = ['A', 'B'];
    let repeats = 0;
    let fresh = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = rollNuzlockeBoss(pool, used, 0.5, mulberry32(seed));
      used = r.used;
      if (['A', 'B'].includes(r.boss.name)) repeats++;
      else fresh++;
    }
    expect(repeats).toBeGreaterThan(0);
    expect(fresh).toBeGreaterThan(0);
  });

  it('an exhausted pool resets the cycle', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    const r = rollNuzlockeBoss(pool, ['A', 'B', 'C'], 0, mulberry32(2));
    expect(r.used).toEqual([r.boss.name]);
  });

  it('records the rolled boss as fought', () => {
    const pool = [boss('A'), boss('B')];
    const r = rollNuzlockeBoss(pool, [], 0, mulberry32(1));
    expect(r.used).toEqual([r.boss.name]);
  });
});

describe('unusedBosses', () => {
  it('subtracts the fought bosses from the pool', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    expect(unusedBosses(pool, ['B']).map((b) => b.name)).toEqual(['A', 'C']);
  });
});
