# Gnome Subtember

An Old School RuneScape challenge roller, built for stream. One button rolls you a **gear
loadout**, a **boss** to kill with it, and sometimes an **extra challenge** on top — revealed
slot by slot like a slot machine.

Live at <https://saxerpillar.github.io/gnomonkey-randomizer-subtember/>

## A run

**DECIDE YOUR FATE** → each slot reels in and lands, one at a time → the boss rolls last →
the result screen shows your kit, its value, your challenger and any challenge. Mark it
**cleared** or **failed** when you're done; every run is kept in the history log.

## The roll

- **Valid by construction.** No shield under a two-hander, ammo always matches the weapon's
  family and tier ceiling, nothing exceeds your gp budget (`10m`, `250k`, `1.5b`…).
- **Rarity tiers** — junk / common / decent / strong / elite — assigned per slot by combat
  power percentile, targeting a fixed 20/35/20/15/10 spread across 2,282 items.
- **Adaptive gear.** A mid-difficulty boss rolls slightly better kit, a hard one noticeably
  better — elite goes from ~5% of slots on easy to ~13% on hard, with junk falling away.
- **Tier floors** (Settings) guarantee a minimum number of slots at a given tier — bad-RNG
  mitigation. Floors outrank the budget.
- **Locks.** Click a slot to lock it: locked gear survives rerolls and costs 0.
- **Right-click a slot** to reroll just that one, or clear it.

## The boss

55 bosses, each tagged with a difficulty and pools (GWD, DT2, raids, wave-based, delve).

- **Manage boss pool** (Settings) toggles individual bosses, grouped by difficulty. A boss
  held out by a group toggle says which one is doing it.
- **Raids** roll three style-forced setups side by side, then sort the team's gear so each
  piece lands on the setup it suits.
- **Hard modes** use each fight's own wording — Expert Mode, Challenge Mode, Awakened.
- Some fights lock a style: the Leviathan is ranged, the Whisperer magic.
- **Gauntlets** take no gear in at all and always draw a challenge.

## Presentation

Reel animations with sound, a screen shake on big landings, and four full-screen stingers
(elite drops, a rare jackpot, hard-mode challenges) built from vendored 7TV emotes. Screens
scale to fit the window rather than scrolling; only the Settings, boss pool and history
dialogs scroll. Volume, animation speed and a **Remove flashbangs** toggle live in Settings.

## Run it

```
npm install
npm run dev
```

## Development

- `npm test` — 194 tests: roll invariants, ammo compatibility, tier floors and bias, raid
  sorting, poison variants, history, the scatter layout solver.
- `npm run refresh-data` — re-vendors the equipment pool, GE prices, icons, boss renders and
  slot sprites from [osrs-dps-calc](https://github.com/weirdgloop/osrs-dps-calc) and the wiki
  API. `npm run refresh-emotes` does the same for the 7TV emotes.
- Curated inputs live in `data/`; generated output goes to `public/`. Everything is
  committed, and the app makes **no network calls at runtime** except one same-origin check
  for a newer deploy.
- `docs/HANDOFF.md` carries the design decisions and the gotchas worth knowing before
  changing anything.

Fonts are the game-extracted [RuneStar fonts](https://github.com/RuneStar/fonts); item icons,
boss renders and slot sprites come from the OSRS Wiki / dps-calc CDN. Emote art is credited to
its 7TV authors in `data/emotes.json`.

## Deploy

Pushing to `master` runs `.github/workflows/deploy.yml`: install, test, build, publish `dist/`
to GitHub Pages.

The production build needs a base path of `/<repo>/` or every asset 404s, so `vite.config.ts`
sets it automatically under CI. Anything resolved at runtime from `public/` must go through
`asset()` in `src/asset.ts` — Vite cannot rewrite paths it does not see at build time.
Override with `VITE_BASE` if the repo is renamed or moves to a custom domain (`VITE_BASE=/`).
