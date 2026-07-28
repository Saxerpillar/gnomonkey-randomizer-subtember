# Gnome Subtember — Stage 1 Design

*Validated 2026-07-28 through collaborative brainstorm (all sections user-approved).*

## Purpose

An Old School RuneScape webapp that presents the player with **random gear loadouts** under
a configurable gp budget and a **random boss** to slay with that gear. Built for
streamer/community challenge content. Stage 1 is a polished local prototype; stage 2 (out of
scope here) turns it into a Twitch app where subs/gifted subs influence rolls, plus
"casino"/slot-machine roll animations.

## Scope

**In (stage 1):**
- Equipment panel (in-game equipment-tab look) with per-slot locking and hand-picking
- Roll button generating a random valid loadout within an optional gp budget
- "Allow untradeables" toggle
- Random boss panel (name + image) with its own Roll button
- "Extra challenge" panel as **placeholder UI only** ("coming soon")
- Total loadout value readout
- OSRS-UI theming (dark browns/olive, gold headers, green accents, RuneScape font)

**Out (stage 2+), but design must not preclude:**
- Twitch extension integration (sub-influenced rolls) — note: Twitch extensions run under a
  strict CSP, which motivates the zero-runtime-network architecture below
- Slot-machine roll animations (motivates the `RsPanel`/`RsButton` primitive seam)
- Challenge system content; per-boss challenge pools
- Stats-profile / equip-requirement filtering; weapon-role-aware roll logic

## Requirement decisions (user-confirmed)

| Topic | Decision |
|---|---|
| Untradeables | "Allow untradeables" toggle on the roller |
| Untradeables × budget | When allowed, untradeables cost **0 gp** against the budget |
| Item pool | weirdgloop/osrs-dps-calc `equipment.json` (combat gear w/ stats; junk excluded) |
| Tradeability test | Item id present in wiki GE `mapping` ⇔ tradeable |
| Validity rules | No 2h + shield; ammo must match weapon category. Otherwise fully random |
| Equip requirements | Ignored in v1 (assume capable account) |
| Boss list | Curated `data/bosses.json` in-repo (name, image ref, tags) |
| Extra challenge | Placeholder panel only in v1 |
| Deployment | Local-only (`npm run dev`); architecture stays static-hostable |

## Architecture: vendored-data static SPA

**Stack:** Vite + React 18 + TypeScript. Hand-rolled CSS (CSS modules + `theme.css` design
tokens). No UI framework, no state library, no backend. The app makes **zero runtime network
calls** — all data and assets are vendored into the repo by a refresh script.

```
gnome-subtember/
  scripts/refresh-data.mjs      # the one data script
  data/                         # CURATED inputs (hand-edited, committed)
    bosses.json                 #   { name, image (dps-calc CDN name), tags[] }
    ammo-overrides.json         #   fixes for ammo classification edge cases
  public/
    data/equipment.json         # GENERATED: rollable pool w/ stats + tradeable flag
    data/prices.json            # GENERATED: id → gp snapshot
    img/items/*.png             # GENERATED: item icons (dps-calc cdn/equipment)
    img/bosses/*.png            # GENERATED: boss renders (dps-calc cdn/monsters)
    img/slots/*.png             # GENERATED: authentic stone slot-tile sprites + ghost icons
  src/                          # the app
  docs/plans/                   # design docs (this file)
```

**`npm run refresh-data`:**
1. Pull `cdn/json/equipment.json` from weirdgloop/osrs-dps-calc; filter to the rollable pool.
2. Pull wiki prices API (`mapping` + `latest`); write `prices.json`; stamp each item
   `tradeable = id ∈ mapping`.
3. Download item icons for pooled items from the dps-calc CDN.
4. Download boss images named in `data/bosses.json` from `cdn/monsters/`.
5. Download the 11 equipment-slot interface sprites (stone tiles + ghost slot icons).
6. Classify ammo (arrows / bolts / javelins) by name-pattern rules + `ammo-overrides.json`.

Writes are atomic (temp file → rename); failures are loud. Generated files are committed, so
a fresh clone runs offline without ever executing the script. Curated files are the only
hand-edited inputs.

## Domain model & roll engine

**Types:** `Item { id, name, slot, icon, price?, tradeable, twoHanded, category, ammoClass? }`
· `Slot` = the 11 equipment slots · `Loadout = Record<Slot, Item | null>`.

**The roll engine is a pure TS module** — `roll(pool, settings, rng): Loadout`, no React.
Seedable RNG injected (testability now; Twitch-driven/replayable rolls later).

Per roll:
1. Filter pool: drop untradeables unless toggle allows.
2. **Weapon slot rolls first** (deliberate: first claim on budget — weapons decide the kill).
   If shield slot is locked, 2h weapons are excluded from candidates.
3. Remaining slots roll in **random order**; each samples uniformly from candidates with
   `cost ≤ remaining budget` (cost = GE price; **0** for untradeables). No affordable
   candidate → slot stays empty (rendered as a subtle "—").
4. Validity: rolled 2h ⇒ shield forced empty. Ammo candidates constrained by weapon
   category: Bow→arrows, Crossbow→bolts, Ballista→javelins, all other weapons→any ammo
   (cosmetic).

**Locks:** locked slots are untouched by rolls and **exempt from budget** (cost 0 — they
model gear you already own, consistent with the untradeables rule). Roll always respects
current locks.

**Boss roll:** uniform pick from `bosses.json`; independent button.

> **Flagged iteration area (user-noted):** roll order and empty-slot probability semantics
> have viable alternatives; the above is the deliberate v1 baseline, expected to be tuned.

## UI & theming

Two panels side-by-side (stacking on narrow windows): gear left, boss right.

- **`EquipmentPanel`** — in-game equipment-tab layout built from the **authentic stone
  slot-tile sprites** (vendored), gearscape-style. Each `EquipSlot` shows the item icon or
  the ghost slot icon. Hover a filled slot → padlock button (lock rolled item). Locked slots
  show a lock badge + green accent border.
- **Item picking** — dps-calc pattern: **one global search combobox** that auto-slots and
  locks the picked item; clicking a slot focuses the search pre-filtered to that slot.
- **`RollControls`** — budget input (freeform, `k/m/b` suffixes, e.g. `10m`), untradeables
  toggle, big Roll button, **total loadout value** readout (sum of rolled tradeable prices).
- **`BossPanel`** — large boss render + name in RuneScape font, own Roll button.
- **`ChallengePanel`** — styled "Extra challenge — coming soon" placeholder.
- **Theming** — `theme.css` tokens sampled from the reference bingo-app screenshots
  (near-black brown panels, olive borders, gold headers, green confirm accents); RuneScape
  font vendored via `@font-face` (public fan font packs). Shared primitives `RsPanel` /
  `RsButton` so stage-2 casino styling swaps in one place.

*Site research notes:* dps.osrs.wiki validated the global-search picker and ships the ghost
slot icons; gearscape validated the stone-tile look and a total-cost readout. Neither site
does random rolls — the roller has no prior art to copy; inspiration is presentational only.

## State

Single `useReducer` at App level: `{ loadout, locks, settings { budgetText, allowUntradeables },
boss }` with actions `ROLL_GEAR`, `ROLL_BOSS`, `LOCK_SLOT`, `PICK_ITEM`. `locks` + `settings`
persist to localStorage. Data files are fetched once at startup, prices joined onto items,
indexed by slot, provided via one context, behind a brief OSRS-styled loading state.

## Error handling

- Data load failure → styled error panel with retry (never a white screen).
- Budget parse failure → red invalid state on the input, Roll disabled (no silent fallback).
- Empty candidate set → empty slot by design (not an error).
- Missing image → generic placeholder sprite + console log.
- Refresh script → loud failures, atomic writes; can't commit half-written data.

## Testing

Vitest, concentrated on the pure roll engine:
- budget never exceeded (incl. 0 and absurdly low/high budgets)
- untradeables excluded when toggle off; cost 0 when on
- locks respected and budget-exempt
- 2h ↔ shield exclusivity (both directions: rolled 2h clears shield; locked shield excludes 2h)
- ammo compatibility per weapon category
- seeded-RNG determinism (same seed ⇒ same loadout)

Plus one schema sanity test over generated `equipment.json`, and a single UI smoke-render
test. Nothing more in v1.
