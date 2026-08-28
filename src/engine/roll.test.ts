import { describe, expect, it } from 'vitest';
import {
  filterWeaponsFor,
  gearScore,
  GEAR_SCORE_MAX,
  GEAR_SCORE_MIN,
  loadoutValue,
  roll,
  rerollSlot,
} from './roll';
import { mulberry32 } from './rng';
import {
  CORE_SLOTS,
  costOf,
  emptyLoadout,
  SLOTS,
  type Item,
  type Loadout,
  type RollSettings,
  type Slot,
  type Tier,
} from './types';

let nextId = 1;
const zeroOff = () => ({ stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 });
const item = (slot: Slot, over: Partial<Item> = {}): Item => ({
  id: nextId++,
  name: over.name ?? `${slot}-${nextId}`,
  slot,
  icon: 'x.png',
  tradeable: true,
  twoHanded: false,
  price: 1000,
  tier: 'common',
  offensive: zeroOff(),
  defensive: zeroOff(),
  bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
  ...over,
});

/** A small pool with a few of everything. */
const basicPool = (): Item[] => [
  ...SLOTS.filter((s) => s !== 'weapon' && s !== 'ammo').flatMap((s) => [
    item(s, { price: 100 }),
    item(s, { price: 10_000 }),
    item(s, { price: 2_000_000 }),
  ]),
  item('weapon', { name: 'cheap sword', price: 500 }),
  item('weapon', { name: 'mid bow', price: 50_000, category: 'Bow', requiredAmmo: 'arrow' }),
  item('weapon', { name: 'big 2h', price: 5_000_000, twoHanded: true }),
  item('ammo', { name: 'arrows', price: 50, ammoClass: 'arrow' }),
  item('ammo', { name: 'bolts', price: 50, ammoClass: 'bolt' }),
  item('ammo', { name: 'blessing', price: 80_000, ammoClass: 'any' }),
];

const settings = (over: Partial<RollSettings> = {}): RollSettings => ({
  budget: null,
  allowUntradeables: false,
  ...over,
});

const rolledCost = (loadout: Loadout): number =>
  SLOTS.reduce((sum, s) => {
    const it = loadout[s];
    return sum + (it ? costOf(it) : 0);
  }, 0);

const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

describe('budget', () => {
  it('never exceeds the budget across many seeds', () => {
    const pool = basicPool();
    for (const budget of [0, 500, 100_000, 10_000_000]) {
      for (const seed of seeds) {
        const out = roll(pool, settings({ budget }), mulberry32(seed));
        expect(rolledCost(out)).toBeLessThanOrEqual(budget);
      }
    }
  });

  it('budget 0 with tradeables-only rolls nothing', () => {
    const out = roll(basicPool(), settings({ budget: 0 }), mulberry32(1));
    expect(SLOTS.every((s) => out[s] === null)).toBe(true);
  });

  it('huge budget fills every slot', () => {
    const out = roll(basicPool(), settings({ budget: 1_000_000_000 }), mulberry32(1));
    // A 2h may legitimately empty the shield, and ammo only rolls behind a
    // weapon that consumes it; every other slot must fill.
    const mustFill = SLOTS.filter((s) => s !== 'shield' && s !== 'ammo');
    expect(mustFill.every((s) => out[s] !== null)).toBe(true);
  });
});

describe('untradeables', () => {
  const poolWithUntradeable = () => [
    ...basicPool(),
    item('cape', { name: 'fire cape', tradeable: false, price: undefined }),
  ];

  it('never rolls untradeables when toggle is off', () => {
    for (const seed of seeds) {
      const out = roll(poolWithUntradeable(), settings(), mulberry32(seed));
      expect(SLOTS.every((s) => out[s]?.tradeable !== false)).toBe(true);
    }
  });

  it('rolls untradeables at cost 0 when allowed', () => {
    const pool = [item('cape', { name: 'fire cape', tradeable: false, price: undefined })];
    const out = roll(pool, settings({ budget: 0, allowUntradeables: true }), mulberry32(1));
    expect(out.cape?.name).toBe('fire cape');
    expect(rolledCost(out)).toBe(0);
  });
});

describe('2h vs shield', () => {
  it('a rolled 2h always empties the shield', () => {
    const pool = [item('weapon', { name: 'only 2h', twoHanded: true }), item('shield')];
    for (const seed of seeds.slice(0, 50)) {
      const out = roll(pool, settings(), mulberry32(seed));
      expect(out.weapon?.twoHanded).toBe(true);
      expect(out.shield).toBeNull();
    }
  });
});

describe('ammo compatibility', () => {
  it('launcher weapons only roll their ammo class (ballista override case)', () => {
    const pool = [
      item('weapon', { name: 'ballista', category: 'Crossbow', requiredAmmo: 'javelin' }),
      item('ammo', { name: 'javelins', ammoClass: 'javelin' }),
      item('ammo', { name: 'bolts', ammoClass: 'bolt' }),
      item('ammo', { name: 'blessing', ammoClass: 'any' }),
    ];
    for (const seed of seeds.slice(0, 50)) {
      const out = roll(pool, settings(), mulberry32(seed));
      expect(out.ammo?.name).toBe('javelins');
    }
  });

  it('a weapon that consumes no ammo leaves the ammo slot empty', () => {
    const pool = [
      item('weapon', { name: 'melee sword' }),
      item('ammo', { name: 'blessing', ammoClass: 'any' }),
      item('ammo', { name: 'arrows', ammoClass: 'arrow' }),
    ];
    for (const seed of seeds) {
      expect(roll(pool, settings(), mulberry32(seed)).ammo).toBeNull();
    }
  });

  it('ammo respects the weapon tier ceiling', () => {
    const pool = [
      item('weapon', { name: 'bronze crossbow', requiredAmmo: 'bolt', ammoMaxTier: 1 }),
      item('ammo', { name: 'bronze bolts', ammoClass: 'bolt', ammoTier: 1 }),
      item('ammo', { name: 'runite bolts', ammoClass: 'bolt', ammoTier: 7 }),
    ];
    for (const seed of seeds) {
      expect(roll(pool, settings(), mulberry32(seed)).ammo?.name).toBe('bronze bolts');
    }
  });

  it('exclusive ammo never rolls without its weapon (blowpipe + atlatl dart bug)', () => {
    const pool = [
      item('weapon', { name: 'Ironwood blowpipe', category: 'Thrown', twoHanded: true }),
      item('ammo', { name: 'Atlatl dart', ammoClass: 'atlatl', ammoExclusive: true }),
      item('ammo', { name: 'Guam tar', ammoClass: 'tar', ammoExclusive: true }),
      item('ammo', { name: 'blessing', ammoClass: 'any' }),
    ];
    for (const seed of seeds) {
      const out = roll(pool, settings(), mulberry32(seed));
      expect(out.ammo?.name ?? 'blessing').toBe('blessing');
    }
  });

  it('exclusive ammo still rolls for the weapon that requires it', () => {
    const pool = [
      item('weapon', { name: 'Eclipse atlatl', category: 'Bow', requiredAmmo: 'atlatl' }),
      item('ammo', { name: 'Atlatl dart', ammoClass: 'atlatl', ammoExclusive: true }),
      item('ammo', { name: 'arrows', ammoClass: 'arrow' }),
    ];
    for (const seed of seeds.slice(0, 50)) {
      const out = roll(pool, settings(), mulberry32(seed));
      expect(out.ammo?.name).toBe('Atlatl dart');
    }
  });
});

describe('rerollSlot', () => {
  const base = (): Loadout => {
    const l = roll(basicPool(), settings(), mulberry32(5));
    return l;
  };

  it('changes only the target slot', () => {
    const pool = basicPool();
    const before = base();
    const after = rerollSlot(pool, before, 'head', settings(), mulberry32(9));
    for (const s of SLOTS) {
      if (s === 'head') continue;
      expect(after[s]).toBe(before[s]);
    }
  });

  it('respects the budget left by the other slots', () => {
    const pool = [
      item('head', { name: 'cheap hat', price: 100 }),
      item('head', { name: 'lavish hat', price: 5_000_000 }),
      item('body', { name: 'body', price: 900 }),
    ];
    const start = roll(pool, settings({ budget: 1000 }), mulberry32(3));
    for (const seed of seeds.slice(0, 50)) {
      const after = rerollSlot(pool, start, 'head', settings({ budget: 1000 }), mulberry32(seed));
      const spentElsewhere = SLOTS.reduce(
        (sum, s) => sum + (s === 'head' ? 0 : costOf(after[s] ?? ({ tradeable: false } as Item))),
        0,
      );
      expect(costOf(after.head!) + spentElsewhere).toBeLessThanOrEqual(1000);
    }
  });

  it('a rerolled 2h weapon clears the shield and its ammo', () => {
    const pool = [item('weapon', { name: 'only 2h', twoHanded: true })];
    const start: Loadout = {
      ...roll([], settings(), mulberry32(1)),
      weapon: item('weapon', { name: 'old 1h' }),
      shield: item('shield', { name: 'kite' }),
      ammo: item('ammo', { name: 'arrows', ammoClass: 'arrow' }),
    };
    const after = rerollSlot(pool, start, 'weapon', settings(), mulberry32(2));
    expect(after.weapon?.twoHanded).toBe(true);
    expect(after.shield).toBeNull();
    // A melee weapon consumes no ammo, so the arrows are dropped with it.
    expect(after.ammo).toBeNull();
  });

  it('a rerolled launcher drops ammo it cannot fire', () => {
    const pool = [item('weapon', { name: 'crossbow', category: 'Crossbow', requiredAmmo: 'bolt' })];
    const start: Loadout = {
      ...roll([], settings(), mulberry32(1)),
      weapon: item('weapon', { name: 'old bow', category: 'Bow', requiredAmmo: 'arrow' }),
      ammo: item('ammo', { name: 'arrows', ammoClass: 'arrow' }),
    };
    const after = rerollSlot(pool, start, 'weapon', settings(), mulberry32(2));
    expect(after.weapon?.name).toBe('crossbow');
    expect(after.ammo).toBeNull(); // arrows cannot go in a crossbow
  });

  it('rerolling the shield under a 2h weapon is a no-op', () => {
    const start: Loadout = {
      ...roll([], settings(), mulberry32(1)),
      weapon: item('weapon', { name: 'big 2h', twoHanded: true }),
    };
    const after = rerollSlot([item('shield', { name: 'kite' })], start, 'shield', settings(), mulberry32(4));
    expect(after).toBe(start);
    expect(after.shield).toBeNull();
  });

  it('keeps ammo compatible with the equipped weapon', () => {
    const pool = [
      item('ammo', { name: 'arrows', ammoClass: 'arrow' }),
      item('ammo', { name: 'bolts', ammoClass: 'bolt' }),
    ];
    const start: Loadout = {
      ...roll([], settings(), mulberry32(1)),
      weapon: item('weapon', { name: 'bow', category: 'Bow', requiredAmmo: 'arrow' }),
    };
    for (const seed of seeds.slice(0, 40)) {
      const after = rerollSlot(pool, start, 'ammo', settings(), mulberry32(seed));
      expect(after.ammo?.name).toBe('arrows');
    }
  });

  it('leaves the slot untouched when nothing is affordable', () => {
    const pool = [item('head', { name: 'pricey', price: 9_000_000 })];
    const start: Loadout = { ...roll([], settings(), mulberry32(1)), head: item('head', { name: 'kept' }) };
    const after = rerollSlot(pool, start, 'head', settings({ budget: 10 }), mulberry32(6));
    expect(after.head?.name).toBe('kept');
  });

  it('is deterministic for a given seed', () => {
    const pool = basicPool();
    const start = base();
    const a = rerollSlot(pool, start, 'legs', settings(), mulberry32(77));
    const b = rerollSlot(pool, start, 'legs', settings(), mulberry32(77));
    expect(a.legs).toEqual(b.legs);
  });
});

describe('rarity tiers', () => {
  const tieredWeapons = () => [
    ...Array.from({ length: 20 }, (_, i) => item('weapon', { name: `junk-${i}`, tier: 'junk' as const })),
    ...Array.from({ length: 20 }, (_, i) => item('weapon', { name: `elite-${i}`, tier: 'elite' as const })),
  ];

  it('junk weapons become rare, not ~50%, despite equal pool share', () => {
    const pool = tieredWeapons();
    let junk = 0;
    const n = 800;
    for (let seed = 1; seed <= n; seed++) {
      const out = roll(pool, settings(), mulberry32(seed));
      if (out.weapon?.tier === 'junk') junk++;
    }
    // weapon table: junk 2 vs elite 10 -> expect ~17% junk; assert well under uniform 50%
    expect(junk / n).toBeLessThan(0.3);
    expect(junk).toBeGreaterThan(0); // chaos survives as a punchline
  });

  it('falls back to whatever tier is affordable under a tight budget', () => {
    const pool = [
      item('weapon', { name: 'cheap junk', tier: 'junk', price: 100 }),
      item('weapon', { name: 'pricey elite', tier: 'elite', price: 1_000_000 }),
    ];
    for (let seed = 1; seed <= 50; seed++) {
      const out = roll(pool, settings({ budget: 500 }), mulberry32(seed));
      expect(out.weapon?.name).toBe('cheap junk');
    }
  });
});

describe('determinism', () => {
  it('same seed -> identical loadout; different seeds vary', () => {
    const pool = basicPool();
    const s = settings({ budget: 10_000_000 });
    const a = roll(pool, s, mulberry32(42));
    const b = roll(pool, s, mulberry32(42));
    expect(a).toEqual(b);
    const outputs = new Set(seeds.map((seed) => JSON.stringify(roll(pool, s, mulberry32(seed)))));
    expect(outputs.size).toBeGreaterThan(1);
  });
});

describe('minWeaponTier', () => {
  const tieredWeapons = () => [
    ...Array.from({ length: 10 }, (_, i) => item('weapon', { name: `junk-${i}`, tier: 'junk' })),
    ...Array.from({ length: 10 }, (_, i) => item('weapon', { name: `common-${i}`, tier: 'common' })),
    ...Array.from({ length: 10 }, (_, i) => item('weapon', { name: `decent-${i}`, tier: 'decent' })),
    ...Array.from({ length: 10 }, (_, i) => item('weapon', { name: `strong-${i}`, tier: 'strong' })),
    ...Array.from({ length: 10 }, (_, i) => item('weapon', { name: `elite-${i}`, tier: 'elite' })),
  ];

  it('weapons never fall below the floor', () => {
    for (const seed of seeds.slice(0, 100)) {
      const out = roll(tieredWeapons(), settings({ minWeaponTier: 'decent' }), mulberry32(seed));
      expect(out.weapon?.tier).not.toBe('junk');
      expect(out.weapon?.tier).not.toBe('common');
    }
  });

  it('a decent floor draws 50/35/15 across decent/strong/elite', () => {
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 900; seed++) {
      const w = roll(tieredWeapons(), settings({ minWeaponTier: 'decent' }), mulberry32(seed))
        .weapon!;
      counts.set(w.tier, (counts.get(w.tier) ?? 0) + 1);
    }
    expect((counts.get('decent') ?? 0) / 900).toBeGreaterThan(0.44);
    expect((counts.get('decent') ?? 0) / 900).toBeLessThan(0.56);
    expect((counts.get('strong') ?? 0) / 900).toBeGreaterThan(0.29);
    expect((counts.get('strong') ?? 0) / 900).toBeLessThan(0.41);
    expect((counts.get('elite') ?? 0) / 900).toBeGreaterThan(0.09);
    expect((counts.get('elite') ?? 0) / 900).toBeLessThan(0.21);
  });

  it('a strong floor excludes decent and draws 75/25 strong/elite', () => {
    for (const seed of seeds.slice(0, 100)) {
      const out = roll(tieredWeapons(), settings({ minWeaponTier: 'strong' }), mulberry32(seed));
      expect(['junk', 'common', 'decent']).not.toContain(out.weapon?.tier);
    }
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 900; seed++) {
      const w = roll(tieredWeapons(), settings({ minWeaponTier: 'strong' }), mulberry32(seed))
        .weapon!;
      counts.set(w.tier, (counts.get(w.tier) ?? 0) + 1);
    }
    expect((counts.get('strong') ?? 0) / 900).toBeGreaterThan(0.68);
    expect((counts.get('strong') ?? 0) / 900).toBeLessThan(0.82);
    expect((counts.get('elite') ?? 0) / 900).toBeGreaterThan(0.18);
    expect((counts.get('elite') ?? 0) / 900).toBeLessThan(0.32);
  });

  it('degrades to whatever is affordable when the floor is unreachable', () => {
    const pool = [
      item('weapon', { name: 'cheap junk', tier: 'junk', price: 100 }),
      item('weapon', { name: 'pricey elite', tier: 'elite', price: 1_000_000 }),
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const out = roll(pool, settings({ budget: 500, minWeaponTier: 'decent' }), mulberry32(seed));
      expect(out.weapon?.name).toBe('cheap junk');
    }
  });

  it('leaves non-weapon slots untouched', () => {
    const pool = [item('head', { name: 'junk hat', tier: 'junk' })];
    const out = roll(pool, settings({ minWeaponTier: 'decent' }), mulberry32(1));
    expect(out.head?.name).toBe('junk hat');
  });
});

describe('loadoutValue', () => {
  it('counts all equipped tradeables', () => {
    const out = roll(
      [item('head', { price: 300 }), item('body', { price: 5000 })],
      settings({ budget: 1_000_000 }),
      mulberry32(1),
    );
    expect(loadoutValue(out)).toBe(5300);
  });
});

describe('gearScore', () => {
  const withTier = (slot: Slot, tier: Tier) => item(slot, { name: `${slot}-${tier}`, tier });

  it('common-only kit scores the minimum', () => {
    const l = emptyLoadout();
    for (const s of CORE_SLOTS) l[s] = withTier(s, 'common');
    expect(gearScore(l)).toBe(GEAR_SCORE_MIN);
  });

  it('all-elite kit with ammo scores the maximum', () => {
    const l = emptyLoadout();
    for (const s of CORE_SLOTS) l[s] = withTier(s, 'elite');
    l.ammo = withTier('ammo', 'elite');
    expect(gearScore(l)).toBe(GEAR_SCORE_MAX);
  });

  it('the weapon counts double', () => {
    const l = emptyLoadout();
    l.weapon = withTier('weapon', 'strong');
    l.head = withTier('head', 'common');
    // head 1 + weapon strong 3x2 = 6
    expect(gearScore(l)).toBe(7);
  });
});

describe('filterWeaponsFor', () => {
  const pool = (): Item[] => [
    item('weapon', { name: 'sword', category: 'Slash Sword' }),
    item('weapon', { name: 'bow', category: 'Bow', requiredAmmo: 'arrow' }),
    item('weapon', { name: 'staff', category: 'Staff' }),
    item('weapon', { name: 'halberd', category: 'Polearm' }),
    item('body', { name: 'armour' }),
  ];

  it('no rule leaves the pool unchanged', () => {
    const p = pool();
    expect(filterWeaponsFor(p, null)).toBe(p);
    expect(filterWeaponsFor(p, {})).toBe(p);
  });

  it('noMelee drops every melee weapon, keeping the rest', () => {
    const out = filterWeaponsFor(pool(), { noMelee: true });
    expect(out.map((i) => i.name).sort()).toEqual(['armour', 'bow', 'staff']);
  });

  it('keeps the named melee exceptions (Zulrah / Kree\'arra rule)', () => {
    const out = filterWeaponsFor(pool(), { noMelee: true, meleeExceptions: ['halberd'] });
    expect(out.map((i) => i.name).sort()).toEqual(['armour', 'bow', 'halberd', 'staff']);
  });
});
