import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import { CHALLENGE_CHANCE, rollChallenge, TIME_LIMIT_SECONDS, type Difficulty } from './challenges';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from './settings';

const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
const DIFFICULTIES: Difficulty[] = ['easy', 'mid', 'hard'];

describe('rollChallenge forcing', () => {
  it("'off' leaves most runs challenge-free", () => {
    const drawn = seeds.filter((s) => rollChallenge(mulberry32(s), 'hard')).length;
    expect(drawn / seeds.length).toBeLessThan(CHALLENGE_CHANCE.hard * 2);
  });

  it("'any' always draws something", () => {
    for (const s of seeds) expect(rollChallenge(mulberry32(s), 'mid', 'any')).not.toBeNull();
  });

  it("'timed' always draws the countdown, scaled to difficulty", () => {
    for (const d of DIFFICULTIES) {
      for (const s of seeds.slice(0, 20)) {
        const c = rollChallenge(mulberry32(s), d, 'timed');
        expect(c?.timerSeconds).toBe(TIME_LIMIT_SECONDS[d]);
      }
    }
  });

  it('raids never draw the timed challenge', () => {
    for (const s of seeds) {
      for (const d of DIFFICULTIES) {
        const c = rollChallenge(mulberry32(s), d, 'any', false);
        expect(c).not.toBeNull();
        expect(c?.timerSeconds).toBeUndefined();
      }
    }
  });
});

describe('mergeSettings', () => {
  it('heals the legacy boolean forceChallenge', () => {
    expect(mergeSettings({ forceChallenge: true }).forceChallenge).toBe('any');
    expect(mergeSettings({ forceChallenge: false }).forceChallenge).toBe('off');
  });

  it('passes the current shape through and fills gaps from defaults', () => {
    const saved: Partial<Settings> = { forceChallenge: 'timed', debugMode: true };
    const merged = mergeSettings(saved);
    expect(merged.forceChallenge).toBe('timed');
    expect(merged.ceremonySpeed).toBe(DEFAULT_SETTINGS.ceremonySpeed);
  });

  it('survives junk', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
