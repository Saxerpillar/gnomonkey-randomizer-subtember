# Gnome Subtember — session handoff (2026-07-29)

Written for whoever picks this up next. Everything below is committed on `master`.
Read this, then `docs/plans/2026-07-29-challenge-flow-requirements.md` — that doc is the
**current target UX** and supersedes the shipped two-panel layout.

## What this is

An OSRS challenge roller for a streamer: roll a **random gear loadout** (optional gp budget)
plus a **random boss** to kill with it. Stage 1 = polished local prototype. Stage 2 (later) =
Twitch app where subs/gifted subs influence rolls, with casino-style suspense animations.

**Viewer experience is the point** — the UI/feel matters more than feature count, because it
should make viewers want to subscribe to make things happen on screen.

## Run it

```
npm install
npm run dev          # http://localhost:5173
npm test             # 76 tests, all green
npm run refresh-data # re-vendors all data/assets (network); output is committed
```

The user smoke-tests in their own browser — do not drive a preview browser unless asked.

## Architecture (working, unchanged since the original design doc)

**Vendored-data static SPA**: Vite + React 19 + TS, hand-rolled CSS modules, no state library,
no backend, **zero runtime network calls** (deliberate: future Twitch extensions run under a
strict CSP). Everything is fetched at curation time by `scripts/refresh-data.mjs` and
committed under `public/`.

- `data/` — **hand-edited curated inputs**: `bosses.json` (56 bosses + tags),
  `curation.json` (pool exclusions, ammo rules, tier overrides, spell rules).
- `public/data/` + `public/img/` — **generated, committed, never hand-edit**:
  equipment.json (3664 items with stats + rarity tier), prices.json, spells.json, bosses.json,
  3.7k item icons, 56 boss renders, 11 slot sprites, coins/UI sprites, spell icons.
- `src/engine/` — **pure, fully tested, no React**: `roll.ts` (gear roller), `spell.ts`,
  `bonuses.ts` (stat aggregation), `parse.ts` (budget parse/format/gp tiers), `rng.ts`
  (seedable mulberry32 — same seed gives the same roll; this is what makes staged reveals and
  replayable/auditable Twitch-driven rolls possible).
- `src/components/` — feature UI. `src/theme/` — design tokens + primitives (`RsPanel`,
  `RsButton`, `RsTooltip`, `RsContextMenu`, `GpValue`).

## Roll rules currently implemented

- Weapon rolls **first** (first claim on budget — OSRS is weapon-heavy), then remaining
  unlocked slots in random order.
- **Rarity tiers** (`junk/common/decent/strong/elite`) assigned per slot by combat-power
  percentile in the refresh script; `curation.tierOverrides` hand-fixes passive-power items
  (Twisted bow, powered staves, blowpipes). The roller samples **tier-then-item**, with a
  strict weapon table (junk 2%) vs a looser armour table (junk 10%) — `WEAPON_TIER_WEIGHTS` /
  `DEFAULT_TIER_WEIGHTS` in `roll.ts`. Numbers are first-guess; tune freely.
- No 2h + shield (both directions); ammo must match the weapon's `requiredAmmo`;
  weapon-exclusive ammo (atlatl darts, salamander tars) never rolls onto other weapons.
- Untradeables only roll when the toggle is on, and cost **0** against the budget.
- **Locks**: click a filled slot to lock/unlock. Locked items survive rerolls, are exempt from
  the budget, and are stored in localStorage with the settings.
- Castable staves (`Staff`/`Bladed Staff`/`Polestaff`) also roll an autocast **spell**;
  powered staves show "built-in attack" instead.

## UI conventions established (do not regress these)

- **Fonts**: RuneScape Bold for titles (`--font-title`) — **Quill Caps was rejected as too
  hard to read**. Nothing smaller than ~16px.
- **Colour hierarchy** (the fix for "everything looks the same"): gradient-gold app title,
  outlined bright-gold panel headers with icon anchors, **orange** labels, **crimson** CTA
  buttons, white/tier-coloured values. `--text-outline` gives pixel text a 4-way black outline.
- **GP values** always render via `<GpValue>`: coins sprite + RuneScape font + in-game colour
  tiers (yellow under 100k, white under 10m, green from 10m) + in-game truncation,
  **max 5 characters** (952509 renders as 952k). The budget input groups digits live
  (100,000) and previews the formatted amount on blur.
- **Tooltips are custom** (`RsTooltip`) — no native `title` anywhere. Slot tooltips show item
  name, tier line (tier-coloured), value, lock hint.
- **Rarity reads on the slot border**; the lock indicator is a green *outline* + badge so the
  two compose. Occupied slots dim their slot sprite and pop the item icon.
- **Right-click anywhere** opens the OSRS "Choose Option" menu (`RsContextMenu`); Cancel is
  always last, never "Walk here". Filled slots add "Remove item from slot". Components claim a
  right-click by calling `preventDefault` and opening their own entries — that is the extension
  seam for future menu options.
- The page backdrop in `src/index.css` is an explicitly-labelled **placeholder** — it will be
  replaced with custom art from the streamer's memorable moments.

## Boss data

56 bosses in `data/bosses.json`. Every boss has exactly one difficulty (`easy`/`mid`/`hard`)
plus pool tags: `wildy`, `slayer`, `gwd`, `dt2`, `raid`, `minigame`, `gauntlet`, `delve`, and
modifiers `hard mode`, `solo/group`, `sporadic`.
**Conventions:** no `solo/group` tag means solo only; no `sporadic` means repeatable.
Tombs of Amascut carries a `note` about adding an Elidinis' Warden sprite later.

## THE BIG NEXT THING: the challenge flow

`docs/plans/2026-07-29-challenge-flow-requirements.md` — requirements captured, **not yet
designed or built**. Summary:

1. **Pre-roll screen**: one hero "ACCEPT YOUR CHALLENGE" button + a settings button.
2. **Ceremony**: the boss is rolled **first internally** (its tags constrain the gear roll) but
   **revealed last** for suspense. Gear slots reveal sequentially.
3. **Result state**: no inline reroll — you go back to the pre-roll screen to start over.
4. **Settings section** holds all toggles *and* the equipment tab with search-and-lock restored
   (search was removed from the main stage on purpose; it comes back **settings-only**).

Conditional rules to implement there:

- A **wildy** boss caps the budget at `min(budget, 1m)` **and** disallows untradeables.
- **slayer** and **sporadic** pools are eligibility toggles, **default OFF**.
- Pools individually toggleable; **raids** get separate delicate treatment later;
  **gauntlet** (no gear allowed in-encounter) needs its own mode.

## Suspense/juice research (already done — do not redo)

Casino/slot psychology plus game-feel research landed on: anticipation is as powerful as the
reward; reels stop independently to re-arm suspense; celebrate small wins too; **win tiers**
are the emotional anchor. **Balatro is the north star** — a "glorified spreadsheet" that feels
like fireworks via sequential scoring, rollup counters with pitch-rising ticks, screen shake,
and layered audio (audio carries 50-70% of perceived impact).

Mapped plan: slots land one by one with the **weapon last** (our jackpot reel), the loadout
value **rolls up** with pitch-rising ticks (the gp tier colours already escalate yellow to
white to green), tier-based win ceremonies, then the **boss reveal as the finale** with a
decelerating spin. Use OSRS audio (jingles, coin sounds), not generic casino audio.

**Build the ceremony with "per-slot tier override" as an input from day one** — that is exactly
the hook chat/subs will drive later (a gifted sub upgrades a slot's tier, channel points force
an elite weapon or curse a slot to junk, chat votes on the finale slot's tier).

## Open backlog (the task list may not survive; recorded here)

1. Custom background art from the streamer's memorable moments (swap the `body` background).
2. Settings-only item search + lock re-entry (needed for locking owned untradeables).
3. Tune roll-order / empty-slot semantics — flagged iteration area in the spec.
4. Real extra-challenge system (currently a "coming soon" placeholder panel).
5. Sequential reveal + casino juice (**confirmed direction**, see above).
6. Twitch extension integration (stage 2).
7. Spell lock should follow a locked staff (the spell currently rerolls every roll).
8. Boss pool include/exclude UI driven by tags.
9. Price snapshot freshness indicator (prices are stale until `refresh-data` reruns).
10. Dramatic copy pass ("Choose your fate" / "ACCEPT YOUR CHALLENGE" language).
11. Gauntlet special mode (no-gear bosses break the premise; idea: roll gauntlet-internal
    constraints instead — weapon discipline, armour tier cap, prep limits).

## Gotchas

- `perl -i` on this platform writes `.bak` siblings (now gitignored) — prefer `sed -i` or node.
  Multi-line heredocs in the agent shell are also unreliable; write files with the editor tool.
- Test files are excluded from the app build (`tsconfig.app.json`) because they use `node:fs`.
- Icon pop-in during a roll is **image load latency, not the engine** (the roll is synchronous).
  Preload the 11 rolled icons when the sequential-reveal work happens.
- The stat-power formula cannot see passive power — when a tier looks wrong, add a
  `curation.tierOverrides` entry rather than changing the formula.
- Quest-only props are excluded via `curation.poolExclusions.questOnlyNames` (wiki
  Category:Quest items intersected with zero-stat items). Quest-obtained *real* gear
  (Salve amulet(i), Proselyte, Iban's staff, Climbing boots) is deliberately kept.
