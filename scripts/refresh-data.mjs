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

  // Collapse to one canonical entry per item name.
  const prio = curation.canonicalization.versionPriority;
  const rank = (v) => {
    const i = prio.indexOf(v ?? '');
    return i === -1 ? prio.length : i;
  };
  const byName = new Map();
  for (const e of kept) {
    const cur = byName.get(e.name);
    if (!cur || rank(e.version) < rank(cur.version)) byName.set(e.name, e);
  }
  const pool = [...byName.values()];
  console.log(`  ${kept.length} after exclusions, ${pool.length} canonical items`);

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

  // ---- 3. Ammo classification -------------------------------------------
  const { classRules, weaponAmmoOverrides, categoryAmmoMap, selfAmmoWeapons, exclusiveClasses } = curation.ammo;
  const rules = classRules.map((r) => ({ re: new RegExp(r.pattern, 'i'), cls: r.class }));
  const selfAmmo = new Set(selfAmmoWeapons.names);
  const exclusive = new Set(exclusiveClasses.classes);

  const ammoClassOf = (item) => rules.find((r) => r.re.test(item.name))?.cls ?? 'any';
  const requiredAmmoOf = (item) => {
    if (weaponAmmoOverrides[item.name]) return weaponAmmoOverrides[item.name];
    if (selfAmmo.has(item.name)) return null;
    return categoryAmmoMap[item.category] ?? null;
  };

  // ---- 4. App-facing equipment schema -----------------------------------
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

  // Tier assignment: zero power = junk; the rest bucket by percentile WITHIN
  // their slot (common 45% / decent 30% / strong 17% / elite top 8%).
  const tiers = new Map(); // id -> tier
  for (const slot of SLOTS) {
    const slotItems = pool.filter((e) => e.slot === slot);
    const scored = slotItems
      .map((e) => ({ e, p: powerOf(e) }))
      .sort((a, b) => a.p - b.p);
    const nonJunk = scored.filter((s) => s.p > 0);
    for (const s of scored) {
      if (s.p <= 0) {
        tiers.set(s.e.id, 'junk');
        continue;
      }
      const pct = nonJunk.findIndex((x) => x === s) / nonJunk.length;
      tiers.set(s.e.id, pct < 0.45 ? 'common' : pct < 0.75 ? 'decent' : pct < 0.92 ? 'strong' : 'elite');
    }
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
      ammoClass: e.slot === 'ammo' ? ammoClassOf(e) : undefined,
      ammoExclusive: e.slot === 'ammo' && exclusive.has(ammoClassOf(e)) ? true : undefined,
      requiredAmmo: e.slot === 'weapon' ? requiredAmmoOf(e) ?? undefined : undefined,
      tier: tiers.get(e.id),
      speed: e.slot === 'weapon' && e.speed > 0 ? e.speed : undefined,
      offensive: e.offensive,
      defensive: e.defensive,
      bonuses: e.bonuses,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---- 5. Downloads ------------------------------------------------------
  for (const dir of ['public/data', 'public/img/items', 'public/img/bosses', 'public/img/slots']) {
    await mkdir(path.join(ROOT, dir), { recursive: true });
  }

  const iconJobs = pool
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
    bosses.map((b) => ({ name: b.name, image: b.image, tags: b.tags })),
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
