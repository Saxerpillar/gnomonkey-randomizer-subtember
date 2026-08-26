# Ceremony Juice — Tickets (T1–T10)

Scope: the DECIDE ceremony's feel, presentation, and audio. Every ticket is
independently implementable; a suggested build order is at the bottom.

## Shared constraints (all tickets)

- **No tier names user-facing.** Rarity is conveyed by color only
  (`--tier-junk/common/decent/strong/elite`). Never render "Junk"/"Elite"/etc.
  as text.
- **Respect settings:** `skipAnimations` bypasses the ceremony entirely;
  `muteSounds` gates ALL audio.
- **Zero runtime network.** New audio is synthesized with Web Audio (no new
  asset files) or vendored into `public/` and committed.
- **Naming/copy:** "Your Challenger", "DECIDE YOUR FATE". Slot labels use
  `SLOT_LABEL` (currently in `EquipmentPanel.tsx`).
- **Conventions:** CSS Modules, theme tokens in `theme.css`, `GpValue` for all
  money, `RsTooltip` (never native `title`), OSRS fonts
  (`--font-title`/`--font-bold`/`--font-small`).
- **Audio lives in `src/components/sound.ts`** (`playTick`, `unlockAudio`
  already exist there).
- **Verification:** `npm test` (82 green), `npm run build`, `npm run lint`
  (only the pre-existing `DataProvider` warning is acceptable).
- **Engine code is pure + tested** (`src/engine/*.test.ts`); presentational
  code lives in components.
- The ceremony currently runs ~60s total; keep per-roll ≈ full tick (3.83s) +
  beat.

---

## T1: Tape reel — show a whole tape of eligible items and stop on one

**Problem:** The roll shows one blurred 44px icon at a time (reel window is
`52×48`, exactly one icon tall, `overflow:hidden`). It reads as "one item
quivering," not a roll.

**Goal:** A real slot-machine tape: a window showing **3 rows at once**, a long
strip of eligible same-slot items feeding through, **ticking item-by-item with
deceleration**, a **near-miss wobble** at the end, stopping with the winner **on
a center pointer line**, highlighted.

**Acceptance criteria**

- Roll phase shows a vertical window ~`96px` wide × `192px` tall with **3 item
  rows visible** and a gold pointer line at the center row.
- The tape is a column of **28 items** (same-slot candidates, winner last)
  scrolling upward.
- Motion is **discrete ticking** (one row per tick) with a growing interval
  (deceleration); total scroll time ≈ `ROLL_MS` (3900).
- The final ticks **wobble** (advance 1, pull back 1, then land) before
  stopping.
- Winner stops at the center row and is **highlighted** (pulsing glow in its
  tier color + the pointer line brightens).
- No tier names; no change to total ceremony pacing.

**Implementation**

- `src/components/RevealCard.tsx`: replace `.reelWindow/.reelStrip/.reelIcon`
  with a 3-row window + tape; drive with a JS tick chain (setTimeout), not CSS
  translate.
- `src/engine/reel.ts`: add `buildTape(candidates, final, rng, length)` and
  `tapeTickDelays(totalTicks, rollMs)` → decelerating per-tick delays
  (geometric growth, sum ≈ rollMs). Add `reel.test.ts` cases: tape ends on
  winner; delays strictly increasing; delays sum within ±50ms of rollMs.
- `src/components/RevealCard.module.css`: `.tapeWindow` (192px tall, pointer
  line via `::before`), `.tapeRow` (64px), `.tapeHighlight`, `.tapeWobble`
  states.
- Constants at top of `RevealCard.tsx`: `TAPE_LEN=28`, `ROW=64`,
  `VISIBLE_ROWS=3`, `ROLL_MS=3900`.
- Reuse `data.candidates` already on `RevealData` (no plumbing changes).

**Depends on:** none.

---

## T2: Icon-forward reveal — large icon + headline name

**Problem:** At the reveal moment the item's picture disappears; the name is
17px (`--font-small`), the quietest text in the app.

**Goal:** When the tape stops, the card shows a **large item icon (128px)** +
the **name as a headline (40px, `--font-title`, gold `--gold`,
`--text-outline`)**, with `GpValue` (or "Untradeable") below. The icon appears
with a scale-in pop as the tape lands.

**Acceptance criteria**

- Tooltip/reveal phase contains a `128px` crisp item icon (no blur), the item
  name at `40px` gold, and the value line.
- The icon pops in (scale `0.6→1` over ~250ms) when the tape stops.
- The icon shown is the same item the tape stopped on (from `data.item`).
- GpValue uses the existing component; "Untradeable" shown when
  `!tradeable && price == null`.
- No tier names.

**Implementation**

- `src/components/RevealCard.tsx`: replace the current `.tooltip` phase markup;
  add `.revealIcon` (128px) and `.revealName` (40px) elements; trigger the pop
  on the `tooltip` phase entry.
- `src/components/RevealCard.module.css`: `.revealIcon { width:128px;
  height:128px; object-fit:contain; image-rendering:pixelated; filter:
  drop-shadow(...) }`, `.revealName { font-family:var(--font-title);
  font-size:40px; color:var(--gold); text-shadow:var(--text-outline); }`, plus
  the `popIn` keyframe.

**Depends on:** T1 (the "tooltip" phase timing).

---

## T3: Card presence — entrance, framing, screen ownership, crisp icons

**Problem:** The card is near-black on near-black (`rgba(10,9,7,0.96)` on
`#14120f→#0e0c09`), `1px` dark border, no entrance, no backdrop, and reel icons
have a static `blur(0.6px)` that reads as low-res.

**Goal:** The card commands the screen: a **dimmer/vignette backdrop**, a
**slam-in entrance**, a **brighter gold frame + glow**, and **crisp icons**.

**Acceptance criteria**

- A full-screen backdrop behind the card (radial vignette, e.g.
  `radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)`).
- The card enters with a slam animation (~350ms: `scale(0.7)→1.06→1` + fade).
- Card frame: border `var(--gold-bright)`, radius 6px, stronger shadow + outer
  glow; padding ~`20px 32px`.
- No `blur()` on any reel/tape icon (T1 replaces the reel anyway).
- No tier names.

**Implementation**

- `src/components/RevealCard.tsx` + `.module.css`: add `.backdrop` layer inside
  `.overlay`; add `slamIn` keyframes; update `.card` border/shadow/padding;
  remove the blur filter.
- `src/components/EquipmentPanel.module.css`: bump `.pending` pulse to be
  clearly visible (gold glow `0 0 20px rgba(212,181,106,0.85)` at 50%).

**Depends on:** none.

---

## T4: Skeleton ghost frame — see where slots will land

**Problem:** Tiles pop into a near-invisible dark well; "building the skeleton"
reads as random stones materializing, not a frame being filled.

**Goal:** Show a **faint ghost tile for every slot position** from ceremony
start (the full skeleton frame), replaced by the bright stone tile as each slot
is revealed.

**Acceptance criteria**

- During the ceremony, every not-yet-revealed slot renders a **ghost** (dimmed,
  dashed-border, low-opacity box at its grid position).
- When a slot is revealed, its ghost is replaced by the normal stone tile (+
  pending pulse, then item).
- Locked slots show as normal filled tiles from t=0 (unchanged).
- The `.tab` well background/border is slightly more visible so the frame reads
  (e.g., background alpha up ~20%, border `var(--border-light)`).

**Implementation**

- `src/components/EquipmentPanel.tsx`: when `visibleSlots` is provided, render
  a `.ghost` tile for `SLOTS` not in `visibleSlots` (and not locked).
- `src/components/EquipmentPanel.module.css`: `.ghost { opacity:0.35;
  border:1px dashed var(--border-light); background: var(--tile); }` (no item,
  no `data-slot` needed).

**Depends on:** none.

---

## T5: Running value counter — the loadout value rolls up

**Problem:** No aggregate during the ceremony; the total only appears static on
the result screen.

**Goal:** A persistent **value counter** (top-right, fixed) that **rolls up**
toward the accumulating loadout value as each item lands, with a
**rising-pitch tick per increment** (Balatro-style).

**Acceptance criteria**

- Counter visible during the ceremony showing "Value: \<gp\>" via `GpValue`
  styling (coins + colour tier).
- After each slot lands, the counter animates from the previous value to the
  new `loadoutValue(settled)` over ~500ms, stepping up in visible increments
  (not one jump).
- Each step emits a short **rising-pitch tick** (Web Audio), muted-gated.
- Final displayed total equals the result screen's `loadoutValue(state.loadout)`.

**Implementation**

- New `src/components/ValueCounter.tsx` + `.module.css` (fixed top-right,
  z-index ~55).
- New hook `src/components/useCountUp.ts`: `useCountUp(target, duration,
  onStep)` eases the displayed value up with per-step callbacks.
- `src/App.tsx`: track the ceremony's accumulated value — state updated on each
  slot `onRevealDone` (derive from `view.settled` via `loadoutValue`); render
  `ValueCounter` in the ceremony branch.
- `src/components/sound.ts`: add `playIncrement(pitchIndex)` — short Web Audio
  click, pitch rising per index; `muteSounds` gates it.

**Depends on:** none.

---

## T6: Tier-differentiated landings (+ screen shake)

**Problem:** Every landing is identical (a 380ms scale pop + tier border). A
bronze dagger and a Twisted bow resolve the same.

**Goal:** The landing reaction **escalates by tier** (color only): junk =
quick/dull, common/decent = standard, strong = brighter pop + glow, **elite =
gold burst + screen shake + held beat**.

**Acceptance criteria**

- Landing impact scales by `item.tier`: junk `~200ms` small pop/dim flash;
  common/decent standard; strong adds a glow pulse; **elite** adds an
  **expanding gold/tier burst ring**, a **screen shake** (~200ms jitter on the
  root), and a slightly longer hold.
- The burst uses the item's tier color (e.g. `var(--tier-${item.tier})`) —
  never a tier name.
- Screen shake is a CSS keyframe toggled on a wrapper for ~200ms on elite only.
- Works for slot landings (in the card's reveal pop) and the slot itself.

**Implementation**

- `src/components/RevealCard.tsx`: on `tooltip`-phase entry, set a tier class
  (`land-junk`…`land-elite`) on the card; add a burst element (an
  absolutely-positioned expanding ring in tier color).
- `src/App.tsx` or a wrapper: toggle a `shake` class on the app root for ~200ms
  on elite landings.
- `src/components/RevealCard.module.css` + `App.css`: `@keyframes burst` (scale
  0→2 + fade), `@keyframes shake` (translate jitter), per-tier landing
  durations.

**Depends on:** T2 (landing moment).

---

## T7: Layered audio — landing thud, elite fanfare, counter ticks

**Problem:** One flat `tick.wav` per roll; nothing reacts to the landing or the
tier.

**Goal:** Layered synthesized audio (Web Audio, zero assets): a **landing thud**
when a tape stops, an **elite fanfare** (short rising arpeggio) on elite
landings, and the counter **increment ticks** (T5). All muted-gated.

**Acceptance criteria**

- A short low "thud" (sine, fast decay) plays at each slot/boss landing.
- An elite landing also plays a short rising fanfare (3–5 note arpeggio).
- Counter increment ticks (T5) are integrated here (one implementation).
- `muteSounds` silences all three; nothing plays at roll *start* (that stays
  `tick.wav` from `playTick`).
- No new asset files.

**Implementation**

- `src/components/sound.ts`: add `playThud()` (AudioContext, osc `sine`
  ~120→60Hz, gain envelope ~250ms decay), `playFanfare()` (short arpeggio), and
  share `playIncrement()` (T5).
- Ensure an `AudioContext` is created/resumed inside the DECIDE gesture: call
  `ctx.resume()` inside `unlockAudio()`.
- Hook calls: thud on `phase==='minimize'` entry in `RevealCard.tsx`; fanfare
  additionally when `item.tier==='elite'`; increments from `useCountUp`.

**Depends on:** T5 (counter ticks), T6 (elite moment).

---

## T8: Boss climax — the finale reads as a climax

**Problem:** The boss card is the same as an item card with a bigger icon; no
escalation.

**Goal:** The boss reveal is the **largest beat**: a bigger card/window, a
**held "?" suspense moment**, a **big gold/red burst + screen shake** on
landing, and the "Your Challenger" stage fills with a dramatic pop.

**Acceptance criteria**

- Boss card is visibly larger than item cards (e.g., icon `160px`, title `44px`).
- Before revealing the boss name, the card holds a **"?" suspense beat**
  (~800ms) with the sound still running, then reveals.
- Landing uses the strongest impact (gold/red burst + shake + longer hold) —
  not tied to a gear tier.
- Boss lands into `[data-boss]` as today; the boss render uses its existing
  `appear` animation.
- No tier names; respects `muteSounds`.

**Implementation**

- `src/components/RevealCard.tsx`: for `kind==='boss'`, add a `suspense` phase
  (show `?` icon) before the reveal; enlarge `.bossIcon`/`.bossTitle`; reuse T6
  burst + shake.
- `src/components/RevealCard.module.css`: `.bossSuspense` (pulsing `?`), bigger
  boss sizing.
- `src/components/sound.ts`: thud + fanfare on boss landing (T7).

**Depends on:** T3 (presence), T6/T7 (impact/audio).

---

## T9: Result payoff + CTA

**Problem:** After ~60s the ceremony ends and a static screen just appears; the
only button is a plain "Back".

**Goal:** The ceremony **resolves** into the result with a payoff beat, and the
result has a clear call-to-action.

**Acceptance criteria**

- When the ceremony finishes: the value counter (T5) completes its final
  count-up, then the result screen appears (with a brief flash/fade, ~250ms).
- The result's primary button reads **"NEW CHALLENGE"** (primary variant)
  returning to the pre-roll screen — no inline re-roll (per handoff).
- A one-line summary is shown in the result, e.g. "Slay \<boss\> with this
  loadout." (slot label + boss name).
- Existing "Your gear" / "Your Challenger" panels, locks, and bonus panel are
  unchanged.

**Implementation**

- `src/App.tsx`: replace the result `.actions` "Back" `RsButton` with a primary
  "NEW CHALLENGE" → `setPhase('pre-roll')`; add a summary line under `.value`.
- `src/components/useCeremony.ts`: `onDone` already fires after the final hold —
  have the ceremony's final `FINAL_HOLD_MS` overlap the counter completion, then
  commit.

**Depends on:** T5 (counter).

---

## T10: Dramatic copy pass

**Problem:** The ceremony is silent except item names — no slot labels, no
stage lines, no personality.

**Goal:** Add readable, OSRS-toned copy without tier names.

**Acceptance criteria**

- During each roll, the card shows the **slot label** (e.g. "Helmet", "Cape")
  above/near the tape (from `SLOT_LABEL`).
- The boss reveal includes a line like "Your fate is sealed…" during the
  suspense hold.
- All ceremony copy lives in one place (`src/components/copy.ts` or a constants
  block) so it's trivially editable.
- No tier names anywhere.

**Implementation**

- `src/components/copy.ts`: export `SLOT_LABEL`, boss suspense line, result
  summary template.
- `src/components/RevealCard.tsx`: render the slot label during the roll phase;
  boss line during suspense.
- Refactor `EquipmentPanel.tsx` to import `SLOT_LABEL` from `copy.ts` (dedupe).

**Depends on:** T8 (boss suspense) for the boss line.

---

## Build order

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10. T1 + T5 are the
highest-impact-per-effort and the rest layer on them.
