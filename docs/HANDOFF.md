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

## Tier floors (bad-RNG mitigation)

- Floors, not min/max: the failure being mitigated is one-sided (an all-junk loadout), and
  a max would add a class of unsatisfiable combinations to solve a problem nobody has.
- Counted over `CORE_SLOTS` — the nine slots that always fill. Shield is empty under a 2h
  (39% of weapons) and ammo only fills for a launcher (7%), so neither can carry a guarantee.
- Floors **outrank the gp budget** by explicit decision: a floored slot takes an affordable
  item of its tier when one exists and overspends only when the tier has nothing in budget.
  The remaining budget clamps at 0 rather than going negative.
- Raids satisfy them **per skeleton** — `rollForStyle` calls `roll()` once per lane, so this
  falls out for free rather than needing team-wide bookkeeping.
- `assignTierFloors` claims slots rarest-tier-first: an elite floor has the fewest slots
  able to satisfy it, so it must claim before a common floor takes them.

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
12. Narrow windows starve the emote scatter. Below roughly 1400px the 1100px content
    column leaves no legal margin, so sprites drop out one by one and a ~1200px window
    shows none at all. Options: shrink the column on small windows, shrink the sprites,
    or carry a smaller scatter set for narrow layouts.
13. Gauntlet challenge timers ("Defeat your foe in 5:15") are still plain text, not live
    countdowns — deliberate originally, but debug "Force challenge → Always the timer"
    does not reach them, which is surprising when testing.
14. Emote attribution: 16 vendored 7TV emotes by 14 different authors (see `author` in
    `data/emotes.json`). Worth a credits list somewhere before this goes public.
15. `FitScreen` scales whole screens down to avoid scrolling. It has no lower bound, so a
    very small window will scale text past readability — consider a floor plus a scroll
    fallback below it.

## Page decoration (emotes + mascot)

- `scripts/refresh-emotes.mjs` vendors every 7TV emote into `public/img/emotes` and writes
  `data/emotes.json`. Nothing is fetched at runtime. After editing its list, update
  `EMOTES` in `src/components/emotes.ts` — `emotes.test.ts` cross-checks the two.
- Sizing rule from the art direction: scattered emotes **only ever scale up, never past
  250%**. Widths are computed as `floor(natural * scale)` so rounding cannot breach it.
- `useScatterLayout` places the scatter at runtime: no sprite may be more than 25%
  covered by the UI, and none may overlap another. Anything with no legal spot is
  **dropped** rather than parked half-buried. Obstacles are found via the `data-solid`
  attribute — put it on any new opaque block the scatter should avoid.
- `data-solid="strict"` is a harder keep-out: **zero** overlap allowed, not 25%. The
  wordmark uses it, so nothing ever sits behind "Gnome Subtember".
- The Settings dialog is the **one** surface allowed to scroll — the debug section makes it
  taller than the window, and a dialog running off the bottom is worse than a scrollbar.
  It needs `RsPanel`'s `bodyClassName` to make the padded body a flex column: a percentage
  `max-height` will not resolve there, because a flex item's grown height is not a definite
  height to measure against.
- The gauntlet "NO GEAR ALLOWED" power-down persists into the result view, driven by the
  boss's `gauntlet` tag rather than by ceremony state — it is part of the run's identity,
  not a ceremony flourish.
- `ResultStage` is the two-panel final layout, shared by the result view AND by the
  ceremony's boss beat. Once the gear is assembled the ceremony renders it directly
  (replacing `main.ceremony`), so the boss card minimises into a Challenger panel that is
  already on screen and the commit to the real result view changes nothing visible — only
  the challenge box appears. Do not fork this layout: a second near-identical copy puts a
  jump in the middle of the reveal. Raid runs keep their own ceremony stage, since the raid
  result view is a different shape.
- The ceremony's value counter pins itself above the gear skeleton, which it finds via
  `data-gear-anchor`, and hides itself once the boss beat starts (the panel shows the
  value from then on). Both ceremony branches (single skeleton, raid squad stage) carry
  the attribute; exactly one renders at a time.
- The idle bob amplitude (`DRIFT_PX`) is reserved in the collision footprint and fed to
  the CSS as `--emote-drift`. Change it in one place or sprites will animate into each other.
- Stingers (`Stinger.tsx`) are full-screen one-shots at z-index 400, fixed at 2.5s and
  deliberately **not** scaled by the animation-speed setting. Three kinds:

  | kind | art | fires when |
  | --- | --- | --- |
  | `challenge` | laser gnome | a run draws an extra challenge |
  | `flashbang` | WHAT | an **elite item** lands — 50% |
  | `gamba` | GAMBA | **any** reveal — 2%, capped at one per DECIDE |
  | `hardmode` | AHHHH (deep-fried) | a hard-mode fight that also drew a challenge — 50% |

  All four fill the window (`object-fit: contain`, so aspect is kept and nothing is
  cropped), start at full opacity on the first frame and fade out from there — no fade-in,
  or the art would still be ramping up while the overlay is already fading. `flashbang`,
  `gamba` and `hardmode` also blow the screen white and hit the vine boom. Every branch
  has a debug toggle.
- The vine boom is the vendored `public/audio/vine-boom.mp3` (supplied by the project
  owner). `playVineBoom` falls back to a synthesised boom only if that file fails to load
  — worth knowing, because a missing file degrades silently to a different-sounding hit
  rather than to an error. It must stay committed: the Pages build runs from a clean
  checkout, so an ignored file would leave the deployed site on the fallback.

## Gotchas

- `perl -i` on this platform writes `.bak` siblings (now gitignored) — prefer `sed -i` or node.
  Multi-line heredocs in the agent shell are also unreliable; write files with the editor tool.
- Test files are excluded from the app build (`tsconfig.app.json`) because they use `node:fs`.
- Icon pop-in during a roll is **image load latency, not the engine** (the roll is synchronous).
  Preload the 11 rolled icons when the sequential-reveal work happens.
- The stat-power formula cannot see passive power — when a tier looks wrong, add a
  `curation.tierOverrides` entry rather than changing the formula.
- `position: fixed` inside a transformed element anchors to that element, not the viewport.
  `FitScreen` transforms, so every overlay (reveal cards, stingers, scatter, menus,
  settings, the value counter) must render **outside** it. This bites quietly: a centred
  `left: 50%` still looks right inside the wrapper, and only breaks once you set a real
  px offset.
- **Never rewrite a source file in place with `cat > file <<'EOF'` or `sed -i`.** Both
  replace the file in a way Vite's watcher can catch mid-write. It truncates to zero first, and
  Vite's watcher can cache the empty version and serve it forever. This bit twice: once as
  a blank page (a `.tsx` with no exports), once as a CSS module that exported `{}` — every
  class came back `undefined`, so full-screen stingers rendered unstyled and invisible
  while their sound still played. **`tsc`, the tests and `npm run build` all pass**, because
  only the dev server is wrong. Symptom to watch for: a component that clearly mounts but
  has no styling. Check with
  `curl -s localhost:5173/src/path/File.module.css | grep '__vite__css = \"\"'`, and fix by
  touching the file. Use the editor tool for source files.
  Seen three times: a `.tsx` served with no exports (blank page), a CSS module exporting
  `{}` (stingers rendered unstyled and invisible while their sound still played), and an
  import line missing from an otherwise-current module (`X is not defined` at runtime while
  `tsc` resolved X happily). Reloading the PAGE does not help — Vite serves its own cached
  transform regardless of browser cache. Diff the served module against disk:
  `curl -s localhost:5173/src/path/File.tsx | grep 'thing'`.
- `perl -0pi -e` leaves `.bak` siblings on this platform (gitignored, but they pile up).
- A hidden Browser pane reports `innerWidth`/`innerHeight` of **0** and pauses
  `requestAnimationFrame`, so anything measured or rAF-scheduled reads as empty/stale.
  Set a viewport with `resize_window` before trusting a layout measurement.
- Do not run bare `npx prettier --write` here: there is no config, so it defaults to double
  quotes and reflows files project-wide. Use `--single-quote --print-width 100`.
- Quest-only props are excluded via `curation.poolExclusions.questOnlyNames` (wiki
  Category:Quest items intersected with zero-stat items). Quest-obtained *real* gear
  (Salve amulet(i), Proselyte, Iban's staff, Climbing boots) is deliberately kept.
