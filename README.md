# Gnome Subtember

An Old School RuneScape challenge roller: get a **random gear loadout** under an optional gp
budget, a **random boss** to slay with it, and (soon) an extra challenge on top.

- **Roll** fills the equipment tab with random valid gear: no 2h + shield, ammo always matches
  the weapon, total cost stays within your budget (`10m`, `250k`, `1.5b`…).
- **Lock** any slot (hover → padlock) or hand-pick an item with the search box — locked gear
  survives rerolls and costs nothing against the budget.
- **Allow untradeables** lets fire capes & friends roll at 0 gp.
- Boss panel rolls one of 59 bosses. Locks and settings persist across refreshes.

## Run it

```
npm install
npm run dev
```

## Development

- `npm test` — engine test suite (roll invariants, parser, generated-data schema).
- `npm run refresh-data` — re-vendors all data/assets (equipment pool + GE price snapshot from
  the [osrs-dps-calc](https://github.com/weirdgloop/osrs-dps-calc) data and the wiki prices
  API, item icons, boss renders, slot sprites). Everything it writes is committed; the app
  makes **zero network calls at runtime**.
- Curated inputs live in `data/` (boss list, pool/ammo curation rules); generated output goes
  to `public/`. Design doc: `docs/plans/2026-07-28-gnome-subtember-design.md`.

Fonts are the game-extracted [RuneStar fonts](https://github.com/RuneStar/fonts); item icons,
boss renders and slot sprites come from the OSRS Wiki / dps-calc CDN.
