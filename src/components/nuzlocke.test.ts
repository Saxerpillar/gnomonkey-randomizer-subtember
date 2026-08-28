import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import type { Boss } from './DataProvider';
import {
  availableBosses,
  rollNuzlockeBoss,
  type BossRollState,
  type BossStates,
} from './nuzlocke';

const boss = (name: string): Boss => ({ name, image: `${name}.png`, tags: [] });

const states = (names: readonly string[], state: BossRollState = 'completed'): BossStates =>
  Object.fromEntries(names.map((n) => [n, state]));

describe('rollNuzlockeBoss', () => {
  it('at 0% repeat, rolls every boss once per cycle before resetting', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    let s: BossStates = {};
    const seen: string[] = [];
    for (let seed = 1; seed <= 9; seed++) {
      const r = rollNuzlockeBoss(pool, s, 0, mulberry32(seed));
      s = r.states;
      seen.push(r.boss.name);
    }
    // Three consecutive picks make up one cycle: all three bosses, none twice.
    for (let i = 0; i < 3; i++) {
      expect(seen.slice(i * 3, i * 3 + 3).sort()).toEqual(['A', 'B', 'C']);
    }
  });

  it('never repeats on the very first roll, however high the slider', () => {
    const pool = [boss('A'), boss('B')];
    const { boss: b } = rollNuzlockeBoss(pool, {}, 1, mulberry32(1));
    expect(pool.map((p) => p.name)).toContain(b.name);
  });

  it('at 100% repeat, lands on an already-fought boss', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    const { boss: b } = rollNuzlockeBoss(pool, states(['B']), 1, mulberry32(5));
    expect(b.name).toBe('B');
  });

  it('a middle repeat chance mixes repeats and fresh bosses', () => {
    const pool = [boss('A'), boss('B'), boss('C'), boss('D')];
    let s: BossStates = states(['A', 'B']);
    let repeats = 0;
    let fresh = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = rollNuzlockeBoss(pool, s, 0.5, mulberry32(seed));
      s = r.states;
      if (['A', 'B'].includes(r.boss.name)) repeats++;
      else fresh++;
    }
    expect(repeats).toBeGreaterThan(0);
    expect(fresh).toBeGreaterThan(0);
  });

  it('an exhausted pool resets the cycle to just the freshly rolled boss', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    const r = rollNuzlockeBoss(pool, states(['A', 'B', 'C']), 0, mulberry32(2));
    expect(Object.keys(r.states)).toEqual([r.boss.name]);
  });

  it('records the rolled boss as fought', () => {
    const pool = [boss('A'), boss('B')];
    const r = rollNuzlockeBoss(pool, {}, 0, mulberry32(1));
    expect(r.states[r.boss.name]).toBe('completed');
  });
});

describe('availableBosses', () => {
  it('subtracts the rolled bosses from the pool', () => {
    const pool = [boss('A'), boss('B'), boss('C')];
    expect(availableBosses(pool, states(['B'])).map((b) => b.name)).toEqual(['A', 'C']);
  });
});
