// Schema sanity over the GENERATED data (public/data). Guards the refresh
// script's output contract with the app: valid slots, unique ids/names,
// classifications present, icons on disk, bosses well-formed.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLOTS } from './types';

const load = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));

describe('generated equipment.json', () => {
  const items = load('equipment.json') as Record<string, unknown>[];

  it('is a non-trivial pool', () => {
    expect(items.length).toBeGreaterThan(1000);
  });

  it('every item is well-formed', () => {
    const slots = new Set<string>(SLOTS);
    for (const i of items) {
      expect(typeof i.id).toBe('number');
      expect(typeof i.name).toBe('string');
      expect(slots.has(i.slot as string)).toBe(true);
      expect(typeof i.tradeable).toBe('boolean');
      expect(typeof i.twoHanded).toBe('boolean');
      expect(i.icon).toBe(`${i.id}.png`);
    }
  });

  it('ids and names are unique (canonical collapse held)', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.name)).size).toBe(items.length);
  });

  it('every ammo item is classified; launchers require a real class', () => {
    const classes = new Set(['arrow', 'bolt', 'javelin', 'tar', 'atlatl', 'any']);
    for (const i of items) {
      if (i.slot === 'ammo') expect(classes.has(i.ammoClass as string)).toBe(true);
      if (i.requiredAmmo !== undefined) {
        expect(i.slot).toBe('weapon');
        expect(classes.has(i.requiredAmmo as string) && i.requiredAmmo !== 'any').toBe(true);
      }
    }
  });

  it('every icon file exists on disk', () => {
    const files = new Set(readdirSync('public/img/items'));
    const missing = items.filter((i) => !files.has(i.icon as string));
    expect(missing.map((i) => i.name)).toEqual([]);
  });
});

describe('generated prices.json', () => {
  it('prices only tradeable pooled items, all positive ints', () => {
    const items = load('equipment.json') as { id: number; tradeable: boolean }[];
    const prices = load('prices.json') as Record<string, number>;
    const tradeable = new Set(items.filter((i) => i.tradeable).map((i) => i.id));
    for (const [id, gp] of Object.entries(prices)) {
      expect(tradeable.has(Number(id))).toBe(true);
      expect(Number.isInteger(gp) && gp >= 0).toBe(true);
    }
  });
});

describe('generated bosses.json', () => {
  it('bosses are well-formed and their images exist', () => {
    const bosses = load('bosses.json') as { name: string; image: string; tags: string[] }[];
    expect(bosses.length).toBeGreaterThan(40);
    const files = new Set(readdirSync('public/img/bosses'));
    for (const b of bosses) {
      expect(typeof b.name).toBe('string');
      expect(Array.isArray(b.tags)).toBe(true);
      expect(files.has(b.image)).toBe(true);
    }
  });
});
