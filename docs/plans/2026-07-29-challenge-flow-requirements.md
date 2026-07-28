# Challenge Flow — Requirements (spitball capture, 2026-07-29)

Status: **draft requirements from the streamer** — captured verbatim-in-spirit, to be refined
into a design before implementation. Supersedes the always-visible two-panel layout as the
target UX. Related tickets: #5 (sequential reveal), #8 (boss pools), #11 (gauntlet), #2
(lock/search), #10 (dramatic copy).

## Conditional roll rules (boss tags drive gear constraints)

| Rule | Behaviour |
|---|---|
| **wildy** boss rolled | Budget is capped at **1m** internally AND untradeables are disallowed for the gear roll. If the user's budget is already below 1m, the lower value applies. |
| **slayer** bosses | Eligibility toggle, **default OFF** (rolling them in-game depends on having a matching slayer task — RNG/time-gated via slayer masters). |
| **sporadic** bosses | Eligibility toggle, **default OFF** (not repeatable on demand). |
| All pools | Individually toggleable at will (include/exclude). |
| **raid** bosses | Treated entirely separately later — delicate balancing criteria. Out of scope for the first flow. |
| **gauntlet** bosses | No gear allowed in-encounter — needs a special mode (ticket #11). Out of scope for the first flow. |

**Critical ordering consequence:** the boss must be **rolled first internally** — its tags
(wildy, etc.) change the gear roll's constraints. The boss is **displayed last** for suspense.
The seedable RNG makes this trivial: one seed, boss drawn first, gear second, reveal order
decoupled from roll order.

## The flow (three states)

1. **Pre-roll screen** — a single hero **"ACCEPT YOUR CHALLENGE"** button (super cool,
   dramatic). Under it, a **settings button** opening the settings section.
2. **Ceremony** — clicking ACCEPT starts the full roll ceremony with the flashy sequential
   animations (ticket #5): internally boss → gear; visually gear slots reveal first, boss
   reveals as the finale.
3. **Result state** — the rolled challenge is displayed. The **only** way to start a new
   challenge is returning to the pre-roll screen and clicking ACCEPT YOUR CHALLENGE again.
   No inline rerolling.

## Settings section (behind the settings button)

- All logic toggles: pool include/exclude (incl. slayer + sporadic eligibility, default off),
  budget, untradeables toggle.
- **The equipment tab lives here too**, with search-and-lock restored (ticket #2): the
  streamer can pre-lock specific slots before accepting a challenge. (Search returns as a
  settings-only feature — it never reappears on the main stage.)

## Visual note

- **Quill Caps is out** — too hard to read. Titles/headers move to RuneScape Bold (large).
