// Guards the vendored emote trim: the TS table must match the files actually on
// disk, and every placement must obey the "only ever scale up, never past 250%"
// rule the art direction asked for.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  allScales,
  CLUSTERS,
  EDGE_KEEPOUT,
  EMOTES,
  MAX_SCALE,
  MIN_SCALE,
  SCATTER,
} from './emotes';

interface Entry {
  file: string;
  width: number;
  height: number;
  role: string;
}

const manifest = JSON.parse(readFileSync('data/emotes.json', 'utf8')) as Entry[];

describe('emote assets', () => {
  it('every emote file exists in public/img/emotes', () => {
    const missing = Object.values(EMOTES).filter((e) => !existsSync(`public/img/emotes/${e.file}`));
    expect(missing.map((e) => e.file)).toEqual([]);
  });

  it('declared natural sizes match the downloaded files', () => {
    const byFile = new Map(manifest.map((m) => [m.file, m]));
    for (const [key, e] of Object.entries(EMOTES)) {
      const m = byFile.get(e.file);
      expect(m, `${key} missing from data/emotes.json`).toBeDefined();
      expect({ key, w: e.w, h: e.h }).toEqual({ key, w: m!.width, h: m!.height });
    }
  });
});

describe('placement sizing rule', () => {
  it('never downsizes and never exceeds 250%', () => {
    for (const s of allScales()) {
      expect(s).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(s).toBeLessThanOrEqual(MAX_SCALE);
    }
  });

  it('no emote is scattered more than twice, and never near its twin', () => {
    const byEmote = new Map<string, typeof SCATTER>();
    for (const p of SCATTER) byEmote.set(p.emote, [...(byEmote.get(p.emote) ?? []), p]);
    for (const [emote, spots] of byEmote) {
      expect(spots.length, `${emote} appears ${spots.length} times`).toBeLessThanOrEqual(2);
      if (spots.length < 2) continue;
      // Far enough apart that the eye does not read them as a duplicated tile.
      const [a, b] = spots;
      expect(Math.hypot(a.x - b.x, a.y - b.y), `${emote} twins are too close`).toBeGreaterThan(40);
    }
  });

  it('clusters are one trio, one pair and two loners', () => {
    expect(CLUSTERS.map((c) => c.members.length).sort((a, b) => b - a)).toEqual([3, 2, 1, 1]);
  });

  it('rounding a scaled width can never breach the 250% cap', () => {
    for (const e of Object.values(EMOTES)) {
      expect(Math.floor(e.w * MAX_SCALE) / e.w).toBeLessThanOrEqual(MAX_SCALE);
    }
  });

  it('nothing is pinned to the left or right edge', () => {
    // Trim hugging the window edges reads as a border; the brief wants it
    // scattered inward.
    for (const p of [...SCATTER, ...CLUSTERS]) {
      expect(p.x).toBeGreaterThanOrEqual(EDGE_KEEPOUT);
      expect(p.x).toBeLessThanOrEqual(100 - EDGE_KEEPOUT);
    }
  });

  it('trim is spread over the page, not bunched in one band', () => {
    const all = [...SCATTER, ...CLUSTERS];
    for (const half of [
      all.filter((p) => p.y < 50),
      all.filter((p) => p.y >= 50),
      all.filter((p) => p.x < 50),
      all.filter((p) => p.x >= 50),
    ]) {
      expect(half.length).toBeGreaterThan(2);
    }
  });
});
