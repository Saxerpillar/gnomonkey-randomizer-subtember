import { describe, expect, it } from 'vitest';
import { formatGp, gpTier, parseBudget } from './parse';

describe('parseBudget', () => {
  it.each([
    ['10m', 10_000_000],
    ['250k', 250_000],
    ['1.5b', 1_500_000_000],
    ['1,000,000', 1_000_000],
    ['1_000_000', 1_000_000],
    ['0', 0],
    ['42', 42],
    ['3.5m', 3_500_000],
    [' 10M ', 10_000_000],
  ])('parses %s -> %d', (text, gp) => {
    expect(parseBudget(text)).toEqual({ ok: true, gp });
  });

  it('empty input means no budget', () => {
    expect(parseBudget('')).toEqual({ ok: true, gp: null });
    expect(parseBudget('   ')).toEqual({ ok: true, gp: null });
  });

  it.each(['abc', '10q', '-5', '1.2.3', 'm', '10mk'])('rejects %s', (text) => {
    expect(parseBudget(text)).toEqual({ ok: false });
  });
});

describe('formatGp (in-game display: truncated, 5 chars max)', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1000'],
    [99_999, '99999'],
    [100_000, '100k'],
    [250_000, '250k'],
    [952_509, '952k'],
    [9_999_999, '9999k'],
    [10_000_000, '10m'],
    [12_345_678, '12m'],
    [1_500_000_000, '1500m'],
    [9_999_999_999, '9999m'],
    [10_000_000_000, '10b'],
    [123_000_000_000, '10b'],
  ])('formats %d -> %s', (gp, text) => {
    expect(formatGp(gp)).toBe(text);
    expect(formatGp(gp).length).toBeLessThanOrEqual(5);
  });
});

describe('gpTier', () => {
  it.each([
    [0, 'yellow'],
    [99_999, 'yellow'],
    [100_000, 'white'],
    [9_999_999, 'white'],
    [10_000_000, 'green'],
    [10_000_000_000, 'green'],
  ] as const)('%d gp -> %s', (gp, tier) => {
    expect(gpTier(gp)).toBe(tier);
  });
});
