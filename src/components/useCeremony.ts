import { useEffect, useMemo, useRef, useState } from 'react';
import { effectiveTier, revealBeats } from '../engine/reel';
import { SLOTS, type Item, type Loadout, type Slot, type Tier } from '../engine/types';
import type { Boss } from './DataProvider';

/** One lane of a raid squad reveal (a single style's setup). */
export interface SquadReel {
  lane: number;
  label: string;
  item: Item;
  tier: Tier;
  candidates: Item[];
}

export type RevealData =
  | { key: string; kind: 'slot'; slot: Slot; item: Item; tier: Tier; candidates: Item[]; target: string }
  | { key: string; kind: 'squad'; slot: Slot; reels: SquadReel[]; target: string }
  | { key: string; kind: 'boss'; boss: Boss; candidates: Boss[]; hardMode: boolean; target: string };

/** A raid lane: a style-forced setup that assembles alongside the others. */
export interface SquadLane {
  label: string;
  loadout: Loadout;
}

export interface CeremonyView {
  /** Slots that have already landed. */
  settled: Partial<Record<Slot, Item>>;
  /** Slots whose tile is on screen and whose roll card is currently up. */
  pending: Slot[];
  /** The boss stage is visible (appears right before the boss roll). */
  bossStage: boolean;
  /** Boss reveal — null until the finale card lands. */
  boss: Boss | null;
  /** Gauntlet runs take no gear: the skeleton shows as deactivated. */
  gearless: boolean;
  /** Raids: one settled map per lane, filled concurrently. */
  squad: { label: string; settled: Partial<Record<Slot, Item>> }[] | null;
}

type RevealStep =
  | { kind: 'slot'; slot: Slot; item: Item }
  | { kind: 'squad'; slot: Slot; items: (Item | null)[] }
  | { kind: 'boss'; item: Boss };

// Beat timing (ms). The per-card duration lives in RevealCard — the full tick
// (~3.8s) plays each reveal, so this only paces the gaps.
const SLOTS_START_MS = 800;
const BEAT_GAP_MS = 260;
const FINAL_HOLD_MS = 1200;

const buildQueue = (
  loadout: Loadout,
  boss: Boss,
  gearless: boolean,
  squad: SquadLane[] | null,
): RevealStep[] => {
  const steps: RevealStep[] = [];
  if (squad) {
    // Raids: every lane rolls the same slot on the same beat, so the three
    // skeletons assemble side by side instead of one after the other.
    for (const slot of revealBeats().flat()) {
      const items = squad.map((l) => l.loadout[slot]);
      if (items.some(Boolean)) steps.push({ kind: 'squad', slot, items });
    }
  } else if (!gearless) {
    // Gauntlet: no gear goes in, so there is nothing to roll — straight to the boss.
    for (const slot of revealBeats().flat()) {
      const item = loadout[slot];
      if (item) steps.push({ kind: 'slot', slot, item });
    }
  }
  steps.push({ kind: 'boss', item: boss });
  return steps;
};

/**
 * Orchestrates the DECIDE ceremony: the gear skeleton assembles tile-by-tile
 * (helmet first), each item rolling at screen centre before flying into its
 * tile, then the boss stage appears and the boss card rolls as the finale. The
 * challenge was fully rolled already; `onDone` fires once the last card held.
 */
export const useCeremony = (items: Item[]) => {
  const bySlot = useMemo(() => {
    const map = new Map<Slot, Item[]>(SLOTS.map((s) => [s, []]));
    for (const it of items) map.get(it.slot)!.push(it);
    return map;
  }, [items]);

  const [view, setView] = useState<CeremonyView | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);

  const timersRef = useRef<number[]>([]);
  const queueRef = useRef<RevealStep[]>([]);
  /** Boss pool for the finale reel tape (set at start).*/
  const bossPoolRef = useRef<Boss[]>([]);
  /** Whether the rolled fight is the hard-mode variant (stamped after the reveal). */
  const hardModeRef = useRef(false);
  const indexRef = useRef(0);
  const squadRef = useRef<SquadLane[] | null>(null);
  const tierOverridesRef = useRef<Partial<Record<Slot, Tier>>>({});
  const onDoneRef = useRef<(() => void) | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  const schedule = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => clearTimers, []);

  const advance = () => {
    const step = queueRef.current[indexRef.current];
    if (!step) {
      schedule(() => {
        setView(null);
        setReveal(null);
        const done = onDoneRef.current;
        onDoneRef.current = null;
        done?.();
      }, FINAL_HOLD_MS);
      return;
    }
    if (step.kind === 'slot') {
      setView((v) => (v ? { ...v, pending: [step.slot] } : v));
      setReveal({
        key: `${step.slot}-${step.item.id}`,
        kind: 'slot',
        slot: step.slot,
        item: step.item,
        tier: effectiveTier(step.item, tierOverridesRef.current[step.slot]),
        candidates: bySlot.get(step.slot) ?? [],
        target: `[data-slot="${step.slot}"]`,
      });
    } else if (step.kind === 'squad') {
      setView((v) => (v ? { ...v, pending: [step.slot] } : v));
      const reels: SquadReel[] = [];
      step.items.forEach((item, lane) => {
        if (!item) return;
        reels.push({
          lane,
          label: squadRef.current?.[lane]?.label ?? '',
          item,
          tier: effectiveTier(item, tierOverridesRef.current[step.slot]),
          candidates: bySlot.get(step.slot) ?? [],
        });
      });
      setReveal({
        key: `squad-${step.slot}`,
        kind: 'squad',
        slot: step.slot,
        reels,
        target: `[data-slot="${step.slot}"]`,
      });
    } else {
      setView((v) => (v ? { ...v, pending: [], bossStage: true } : v));
      setReveal({ key: 'boss', kind: 'boss', boss: step.item, candidates: bossPoolRef.current, hardMode: hardModeRef.current, target: '[data-boss]' });
    }
  };

  const onRevealDone = () => {
    const step = queueRef.current[indexRef.current];
    indexRef.current += 1;
    if (step?.kind === 'slot') {
      setView((v) => (v ? { ...v, settled: { ...v.settled, [step.slot]: step.item }, pending: [] } : v));
    } else if (step?.kind === 'squad') {
      setView((v) =>
        v
          ? {
              ...v,
              pending: [],
              squad:
                v.squad?.map((lane, i) => {
                  const item = step.items[i];
                  return item ? { ...lane, settled: { ...lane.settled, [step.slot]: item } } : lane;
                }) ?? null,
            }
          : v,
      );
    } else if (step?.kind === 'boss') {
      setView((v) => (v ? { ...v, boss: step.item } : v));
    }
    setReveal(null);
    schedule(advance, BEAT_GAP_MS);
  };

  const start = (
    loadout: Loadout,
    boss: Boss,
    onDone: () => void,
    tierOverrides?: Partial<Record<Slot, Tier>>,
    bossPool: Boss[] = [],
    hardMode = false,
    gearless = false,
    squad: SquadLane[] | null = null,
  ) => {
    clearTimers();
    onDoneRef.current = onDone;
    tierOverridesRef.current = tierOverrides ?? {};
    bossPoolRef.current = bossPool.length ? bossPool : [boss];
    hardModeRef.current = hardMode;
    squadRef.current = squad;
    queueRef.current = buildQueue(loadout, boss, gearless, squad);
    indexRef.current = 0;

    setView({
      settled: {},
      pending: [],
      bossStage: gearless,
      boss: null,
      gearless,
      squad: squad ? squad.map((l) => ({ label: l.label, settled: {} })) : null,
    });
    setReveal(null);
    schedule(advance, SLOTS_START_MS);
  };

  return { view, reveal, start, onRevealDone, running: view !== null };
};
