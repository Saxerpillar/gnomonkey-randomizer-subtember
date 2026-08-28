// Gnome Subtember data pipeline. Run: npm run refresh-data
// Vendors everything the app needs into public/ so the app itself makes zero
// network calls. Curated inputs live in data/; everything this script writes
// is generated and committed. JSON writes are atomic (tmp -> rename); image
// downloads skip files that already exist, so re-runs are cheap and resumable.
// Any fetch failure is fatal (loud) - no partially-written JSON.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DPS_RAW = 'https://raw.githubusercontent.com/weirdgloop/osrs-dps-calc/main';
const WIKI_IMG = 'https://oldschool.runescape.wiki/images';
const PRICES_API = 'https://prices.runescape.wiki/api/v1/osrs';
const UA = 'gnome-subtember/0.1 (local gear-roll prototype data script)';

const SLOTS = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
};

const fetchBinary = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

const writeJsonAtomic = async (file, value) => {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 1) + '\n');
  await rename(tmp, file);
};

/** Run tasks with bounded concurrency; collect errors, throw at the end. */
const pooled = async (items, limit, fn) => {
  const errors = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        await fn(item);
      } catch (e) {
        errors.push(`${e.message}`);
      }
    }
  });
  await Promise.all(workers);
  if (errors.length) throw new Error(`${errors.length} download(s) failed:\n${errors.slice(0, 10).join('\n')}`);
};

const main = async () => {
  const curation = JSON.parse(await readFile(path.join(ROOT, 'data/curation.json'), 'utf8'));
  const bosses = JSON.parse(await readFile(path.join(ROOT, 'data/bosses.json'), 'utf8'));

  // ---- 1. Equipment pool -------------------------------------------------
  console.log('Fetching equipment.json ...');
  const raw = await fetchJson(`${DPS_RAW}/cdn/json/equipment.json`);
  console.log(`  ${raw.length} raw entries`);

  const { versionBlocklist, namePatterns, ids, questOnlyNames } = curation.poolExclusions;
  const nameRes = namePatterns.map((p) => new RegExp(p, 'i'));
  const excludedIds = new Set(ids);
  const versionBlocked = new Set(versionBlocklist);
  const questOnly = new Set(questOnlyNames ?? []);

  const kept = raw.filter(
    (e) =>
      SLOTS.includes(e.slot) &&
      Number.isInteger(e.id) &&
      e.id > 0 &&
      e.image &&
      !versionBlocked.has(e.version) &&
      !excludedIds.has(e.id) &&
      !questOnly.has(e.name) &&
      !nameRes.some((re) => re.test(e.name)),
  );

  // Poisoned ammo arrives under the SAME name as its clean version — upstream
  // puts the distinction in `version`, not the name — so the collapse below
  // would silently keep one of four. Rebuild the suffix so each is its own
  // roll. Ammo only: the same collision affects ~141 poisoned weapons, but
  // those would double the weapon pool with entries that differ by a passive
  // the stat formula cannot see anyway.
  const POISON_SUFFIX = { Poison: ' (p)', 'Poison+': ' (p+)', 'Poison++': ' (p++)' };
  for (const e of kept) {
    if (e.slot === 'ammo' && POISON_SUFFIX[e.version]) e.name += POISON_SUFFIX[e.version];
  }

  // Weapons take the opposite route. A poisoned weapon is stat-identical to its
  // clean version, so adding all 141 as separate entries would inflate the
  // dagger and spear families and change how often a dagger rolls at all.
  // Instead they ride along on the base weapon and are picked by a second,
  // independent draw at roll time — the odds of rolling that weapon are
  // untouched, and the poison is decided afterwards.
  //
  // They are also pulled out of the collapse below. versionPriority ranks
  // "Poison" above "Unpoisoned", so leaving them in meant the POISONED id won
  // the base name: the pool's "Rune dagger" was id 1229, the poisoned one,
  // showing a poisoned sprite under a clean label.
  const poisonVariants = new Map(); // base weapon name -> variants
  const rollable = [];
  for (const e of kept) {
    const suffix = e.slot === 'weapon' ? POISON_SUFFIX[e.version] : undefined;
    if (!suffix) {
      rollable.push(e);
      continue;
    }
    const list = poisonVariants.get(e.name) ?? [];
    list.push({ id: e.id, name: e.name + suffix, icon: `${e.id}.png`, image: e.image });
    poisonVariants.set(e.name, list);
  }

  // Collapse to one canonical entry per item name.
  const prio = curation.canonicalization.versionPriority;
  const rank = (v) => {
    const i = prio.indexOf(v ?? '');
    return i === -1 ? prio.length : i;
  };
  const byName = new Map();
  for (const e of rollable) {
    const cur = byName.get(e.name);
    if (!cur || rank(e.version) < rank(cur.version)) byName.set(e.name, e);
  }
  // Crude combat-power composite: best attack bonus + best damage bonus +
  // scaled defence + prayer. Only used RELATIVELY, per slot, to bucket items
  // into rarity tiers — percentiles absorb the formula's crudeness.
  // Weights: damage wins fights, so it carries the most; accuracy matters but
  // less; defence is heavily discounted (its raw sums dwarf everything —
  // Bandos chestplate totals 423 where the best damage bonus in the game is
  // 75); prayer is slightly discounted. magic_str is stored as percent x10,
  // so it is rescaled into melee-strength units (Occult 50 -> 10, level with
  // Amulet of torture's +10 str) before being weighed as damage.
  const MAGIC_SCALE = 5;
  const powerOf = (e) => {
    const damage = Math.max(
      e.bonuses.str,
      e.bonuses.ranged_str,
      e.bonuses.magic_str / MAGIC_SCALE,
      0,
    );
    return (
      Math.max(...Object.values(e.offensive), 0) * 1.0 +
      damage * 2.5 +
      Object.values(e.defensive).reduce((a, b) => a + b, 0) * 0.08 +
      Math.max(e.bonuses.prayer, 0) * 0.5
    );
  };

  // Anything with no combat stats at all is not gear — a cosmetic cape with
  // zero bonuses has no place in a gear randomiser, the same reasoning that
  // drops skilling tools. Cutting them here also lets junk become a real
  // low-power BAND rather than a synonym for "unstatted", which is what makes
  // a target tier distribution reachable at all.
  const canonical = [...byName.values()];
  const pool = canonical.filter((e) => powerOf(e) > 0);
  console.log(
    `  ${kept.length} after exclusions, ${canonical.length} canonical, ` +
      `${pool.length} with combat stats (${canonical.length - pool.length} stat-less dropped)`,
  );

  // ---- 2. Prices ---------------------------------------------------------
  console.log('Fetching GE mapping + latest prices ...');
  const mapping = await fetchJson(`${PRICES_API}/mapping`);
  const latest = (await fetchJson(`${PRICES_API}/latest`)).data;
  const tradeableIds = new Set(mapping.map((m) => m.id));

  const prices = {};
  for (const item of pool) {
    if (!tradeableIds.has(item.id)) continue;
    const p = latest[item.id];
    if (!p) continue;
    const { high, low } = p;
    const mid = high != null && low != null ? Math.round((high + low) / 2) : (high ?? low);
    if (mid != null) prices[item.id] = mid;
  }
  console.log(`  ${Object.keys(prices).length} priced items`);

  // ---- 3. Ammo compatibility (family + tier) -----------------------------
  // A weapon fires ammo of its FAMILY whose TIER is at most its maxTier —
  // exactly the wiki's "up to mithril arrows" rule. Families with a null
  // maxTier are exclusive (kebbit bolts, atlatl darts, bolt racks...).
  const { familyRules, tierTables, ammoOverrides, weaponAmmo, categoryDefaults, exclusiveFamilies } =
    curation.ammo;
  const famRules = familyRules.map((r) => ({ re: new RegExp(r.pattern, 'i'), family: r.family }));
  const exclusiveFams = new Set(exclusiveFamilies.families);

  /** Highest-matching metal word in a name ("dragonstone" beats "dragon"). */
  const metalTier = (name, table) => {
    const keys = Object.keys(table)
      .filter((k) => k !== '//')
      .sort((a, b) => b.length - a.length);
    const hit = keys.find((m) => new RegExp(`\\b${m}`, 'i').test(name));
    return hit ? table[hit] : null;
  };

  const ammoSpecOf = (item) => {
    const override = ammoOverrides[item.name];
    if (override && !override['//']) return override;
    const family = famRules.find((r) => r.re.test(item.name))?.family ?? 'any';
    if (family === 'any') return { family, tier: 0 };
    const table = tierTables[family === 'bolt' ? 'bolt' : 'arrow'];
    return { family, tier: metalTier(item.name, table) ?? 0 };
  };

  const weaponSpecOf = (item) => {
    // Exact name, then progressively shorter base names so cosmetic/charged
    // variants ("Bow of Faerdhinen (c) (Amlodd)") inherit the base weapon's
    // rule rather than falling back to the whole category.
    let name = item.name;
    while (name) {
      const named = weaponAmmo[name];
      if (named) return named.family ? named : null; // null family = self-loading
      const trimmed = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (trimmed === name) break;
      name = trimmed;
    }
    const fallback = categoryDefaults[item.category];
    return fallback && !fallback['//'] ? fallback : null;
  };

  // ---- 4. App-facing equipment schema -----------------------------------
  /**
   * Target share of each tier, within every slot. Every item in the pool now
   * has combat stats, so these are pure percentile bands — an item is junk
   * because it is in the weakest fifth of its slot, not because it has no
   * stats at all.
   *
   * Ties are resolved by rank, so a run of identically-powered items can push
   * a band's real share slightly off target; that is the "unless there are
   * literal ties" case and it is why these are targets rather than guarantees.
   */
  const TIER_TARGET = { junk: 0.2, common: 0.35, decent: 0.2, strong: 0.15, elite: 0.1 };
  const TIER_CUTS = (() => {
    const order = ['junk', 'common', 'decent', 'strong', 'elite'];
    let acc = 0;
    return order.map((tier) => ({ tier, upto: (acc += TIER_TARGET[tier]) }));
  })();

  const tiers = new Map(); // id -> tier
  for (const slot of SLOTS) {
    const scored = pool
      .filter((e) => e.slot === slot)
      .map((e) => ({ e, p: powerOf(e) }))
      .sort((a, b) => a.p - b.p);
    scored.forEach((s, i) => {
      const pct = i / scored.length;
      tiers.set(s.e.id, (TIER_CUTS.find((c) => pct < c.upto) ?? TIER_CUTS.at(-1)).tier);
    });
  }
  // Manual fixes for passive-power items the stat formula can't see.
  for (const e of pool) {
    const override = curation.tierOverrides[e.name];
    if (override && typeof override === 'string' && !override.startsWith('//')) tiers.set(e.id, override);
  }
  // Cape and ammo never reach elite: nothing in those slots swings a fight the
  // way a weapon or a BIS ring does, and their raw stats mislead (ogre arrows
  // carry huge ranged_str). Their ceiling is 'strong'.
  const NO_ELITE_SLOTS = new Set(['cape', 'ammo']);
  for (const e of pool) {
    if (NO_ELITE_SLOTS.has(e.slot) && tiers.get(e.id) === 'elite') tiers.set(e.id, 'strong');
  }

  const appItems = pool
    .map((e) => ({
      id: e.id,
      name: e.name,
      version: e.version || undefined,
      slot: e.slot,
      icon: `${e.id}.png`,
      tradeable: tradeableIds.has(e.id),
      twoHanded: !!e.isTwoHanded,
      category: e.category || undefined,
      ammoClass: e.slot === 'ammo' ? ammoSpecOf(e).family : undefined,
      ammoTier: e.slot === 'ammo' ? ammoSpecOf(e).tier : undefined,
      ammoExclusive:
        e.slot === 'ammo' && exclusiveFams.has(ammoSpecOf(e).family) ? true : undefined,
      requiredAmmo: e.slot === 'weapon' ? weaponSpecOf(e)?.family ?? undefined : undefined,
      ammoMaxTier: e.slot === 'weapon' ? weaponSpecOf(e)?.maxTier ?? undefined : undefined,
      tier: tiers.get(e.id),
      speed: e.slot === 'weapon' && e.speed > 0 ? e.speed : undefined,
      // Cosmetic riders: same stats, same price, different label and sprite.
      poison: poisonVariants.get(e.name)?.map(({ id, name, icon }) => ({ id, name, icon })),
      offensive: e.offensive,
      defensive: e.defensive,
      bonuses: e.bonuses,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---- 5. Downloads ------------------------------------------------------
  for (const dir of ['public/data', 'public/img/items', 'public/img/bosses', 'public/img/slots']) {
    await mkdir(path.join(ROOT, dir), { recursive: true });
  }

  const iconJobs = [
    ...pool,
    // Poisoned weapons are not in the pool, but their sprites still have to be
    // on disk for the substituted item to render.
    ...[...poisonVariants.values()].flat(),
  ]
    .map((e) => ({
      url: `${DPS_RAW}/cdn/equipment/${encodeURIComponent(e.image)}`,
      dest: path.join(ROOT, 'public/img/items', `${e.id}.png`),
      label: e.name,
    }))
    .filter((j) => !existsSync(j.dest));
  console.log(`Downloading ${iconJobs.length} item icons (rest already present) ...`);
  await pooled(iconJobs, 12, async (j) => writeFile(j.dest, await fetchBinary(j.url)));

  const bossJobs = bosses
    .map((b) => ({
      url: `${DPS_RAW}/cdn/monsters/${encodeURIComponent(b.image)}`,
      dest: path.join(ROOT, 'public/img/bosses', b.image),
    }))
    .filter((j) => !existsSync(j.dest));
  console.log(`Downloading ${bossJobs.length} boss images ...`);
  await pooled(bossJobs, 8, async (j) => writeFile(j.dest, await fetchBinary(j.url)));

  // Slot sprites: authentic wiki interface tiles, dps-calc ghost icons as fallback.
  const slotJobs = SLOTS.map((slot) => ({ slot, dest: path.join(ROOT, 'public/img/slots', `${slot}.png`) })).filter(
    (j) => !existsSync(j.dest),
  );
  console.log(`Downloading ${slotJobs.length} slot sprites ...`);
  await pooled(slotJobs, 6, async ({ slot, dest }) => {
    const wikiName = `${slot[0].toUpperCase()}${slot.slice(1)}_slot.png`;
    try {
      await writeFile(dest, await fetchBinary(`${WIKI_IMG}/${wikiName}`));
    } catch {
      await writeFile(dest, await fetchBinary(`${DPS_RAW}/src/public/img/slots/${slot}.png`));
      console.log(`  ${slot}: wiki sprite unavailable, used dps-calc ghost icon`);
    }
  });

  // Coins sprite (gp value readouts).
  const coinsDest = path.join(ROOT, 'public/img/coins.png');
  if (!existsSync(coinsDest)) {
    console.log('Downloading coins sprite ...');
    await writeFile(coinsDest, await fetchBinary(`${WIKI_IMG}/Coins_10000.png`));
  }

  // Small UI icons (header anchors). Missing one is a warning — the UI hides it.
  await mkdir(path.join(ROOT, 'public/img/ui'), { recursive: true });
  const UI_ICONS = [
    ['multicombat.png', 'Multicombat.png'], // crossed swords — "Your gear"
    ['skull.png', 'Skull_(status)_icon.png'], // "Your fate"
  ];
  for (const [local, wiki] of UI_ICONS) {
    const dest = path.join(ROOT, 'public/img/ui', local);
    if (existsSync(dest)) continue;
    try {
      await writeFile(dest, await fetchBinary(`${WIKI_IMG}/${wiki}`));
      console.log(`Downloaded ui/${local}`);
    } catch {
      console.log(`  WARN no wiki icon "${wiki}" — UI will render text-only`);
    }
  }

  // ---- 5b. Spells ------------------------------------------------------
  // Damaging combat spells for the castable-staff spell roll. Icons come from
  // the wiki; a missing icon is a warning, not a failure (UI falls back to text).
  console.log('Fetching spells.json ...');
  const spellsRaw = await fetchJson(`${DPS_RAW}/cdn/json/spells.json`);
  const spellCfg = curation.spells;
  const excludedSpell = spellCfg.excludedNamePatterns.map((p) => new RegExp(p, 'i'));
  const forceInclude = new Set(spellCfg.forceInclude.names);
  const appSpells = spellsRaw
    .filter((s) => (s.max_hit > 0 || forceInclude.has(s.name)) && !excludedSpell.some((re) => re.test(s.name)))
    .map((s) => ({
      name: s.name,
      icon: `${s.name.replace(/[^a-z0-9]+/gi, '_')}.png`,
      image: s.image,
      book: s.spellbook,
      maxHit: s.max_hit,
      requiresWeapon: spellCfg.weaponLocked[s.name],
    }));
  await mkdir(path.join(ROOT, 'public/img/spells'), { recursive: true });
  const spellIconJobs = appSpells
    .map((s) => ({ s, dest: path.join(ROOT, 'public/img/spells', s.icon) }))
    .filter((j) => !existsSync(j.dest));
  console.log(`Downloading ${spellIconJobs.length} spell icons ...`);
  let missingSpellIcons = 0;
  for (const { s, dest } of spellIconJobs) {
    try {
      await writeFile(dest, await fetchBinary(`${WIKI_IMG}/${s.image.replace(/ /g, '_')}`));
    } catch {
      missingSpellIcons++;
      console.log(`  WARN no wiki icon for "${s.name}" — UI will show text only`);
    }
  }
  if (missingSpellIcons) console.log(`  ${missingSpellIcons} spell icon(s) missing`);
  for (const s of appSpells) delete s.image; // app uses the local icon name only

  // ---- 6. Atomic JSON writes --------------------------------------------
  await writeJsonAtomic(path.join(ROOT, 'public/data/equipment.json'), appItems);
  await writeJsonAtomic(path.join(ROOT, 'public/data/prices.json'), prices);
  await writeJsonAtomic(path.join(ROOT, 'public/data/spells.json'), appSpells);
  await writeJsonAtomic(
    path.join(ROOT, 'public/data/bosses.json'),
    bosses.map((b) => ({
      name: b.name,
      image: b.image,
      tags: b.tags,
      ...(b.style ? { style: b.style } : {}),
      ...(b.noMeleeWeapons ? { noMeleeWeapons: b.noMeleeWeapons } : {}),
      ...(b.meleeExceptions?.length ? { meleeExceptions: b.meleeExceptions } : {}),
    })),
  );

  const weapons = appItems.filter((i) => i.slot === 'weapon');
  console.log(
    `Done. ${appItems.length} items (${appItems.filter((i) => i.tradeable).length} tradeable), ` +
      `${weapons.length} weapons (${weapons.filter((w) => w.requiredAmmo).length} need ammo), ${bosses.length} bosses.`,
  );
};

main().catch((e) => {
  console.error(`refresh-data FAILED: ${e.message}`);
  process.exit(1);
});
