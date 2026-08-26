# Product Backlog — Tickets (T11–T14)

Items raised in the first ceremony review that are product/feature work rather
than presentation. Sources: `docs/HANDOFF.md` and
`docs/plans/2026-07-29-challenge-flow-requirements.md`.

## T11: Per-slot tier override seam

**Problem:** The handoff says to build the ceremony with "per-slot tier
override" as an input from day one — the hook chat/subs will drive later — and
it isn't modeled yet.

**Goal:** The ceremony accepts an optional per-slot tier override so a reveal
can be forced to a tier (the future Twitch hook) without touching roll logic.

**Acceptance criteria**

- `useCeremony.start(...)` accepts an optional
  `tierOverrides?: Partial<Record<Slot, Tier>>`.
- The reveal card and landing use the overridden tier for highlight/impact if
  present, else the item's own tier.
- No visible tier text; no roll-engine changes.
- Covered by a small engine test if logic is extracted (e.g.
  `effectiveTier(item, override)`).

**Implementation**

- `src/components/useCeremony.ts`: thread `tierOverrides` into `RevealData`;
  `src/engine/reel.ts` or `types.ts`: `effectiveTier` helper + test.

**Depends on:** T6 (tier landings).

---

## T12: Extra challenge — replace the "coming soon" placeholder

**Problem:** `ChallengePanel` is a static placeholder.

**Goal:** Roll a simple curated challenge alongside the loadout and display it
in the result.

**Acceptance criteria**

- A small curated list of simple challenges (e.g. "No prayers", "Ranged only",
  "No food") in `src/components/challenges.ts`.
- DECIDE rolls one uniformly; the result's "Your Challenger" panel shows it
  where the placeholder was.
- Always one challenge in v1 (no off state); extendable later.
- Copy stays OSRS-toned; no tier names.

**Implementation**

- `src/components/challenges.ts` (curated strings), `BossPanel.tsx`
  `ChallengePanel` renders the rolled one, `App.tsx` reducer gains
  `challenge: string | null`, rolled in `decide`, shown in result.

**Depends on:** none.

---

## T13: Boss pool include/exclude controls (slayer / sporadic / raid)

**Problem:** The challenge-flow requirements specify pool toggles; only
`excludeWildy` exists.

**Goal:** Settings gains toggles for `slayer` and `sporadic` (default OFF) and
include/exclude per pool tag, applied to the boss pool in `decide`.

**Acceptance criteria**

- Settings toggles: "Slayer bosses" (default OFF), "Sporadic bosses" (default
  OFF), plus a per-pool include list for `gwd`, `dt2`, `raid`, `minigame`,
  `delve` (all default ON).
- `decide` filters `bosses` by the active toggles (wildy rule unchanged:
  separate budget + untradeables).
- Empty-pool guard: if filtering leaves no bosses, the DECIDE button is disabled
  (tooltip).
- Pool state persists via the existing settings persistence.

**Implementation**

- `src/components/settings.ts`: add `slayerBosses`, `sporadicBosses`,
  `excludedPools: string[]`.
- `src/App.tsx`: build the filtered pool in `decide`; `decideReady` requires a
  non-empty pool.
- `src/components/SettingsPanel.tsx`: add toggles (reuse the existing `Toggle`).

**Depends on:** none.

---

## T14: Gauntlet special mode (deferred)

**Problem:** Gauntlet bosses disallow gear; the "roll a loadout" premise breaks.

**Goal:** Track the deferred special mode per the requirements doc. Not built
in this pass.

**Acceptance criteria**

- Requirements captured: when a `gauntlet` boss is rolled, roll gauntlet-internal
  constraints instead of gear (weapon discipline, armour tier cap, prep limits) —
  see `docs/plans/2026-07-29-challenge-flow-requirements.md`.
- No code change required for this ticket; it exists to keep the item tracked.

**Depends on:** none.
